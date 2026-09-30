import { SOUND_CACHE_PREFIX, SOUND_META_CACHE, SOUND_META_PATH, SOUND_FILES, MAX_SOUND_BYTES,
  soundDigest, validWav } from './offline-policy.js';

export async function readSoundPack(storage, origin, files = SOUND_FILES) {
  const control = await storage.open(SOUND_META_CACHE);
  const response = await control.match(new URL(SOUND_META_PATH, origin).href);
  if (!response) return { ready: false };
  let state;
  try { state = await response.json(); } catch { return { ready: false }; }
  if (!state || state.schema_version !== 1 || typeof state.cacheName !== 'string' || !state.cacheName.startsWith(SOUND_CACHE_PREFIX)
      || !Array.isArray(state.files) || state.files.length !== files.length) return { ready: false };
  const cache = await storage.open(state.cacheName);
  for (const file of files) {
    const key = new URL(file.key, origin).href;
    const info = state.files.find((item) => item.key === key);
    if (!info || (file.sha256 && info.sha256 !== file.sha256) || !await cache.match(key)) return { ready: false, cacheName: state.cacheName };
  }
  return { ...state, ready: true };
}

export async function saveSoundPack({ storage, origin, fetcher = fetch, files = SOUND_FILES, progress = () => {} }) {
  const previous = await readSoundPack(storage, origin, files);
  const cacheName = SOUND_CACHE_PREFIX + crypto.randomUUID();
  const cache = await storage.open(cacheName);
  const saved = [];
  try {
    for (const file of files) {
      const url = new URL(file.url, origin).href;
      progress({ done: saved.length, total: files.length, label: file.label });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      let bytes;
      try {
        const response = await fetcher(url, { mode: 'cors', cache: 'no-store', signal: controller.signal });
        if (!response.ok || (response.url && response.url !== url)
            || Number(response.headers.get('Content-Length') || 0) > MAX_SOUND_BYTES) throw new Error(file.label + ' を取得できません');
        bytes = await response.arrayBuffer();
      } finally { clearTimeout(timeout); }
      if (!validWav(bytes)) throw new Error(file.label + ' のWAV形式または容量が不正です');
      const sha256 = await soundDigest(bytes);
      if (file.sha256 && sha256 !== file.sha256) throw new Error(file.label + ' の固定版と一致しません');
      const key = new URL(file.key, origin).href;
      await cache.put(key, new Response(bytes, { headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(bytes.byteLength) } }));
      saved.push({ key, sha256, bytes: bytes.byteLength });
    }
    const state = { schema_version: 1, cacheName, preparedAt: new Date().toISOString(),
      bytes: saved.reduce((total, file) => total + file.bytes, 0), files: saved };
    const control = await storage.open(SOUND_META_CACHE);
    // Commit the pointer only after every sound passed validation and was saved.
    await control.put(new URL(SOUND_META_PATH, origin).href, new Response(JSON.stringify(state),
      { headers: { 'Content-Type': 'application/json' } }));
    // Once committed, cleanup must never roll back the new active generation.
    try {
      progress({ done: saved.length, total: files.length });
      for (const name of await storage.keys()) {
        if (name.startsWith(SOUND_CACHE_PREFIX) && name !== cacheName) await storage.delete(name);
      }
    } catch { /* old generations can be cleaned on the next save */ }
    return { ...state, ready: true };
  } catch (error) {
    try { await storage.delete(cacheName); } catch { /* preserve the original failure */ }
    throw new Error((error.message || '保存に失敗しました') + (previous.ready ? '。前の音源セットは残っています。' : ''));
  }
}
