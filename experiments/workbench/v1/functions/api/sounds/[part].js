const parts = new Set(['pad', 'sub', 'drums']);

export async function onRequestGet({ env, params }) {
  const part = params.part;
  if (!parts.has(part)) return new Response('Not found', { status: 404 });
  const namespace = env.MUSIC_LIVE_ASSETS;
  const prefix = env.LIVE_SOUND_PREFIX;
  if (!namespace || !prefix) return new Response('Sound storage is not configured', { status: 503 });
  const audio = await namespace.get(`${prefix}/${part}.wav`, 'arrayBuffer');
  if (!audio) return new Response('Not found', { status: 404 });
  return new Response(audio, {
    headers: {
      'Content-Type': 'audio/wav',
      'Content-Length': String(audio.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
