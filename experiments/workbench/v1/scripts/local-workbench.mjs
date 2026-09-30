import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const parts = ['pad', 'sub', 'drums'];
const drumParts = ['bd', 'sd', 'hh', 'oh'];
const source = 'https://music-private-live-workbench.pages.dev';
const drumMapUrl = 'https://raw.githubusercontent.com/felixroos/dough-samples/9eacfc86ec4393e68a463ff52b01c19cfaa77f38/tidal-drum-machines.json';
const drumMapBase = 'https://raw.githubusercontent.com/ritchse/tidal-drum-machines/main/machines/';
const drumSampleRoot = 'https://raw.githubusercontent.com/ritchse/tidal-drum-machines/6577395a4d05031728ced2ec3e5637fa89d8be48/machines/';
const drumHashes = {
  tr909_bd: '5ae8cbf94145b4d8a2c4ee6a6a922045564887c22812916149c1e5740820b8bb',
  tr909_sd: 'f5fef391d10d453966d38a680e8f20445cf258cbb182781c90021161f8c5d7b4',
  tr909_hh: '6b737acdd4e9db504dc8225c613ae72fb9b67c2e493b011c50750e16c708e9bd',
  tr909_oh: 'd68cfd300f400f7b616b9cd7b75971b29bfe90d2d6c79c1206719def21d539c7',
};
const maxWavBytes = 20_000_000;
const mime = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav', '.woff2': 'font/woff2',
};

export const cacheDir = resolve(process.env.MUSIC_WORKBENCH_SOUND_DIR
  || join(homedir(), '.music-live-workbench', 'sounds'));

function wavValid(bytes) {
  return bytes.length >= 44 && bytes.length <= maxWavBytes
    && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WAVE';
}

function checksum(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function verifySoundPack(directory = cacheDir) {
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  if (manifest.schema_version !== 2 || manifest.source !== source || manifest.drum_map !== drumMapUrl) {
    throw new Error('音源パックの記録が一致しません');
  }
  for (const part of [...parts, ...drumParts.map((name) => 'tr909_' + name)]) {
    const entry = manifest.files?.[part];
    const bytes = await readFile(join(directory, part + '.wav'));
    if (!entry || !wavValid(bytes) || bytes.length !== entry.bytes || checksum(bytes) !== entry.sha256) {
      throw new Error(part + '.wav の内容が一致しません');
    }
  }
  return manifest;
}

export async function prepareSoundPack(directory = cacheDir, fetcher = fetch) {
  const downloads = {};
  async function downloadWav(part, url) {
    const response = await fetcher(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok || response.url !== url
      || !response.headers.get('content-type')?.startsWith('audio/wav')) {
      throw new Error(part + ' の公開音源を取得できません (' + response.status + ')');
    }
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > maxWavBytes) throw new Error(part + ' の容量が上限を超えています');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!wavValid(bytes)) throw new Error(part + ' のWAV形式または容量が不正です');
    if (drumHashes[part] && checksum(bytes) !== drumHashes[part]) {
      throw new Error(part + ' の固定SHA-256と一致しません');
    }
    downloads[part] = bytes;
  }
  for (const part of parts) await downloadWav(part, source + '/api/sounds/' + part);
  const mapResponse = await fetcher(drumMapUrl, { signal: AbortSignal.timeout(30_000) });
  if (!mapResponse.ok || mapResponse.url !== drumMapUrl) throw new Error('909の音源一覧を取得できません');
  const drumMap = await mapResponse.json();
  if (drumMap._base !== drumMapBase) throw new Error('909の音源一覧の参照先が変わっています');
  for (const part of drumParts) {
    const path = drumMap['RolandTR909_' + part]?.[0];
    if (typeof path !== 'string' || !path.startsWith('RolandTR909/') || path.includes('..')) {
      throw new Error('909の' + part + '音源が見つかりません');
    }
    await downloadWav('tr909_' + part, new URL(path, drumSampleRoot).href);
  }
  await mkdir(directory, { recursive: true });
  const files = {};
  for (const [part, bytes] of Object.entries(downloads)) {
    const target = join(directory, part + '.wav');
    const temporary = target + '.tmp-' + process.pid;
    await writeFile(temporary, bytes);
    await rename(temporary, target);
    files[part] = { bytes: bytes.length, sha256: checksum(bytes) };
  }
  const manifest = { schema_version: 2, source, drum_map: drumMapUrl,
    prepared_at: new Date().toISOString(), files };
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await verifySoundPack(directory);
  return manifest;
}

