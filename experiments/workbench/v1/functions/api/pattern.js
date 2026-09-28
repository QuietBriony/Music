export async function onRequestGet({ env }) {
  const namespace = env.MUSIC_LIVE_ASSETS;
  const key = env.LIVE_PATTERN_KEY;
  if (!namespace || !key) return new Response('Pattern storage is not configured', { status: 503 });
  const pattern = await namespace.get(key, 'text');
  if (!pattern) return new Response('Pattern not found', { status: 404 });
  return new Response(pattern, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
