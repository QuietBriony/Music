import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

export const DEFAULT_CHECK_TIMEOUT_MS = 120_000;
export const DEFAULT_PYTEST_TIMEOUT_MS = 600_000;
export const PROBE_TIMEOUT_MS = 15_000;
export const MIN_TIMEOUT_MS = 1_000;
export const MAX_TIMEOUT_MS = 1_800_000;
const OUTPUT_BYTES = 32_768;
const WINDOWS_HELPER = fileURLToPath(new URL('./stack-check-job.ps1', import.meta.url));

function windowsExecutable(cmd, cwd) {
  const name = /\.[^\\/]+$/.test(cmd) ? cmd : cmd + '.exe';
  const candidates = isAbsolute(name) || /[\\/]/.test(name)
    ? [resolve(cwd, name)]
    : (process.env.PATH || '').split(';').filter(Boolean).map(dir => join(dir.replace(/^"|"$/g, ''), name));
  return candidates.find(path => existsSync(path));
}

export function timeoutOptions(argv) {
  const values = { check: DEFAULT_CHECK_TIMEOUT_MS, pytest: DEFAULT_PYTEST_TIMEOUT_MS };
  const names = { '--check-timeout-ms': 'check', '--pytest-timeout-ms': 'pytest' };
  for (let i = 0; i < argv.length; i++) {
    const key = names[argv[i]];
    if (!key) continue;
    const raw = argv[++i];
    if (!/^\d+$/.test(raw || '') || !Number.isSafeInteger(Number(raw))
      || Number(raw) < MIN_TIMEOUT_MS || Number(raw) > MAX_TIMEOUT_MS) {
      throw new Error(`${argv[i - 1]} must be an integer ${MIN_TIMEOUT_MS}..${MAX_TIMEOUT_MS}; zero/unbounded timeouts are forbidden`);
    }
    values[key] = Number(raw);
  }
  return values;
}

// Drain all output, retaining only bounded tails for diagnostics. A noisy check
// must neither fill a pipe nor consume unbounded memory in the conductor.
function tail(previous, chunk) {
  if (chunk.length >= OUTPUT_BYTES) return chunk.subarray(chunk.length - OUTPUT_BYTES);
  const combined = Buffer.concat([previous, chunk]);
  return combined.subarray(Math.max(0, combined.length - OUTPUT_BYTES));
}

