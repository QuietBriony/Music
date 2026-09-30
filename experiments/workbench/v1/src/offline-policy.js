export const SOUND_CACHE_PREFIX = 'music-workbench-device-sounds-v1-';
export const SOUND_META_CACHE = 'music-workbench-device-meta-v1';
export const SOUND_META_PATH = '/__offline__/sound-pack';
export const MAX_SOUND_BYTES = 20_000_000;
const drumRoot = 'https://raw.githubusercontent.com/ritchse/tidal-drum-machines/6577395a4d05031728ced2ec3e5637fa89d8be48/machines/';
const drums = [
  ['bd', 'rolandtr909-bd/Bassdrum-01.wav', '5ae8cbf94145b4d8a2c4ee6a6a922045564887c22812916149c1e5740820b8bb'],
  ['sd', 'rolandtr909-sd/naredrum.wav', 'f5fef391d10d453966d38a680e8f20445cf258cbb182781c90021161f8c5d7b4'],
  ['hh', 'rolandtr909-hh/hh01.wav', '6b737acdd4e9db504dc8225c613ae72fb9b67c2e493b011c50750e16c708e9bd'],
  ['oh', 'rolandtr909-oh/Hat Open.wav', 'd68cfd300f400f7b616b9cd7b75971b29bfe90d2d6c79c1206719def21d539c7'],
];
export const SOUND_FILES = [
  ...['pad', 'sub', 'drums'].map((name) => ({ key: '/api/sounds/' + name, url: '/api/sounds/' + name, label: name })),
  ...drums.map(([name, path, sha256]) => {
    const url = new URL('RolandTR909/' + path, drumRoot).href;
    return { key: url, url, sha256, label: '909 ' + name,
      alias: url.replace('6577395a4d05031728ced2ec3e5637fa89d8be48', 'main') };
  }),
];
export const SAMPLE_REGISTRIES = [
  'https://raw.githubusercontent.com/felixroos/dough-samples/main/tidal-drum-machines.json',
  'https://raw.githubusercontent.com/felixroos/dough-samples/main/piano.json',
  'https://raw.githubusercontent.com/felixroos/dough-samples/main/Dirt-Samples.json',
  'https://raw.githubusercontent.com/felixroos/dough-samples/main/vcsl.json',
  'https://raw.githubusercontent.com/felixroos/dough-samples/main/mridangam.json',
  'https://raw.githubusercontent.com/tidalcycles/uzu-drumkit/main/strudel.json',
  'https://raw.githubusercontent.com/todepond/samples/main/tidal-drum-machines-alias.json',
];

export function soundFileFor(url, origin) {
  const requested = new URL(url);
  requested.search = '';
  return SOUND_FILES.find((file) => requested.href === new URL(file.key, origin).href || requested.href === file.alias);
}

export function offlineRegistry(url) {
  return url === SAMPLE_REGISTRIES[0]
    ? { _base: drumRoot, ...Object.fromEntries(drums.map(([name, path]) => ['RolandTR909_' + name, ['RolandTR909/' + path]])) }
    : {};
}

export async function soundDigest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Pages redirects /index.html to /. Returning a redirected network Response
// from a worker can fail a navigation with redirect:manual. Save a verified,
// decoded snapshot without the network redirect/encoding metadata.
export async function appSnapshotResponse(response, sha256) {
  if (!response.ok) throw new Error('アプリの更新内容を取得できません。ネット接続中に更新してください。');
  const bytes = await response.arrayBuffer();
  if (await soundDigest(bytes) !== sha256) {
    throw new Error('アプリの更新内容が揃っていません。ネット接続中に更新してください。');
  }
  const headers = new Headers(response.headers);
  headers.delete('Content-Encoding');
  headers.set('Content-Length', String(bytes.byteLength));
  return new Response(bytes, { status: response.status, headers });
}

export function validWav(bytes) {
  const view = new Uint8Array(bytes);
  return view.length >= 44 && view.length <= MAX_SOUND_BYTES
    && String.fromCharCode(...view.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...view.slice(8, 12)) === 'WAVE';
}

// Safari/media elements can request only part of a cached WAV. A full cached
// response remains intact; each partial response is generated on demand.
export async function soundRange(response, header) {
  if (!header) return response;
  const bytes = await response.arrayBuffer();
  const size = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  let start = match?.[1] ? Number(match[1]) : 0;
  let end = match?.[2] ? Number(match[2]) : size - 1;
  if (match && !match[1] && match[2]) { start = Math.max(0, size - end); end = size - 1; }
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
      || start >= size || end < start || (!match[1] && Number(match[2]) === 0)) {
    return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  }
  end = Math.min(end, size - 1);
  const headers = new Headers(response.headers);
  headers.delete('Content-Encoding');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}