function send(res, status, body = '') {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

export function createLocalServer({ directory = dist, sounds = cacheDir, injectLocalBridge = true } = {}) {
  return createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
    catch { return send(res, 400, 'Bad path'); }
    if (pathname.includes('\0') || pathname.includes('\\')) return send(res, 400, 'Bad path');

    const soundMatch = /^\/api\/sounds\/(pad|sub|drums)$/.exec(pathname);
    const drumMatch = /^\/__local__\/samples\/(bd|sd|hh|oh)\.wav$/.exec(pathname);
    const bankMap = pathname === '/__local__/maps/tidal-drum-machines.json';
    const emptyMap = /^\/__local__\/maps\/(piano|Dirt-Samples|vcsl|mridangam|strudel|tidal-drum-machines-alias)\.json$/.test(pathname);
    const bridge = pathname === '/__local__/bank-bridge.js';
    if (pathname.startsWith('/api/') && !soundMatch) return send(res, 404, 'Not found');
    if (pathname.startsWith('/__local__/') && !drumMatch && !bankMap && !emptyMap && !bridge) {
      return send(res, 404, 'Not found');
    }
    if (bankMap || emptyMap) {
      const body = JSON.stringify(bankMap ? {
        _base: '/__local__/samples/',
        ...Object.fromEntries(drumParts.map((part) => ['RolandTR909_' + part, [part + '.wav']])),
      } : {});
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(req.method === 'HEAD' ? '' : body);
    }
    let target = soundMatch ? join(sounds, soundMatch[1] + '.wav')
      : drumMatch ? join(sounds, 'tr909_' + drumMatch[1] + '.wav')
        : bridge ? join(root, 'scripts', 'local-bank-bridge.js') : resolve(directory, '.' + pathname);
    if (!soundMatch && !drumMatch && !bridge) {
      const inside = relative(directory, target);
      if (inside.startsWith('..') || isAbsolute(inside)) return send(res, 403, 'Forbidden');
    }
    try {
      let info = await stat(target);
      if (info.isDirectory()) {
        target = join(target, 'index.html');
        info = await stat(target);
      }
      if (!info.isFile()) return send(res, 404, 'Not found');
      if (injectLocalBridge && target === join(directory, 'index.html')) {
        const original = await readFile(target, 'utf8');
        const marker = '<script src="/vendor/strudel/index.js" defer></script>';
        if (!original.includes(marker)) throw new Error('Strudel起動タグが見つかりません');
        const body = original.replace(marker, '<script src="/__local__/bank-bridge.js"></script>\n    ' + marker);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
        return res.end(req.method === 'HEAD' ? '' : body);
      }
      res.writeHead(200, {
        'Content-Type': mime[extname(target)] || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (req.method === 'HEAD') return res.end();
      createReadStream(target).on('error', (streamError) => {
        console.error(streamError);
        res.destroy(streamError);
      }).pipe(res);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return send(res, 404, 'Not found');
      console.error(error);
      send(res, 500, 'Local server error');
    }
  });
}

async function main() {
  const command = process.argv[2];
  if (command === 'prepare') {
    const manifest = await prepareSoundPack();
    console.log(`ローカル音源7本を保存しました（${Object.values(manifest.files).reduce((n, file) => n + file.bytes, 0)} bytes）: ${cacheDir}`);
  } else if (command === 'serve') {
    try { await stat(join(dist, 'index.html')); await verifySoundPack(); }
    catch { throw new Error('ローカル準備が未完了です。ネット接続時に npm ci → npm run local:prepare を実行してください。'); }
    const port = Number(process.env.MUSIC_WORKBENCH_PORT || 8788);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MUSIC_WORKBENCH_PORT は1〜65535の整数にしてください');
    createLocalServer().listen(port, '127.0.0.1', () => {
      console.log(`ローカル試奏台: http://127.0.0.1:${port}/`);
      console.log('起動後は外部通信不要。公開8作品の3ループと909の4音をローカルから読み込みます。');
    });
  } else {
    throw new Error('Usage: node scripts/local-workbench.mjs prepare | serve');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
