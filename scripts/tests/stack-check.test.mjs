import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter, once } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, mkdir, cp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  runCheck, checkResult, pytestProbeResult, timeoutOptions, DEFAULT_CHECK_TIMEOUT_MS,
  DEFAULT_PYTEST_TIMEOUT_MS, PROBE_TIMEOUT_MS,
} from '../lib/stack-check-process.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { if (e.code === 'ESRCH') return false; throw e; } };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function scratch(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'stack-check-test space-'));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}
const node = (code, cwd, args = [], deadline = 1000) => runCheck(process.execPath, ['-e', code, ...args], cwd, deadline);
async function dead(pid) {
  for (let i = 0; i < 100 && alive(pid); i++) await wait(10);
  assert.equal(alive(pid), false, `owned fixture PID ${pid} was reaped`);
}

test('conservative defaults and strictly bounded integer overrides', () => {
  assert.equal(DEFAULT_CHECK_TIMEOUT_MS, 120000);
  assert.equal(DEFAULT_PYTEST_TIMEOUT_MS, 600000);
  assert.equal(PROBE_TIMEOUT_MS, 15000);
  assert.deepEqual(timeoutOptions([]), { check: 120000, pytest: 600000 });
  assert.deepEqual(timeoutOptions(['--check-timeout-ms', '1000', '--pytest-timeout-ms', '1800000']), { check: 1000, pytest: 1800000 });
  for (const value of ['0', '-1', '999', '1800001', 'Infinity', '1.5', '', '--allow-skip']) {
    assert.throws(() => timeoutOptions(['--check-timeout-ms', value]), /must be an integer/);
  }
  assert.throws(() => timeoutOptions(['--pytest-timeout-ms']), /must be an integer/);
});

test('pytest absence is exact and cannot swallow a plugin error, timeout or interruption', () => {
  const r = { status: 1, stderr: "python: No module named 'pytest'\n", elapsedMs: 1 };
  assert.equal(pytestProbeResult(r, 1000).status, 'SKIP');
  for (const name of ['pytest_mock', 'pytest_cov', 'pytest.__main__']) {
    assert.equal(pytestProbeResult({ ...r, stderr: `No module named '${name}'\n` }, 1000).status, 'FAIL');
  }
  for (const flag of ['interrupted', 'timedOut', 'cleanupFailed']) {
    assert.equal(pytestProbeResult({ ...r, [flag]: true }, 1000).status, 'FAIL');
  }
});

test('failed kill and missing close have a separate finite cleanup deadline', async () => {
  const originalSpawn = childProcess.spawn, originalTimer = globalThis.setTimeout;
  const fake = new EventEmitter();
  fake.stdout = new PassThrough(); fake.stderr = new PassThrough();
  fake.kill = () => false; fake.unref = () => {};
  try {
    childProcess.spawn = () => fake; syncBuiltinESMExports();
    // Only this test's synthetic process/timers are accelerated. No actual PID
    // is spawned or killed, and the production deadlines remain unchanged.
    globalThis.setTimeout = (fn, _ms, ...args) => originalTimer(fn, 10, ...args);
    const r = await runCheck(process.execPath, [], ROOT, 1000);
    assert.equal(r.cleanupFailed, true); assert.equal(r.timedOut, true);
    assert.equal(checkResult(r, 1000).stop, true);
    assert.equal(fake.stdout.destroyed && fake.stderr.destroyed, true);
  } finally {
    globalThis.setTimeout = originalTimer; childProcess.spawn = originalSpawn; syncBuiltinESMExports();
  }
});

test('real successful process preserves argv, Unicode, quotes and spaced cwd', () => scratch(async dir => {
  const args = ['', 'a b', 'quote"value', 'trailing\\', '日本語', 'line\nbreak'];
  const r = await node('console.log(JSON.stringify({args:process.argv.slice(1),cwd:process.cwd()}))', dir, args);
  assert.equal(checkResult(r, 1000).status, 'PASS', JSON.stringify(r));
  assert.deepEqual(JSON.parse(r.stdout), { args, cwd: dir });
  assert.ok(r.elapsedMs >= 0);
}));

test('real nonzero status 124 is a failure and cannot masquerade as a timeout', async () => {
  const r = await node('console.error("ordinary failure");process.exit(124)', ROOT);
  assert.equal(r.status, 124); assert.equal(r.timedOut, false);
  assert.match(checkResult(r, 1000).detail, /exit=124.*ordinary failure/);
});