export async function runCheck(cmd, args, cwd, timeoutMs) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error('Invalid bounded check timeout');
  }
  const started = performance.now();
  const windows = process.platform === 'win32';
  if (windows) {
    const path = windowsExecutable(cmd, cwd);
    if (!path) return { status: null, error: { code: 'ENOENT', message: `Executable not found: ${cmd}` }, elapsedMs: 0 };
    cmd = path;
  }
  const scratch = windows ? await mkdtemp(join(tmpdir(), 'music-stack-check-')) : null;
  const resultPath = scratch && join(scratch, 'result.json');
  let executable = cmd, childArgs = args;
  if (windows) {
    executable = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const payload = Buffer.from(JSON.stringify({ cmd, args, cwd, timeoutMs, resultPath, parentPid: process.pid })).toString('base64');
    childArgs = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', WINDOWS_HELPER, '-Payload', payload];
  }
  try {
    return await new Promise(resolve => {
      let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), spawnError;
      let timedOut = false, cleanupFailed = false, interrupted = false, watchdog, cleanupTimer, settled = false;
      const child = spawn(executable, childArgs, {
        cwd, windowsHide: true, detached: !windows, stdio: ['ignore', 'pipe', 'pipe'],
      });
      const finish = (metadata, status, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog); clearTimeout(cleanupTimer);
        process.removeListener('SIGINT', interrupt);
        process.removeListener('SIGTERM', interrupt);
        resolve({
          status: metadata.exitCode ?? status, signal,
          error: spawnError || (metadata.errorCode ? { code: metadata.errorCode, message: metadata.error } : null),
          timedOut: timedOut || Boolean(metadata.timedOut), interrupted,
          cleanupFailed: cleanupFailed || Boolean(metadata.cleanupFailed),
          stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8'),
          elapsedMs: Math.round(performance.now() - started),
        });
      };
      const boundCleanup = () => {
        if (cleanupTimer || settled) return;
        // A failed kill or an inherited pipe must not make the Promise wait for
        // 'close' forever. Fail closed, detach these handles and stop the stack.
        cleanupTimer = setTimeout(() => {
          cleanupFailed = true;
          child.stdout.destroy(); child.stderr.destroy(); child.unref();
          finish({}, null, 'cleanup-deadline');
        }, 5000);
      };
      const killGroup = () => {
        if (!child.pid) return;
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch (error) { if (error.code !== 'ESRCH') cleanupFailed = true; }
      };
      child.stdout.on('data', chunk => { stdout = tail(stdout, chunk); });
      child.stderr.on('data', chunk => { stderr = tail(stderr, chunk); });
      child.on('error', error => { spawnError = error; });
      const interrupt = () => {
        interrupted = true;
        if (windows) { cleanupFailed = true; child.kill('SIGKILL'); }
        else killGroup();
        boundCleanup();
      };
      process.once('SIGINT', interrupt);
      process.once('SIGTERM', interrupt);
      // Windows enforces the check deadline inside the Job Object. This extra
      // watchdog bounds helper startup (15s) and tree cleanup (5s), too. Killing
      // that helper closes its non-inherited job handle and kills its job.
      watchdog = setTimeout(() => {
        timedOut = true;
        if (windows) { cleanupFailed = true; child.kill('SIGKILL'); }
        else killGroup();
        boundCleanup();
      }, timeoutMs + (windows ? 20_000 : 0));
      child.on('exit', () => {
        if (!windows) killGroup(); // Also collect workers after a parent exits.
        boundCleanup();
      });
      child.on('close', async (status, signal) => {
        if (settled) return;
        let metadata = {};
        if (windows && !spawnError) {
          try {
            metadata = JSON.parse((await readFile(resultPath, 'utf8')).replace(/^\uFEFF/, ''));
            if (!Number.isInteger(metadata.exitCode) || typeof metadata.timedOut !== 'boolean'
              || typeof metadata.cleanupFailed !== 'boolean') throw new Error('Invalid supervisor result');
          }
          catch { metadata = { errorCode: 'EJOB', error: 'Windows job supervisor did not return a result', cleanupFailed: true }; }
        }
        finish(metadata, status, signal);
      });
    });
  } finally {
    if (scratch) await rm(scratch, { recursive: true, force: true });
  }
}

export function checkResult(result, timeoutMs) {
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim().split(/\r?\n/).slice(-3).join(' / ').slice(0, 240);
  if (result.interrupted) return { status: 'FAIL', detail: 'check interrupted; remaining checks were not started', stop: true };
  if (result.cleanupFailed) return { status: 'FAIL', detail: `process-tree cleanup could not be confirmed; elapsed=${result.elapsedMs}ms; ${output}`, stop: true };
  if (result.timedOut) return { status: 'FAIL', detail: `TIMEOUT limit=${timeoutMs}ms elapsed=${result.elapsedMs}ms; process tree stopped; ${output}` };
  if (result.error) return {
    status: result.error.code === 'ENOENT' ? 'SKIP' : 'FAIL',
    detail: `${result.error.code || 'spawn error'}: ${result.error.message || ''}; ${output}`.slice(0, 300),
  };
  return result.status === 0 ? { status: 'PASS', detail: '' }
    : { status: 'FAIL', detail: `exit=${result.status ?? 'none'}${result.signal ? ` signal=${result.signal}` : ''}; ${output}` };
}

export function pytestProbeResult(result, timeoutMs) {
  const classified = checkResult(result, timeoutMs);
  if (!result.error && !result.timedOut && !result.interrupted && !result.cleanupFailed && result.status !== 0
    && /No module named (?:'pytest'|"pytest"|pytest)(?:\r?\n|$)/.test(result.stderr)) {
    return { status: 'SKIP', detail: 'pytest not installed' };
  }
  return classified;
}
