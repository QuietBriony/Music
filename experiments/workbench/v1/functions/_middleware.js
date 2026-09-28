import cloudflareAccessPlugin from '@cloudflare/pages-plugin-cloudflare-access';

export const onRequest = [
  async (context) => {
    const { CF_ACCESS_DOMAIN: domain, CF_ACCESS_AUD: aud, OWNER_EMAIL: email } = context.env;
    if (!domain?.startsWith('https://') || !aud || !email) {
      return new Response('Private access is not configured', { status: 503 });
    }
    return context.next();
  },
  (context) => cloudflareAccessPlugin({
    domain: context.env.CF_ACCESS_DOMAIN,
    aud: context.env.CF_ACCESS_AUD,
  })(context),
  (context) => {
    const actual = context.data.cloudflareAccess?.JWT?.payload?.email;
    const expected = context.env.OWNER_EMAIL;
    if (typeof actual !== 'string' || actual.toLowerCase() !== expected.toLowerCase()) {
      return new Response('Forbidden', { status: 403 });
    }
    return context.next();
  },
];