test('missing executable remains SKIP, supervisor errors are fail-closed', async () => {
  const r = await runCheck('music-stack-executable-that-does-not-exist', [], ROOT, 1000);
  assert.equal(checkResult(r, 1000).status, 'SKIP');
  for (const code of ['EJOB', 'EACCES', 'ESPAWN']) {
    assert.equal(checkResult({ ...r, error: { code } }, 1000).status, 'FAIL');
  }
  assert.equal(checkResult({ ...r, timedOut: true }, 1000).status, 'FAIL');
  assert.deepEqual(checkResult({ ...r, cleanupFailed: true }, 1000).stop, true);
});

test('large stdout and stderr drain without pipe blocking or unbounded diagnostics', async () => {
  const r = await node('process.stdout.write("x".repeat(200000)+"ENDOUT");process.stderr.write("y".repeat(200000)+"ENDERR")', ROOT);
  assert.equal(checkResult(r, 1000).status, 'PASS');
  assert.ok(Buffer.byteLength(r.stdout) <= 32768 && Buffer.byteLength(r.stderr) <= 32768);
  assert.ok(r.stdout.endsWith('ENDOUT') && r.stderr.endsWith('ENDERR'));
});

// Children may be detached on Windows: Job Object ownership, rather than the
// parent PID or console, still contains them. POSIX fixtures use the owned group.
async function treeFixture(dir, parentExits) {
  const pidfile = join(dir, 'child-pid');
  const ready = join(dir, 'ready');
  const childCode = `require('node:fs').writeFileSync(${JSON.stringify(ready)},String(process.pid));setInterval(()=>{},100)`;
  const code = `const{spawn}=require('node:child_process');const fs=require('node:fs');
    const c=spawn(process.execPath,['-e',${JSON.stringify(childCode)}],{detached:process.platform==='win32',stdio:['ignore','inherit','inherit']});c.unref();
    fs.writeFileSync(${JSON.stringify(pidfile)},String(c.pid));
    ${parentExits ? `const t=setInterval(()=>{if(fs.existsSync(${JSON.stringify(ready)})){clearInterval(t);process.exit(0)}},10)` : 'console.log("hang-fixture-started");setInterval(()=>{},100)'}`;
  const r = await node(code, dir, [], parentExits ? 3000 : 1000);
  const pid = Number(await readFile(pidfile, 'utf8'));
  assert.equal(Number(await readFile(ready, 'utf8')), pid, 'descendant actually started');
  await dead(pid);
  return r;
}
test('short timeout kills its detached descendant and leaves an unrelated sentinel alive', () => scratch(async dir => {
  const sentinel = spawn(process.execPath, ['-e', 'setInterval(()=>{},100)'], { windowsHide: true, stdio: 'ignore' });
  try {
    const r = await treeFixture(dir, false);
    assert.equal(r.timedOut, true); assert.equal(r.cleanupFailed, false);
    assert.match(checkResult(r, 1000).detail, /TIMEOUT.*hang-fixture-started/);
    assert.equal(alive(sentinel.pid), true, 'other job was preserved');
  } finally { const ended = once(sentinel, 'exit'); sentinel.kill('SIGKILL'); await ended; }
}));
test('successful parent exit collects descendant and inherited stdout pipe', () => scratch(async dir => {
  const r = await treeFixture(dir, true);
  assert.equal(checkResult(r, 3000).status, 'PASS', JSON.stringify(r));
  assert.equal(r.timedOut, false);
}));

test('Windows supervisor death closes its job and fails rather than reporting success', { skip: process.platform !== 'win32' }, () => scratch(async dir => {
  const pidfile = join(dir, 'killed-child');
  const code = `const{spawn}=require('node:child_process');const fs=require('node:fs');
    const c=spawn(process.execPath,['-e','setInterval(()=>{},100)'],{detached:true,stdio:'inherit'});c.unref();
    fs.writeFileSync(${JSON.stringify(pidfile)},String(c.pid));setTimeout(()=>process.kill(process.ppid,'SIGKILL'),100);setInterval(()=>{},100);`;
  const r = await node(code, dir, [], 3000);
  await dead(Number(await readFile(pidfile, 'utf8')));
  assert.equal(checkResult(r, 3000).status, 'FAIL');
  assert.equal(checkResult(r, 3000).stop, true);
}));

async function fixtureStack(dir) {
  const music = join(dir, 'Music');
  await mkdir(join(music, 'scripts'), { recursive: true });
  await cp(join(ROOT, 'scripts', 'stack-check.mjs'), join(music, 'scripts', 'stack-check.mjs'));
  await cp(join(ROOT, 'scripts', 'lib'), join(music, 'scripts', 'lib'), { recursive: true });
  for (const name of ['chill', 'drum-floor', 'namima', 'openclaw']) await mkdir(join(dir, name));
  return music;
}
async function cli(music, args) {
  const child = spawn(process.execPath, [join(music, 'scripts', 'stack-check.mjs'), ...args], { cwd: music, windowsHide: true });
  let stdout = '', stderr = '', earlyStart = false;
  child.stdout.on('data', chunk => {
    stdout += chunk;
    if (stdout.includes('[start]') && !stdout.includes('[end]')) earlyStart = true;
  });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const watchdog = setTimeout(() => child.kill('SIGKILL'), 15000);
  try { const [status] = await once(child, 'close'); return { status, stdout, stderr, earlyStart }; }
  finally { clearTimeout(watchdog); }
}
test('CLI timeout stays FAIL with allow-skip, reports live progress, then runs the next check', () => scratch(async dir => {
  const music = await fixtureStack(dir);
  await writeFile(join(music, 'scripts', 'check-01-hang.mjs'), 'console.log("short-hang");setInterval(()=>{},100)');
  await writeFile(join(music, 'scripts', 'check-02-ok.mjs'), 'console.log("next-job-ok")');
  const r = await cli(music, ['--check-timeout-ms', '1000', '--allow-skip']);
  assert.equal(r.status, 1); assert.equal(r.earlyStart, true);
  assert.match(r.stdout, /\[end\].*check-01-hang\.mjs FAIL elapsed=\d+ms/);
  assert.match(r.stdout, /\[end\].*check-02-ok\.mjs PASS elapsed=\d+ms/);
  assert.match(r.stdout, /PASS 1   FAIL 1   SKIP 4/); assert.match(r.stdout, /TIMEOUT limit=1000ms/);
  assert.doesNotMatch(r.stdout, /stack-check: 0 BAD/);
}));
test('CLI cached pytest probe timeout is FAIL, including allow-skip', () => scratch(async dir => {
  const music = await fixtureStack(dir);
  await mkdir(join(music, 'tests'));
  await writeFile(join(music, 'tests', 'test_fixture.py'), 'def test_ok(): assert True');
  await writeFile(join(dir, 'pytest.py'), 'import time\nprint("probe-hang", flush=True)\nwhile True: time.sleep(0.1)\n');
  // Short injection changes only the copied fixture's prerequisite deadline.
  // Production keeps its conservative 15s probe default asserted above.
  const lib = join(music, 'scripts', 'lib', 'stack-check-process.mjs');
  await writeFile(lib, (await readFile(lib, 'utf8')).replace('PROBE_TIMEOUT_MS = 15_000', 'PROBE_TIMEOUT_MS = 1_000'));
  const r = await cli(music, ['--allow-skip']);
  assert.equal(r.status, 1); assert.match(r.stdout, /prerequisite \/ pytest --version FAIL/);
  assert.match(r.stdout, /FAIL\s+pytest tests\/\s+TIMEOUT/);
  assert.doesNotMatch(r.stdout, /stack-check: 0 BAD/);
}));
test('CLI preserves strict skips and explicit diagnostic allowance', () => scratch(async dir => {
  const music = await fixtureStack(dir);
  const strict = await cli(music, []), diagnostic = await cli(music, ['--allow-skip']);
  assert.equal(strict.status, 1); assert.match(strict.stdout, /PASS 0   FAIL 0   SKIP 5/);
  assert.equal(diagnostic.status, 0); assert.match(diagnostic.stdout, /0 BAD \(5 SKIP explicitly allowed\)/);
  const invalid = await cli(music, ['--check-timeout-ms', '0', '--allow-skip']);
  assert.equal(invalid.status, 1); assert.match(invalid.stderr, /zero\/unbounded timeouts are forbidden/);
  assert.doesNotMatch(invalid.stdout, /\[start\]/);
}));
