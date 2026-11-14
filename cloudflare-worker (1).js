// The Parlour - activity service (optional). Counts how many players are online and counts invite-code joins.
// Deploy it free on Cloudflare Workers (see the step list I sent). Then put its address into ADS.countUrl in the game.
export class Presence {
  constructor(state) { this.state = state; this.seen = new Map(); }
  async fetch(request) {
    const url = new URL(request.url);
    const now = Date.now();
    const id = (url.searchParams.get('id') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
    const code = (url.searchParams.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    const prune = () => { for (const [k, t] of this.seen) if (now - t > 150000) this.seen.delete(k); };
    if (url.pathname === '/ping') {
      if (id) this.seen.set(id, now);
      prune();
      return Response.json({ users: this.seen.size });
    }
    if (url.pathname === '/count') { prune(); return Response.json({ users: this.seen.size }); }
    if (url.pathname === '/ref' && code && id) {
      const joined = await this.state.storage.get('joined:' + id);
      if (!joined) {
        await this.state.storage.put('joined:' + id, code);
        const n = (await this.state.storage.get('refs:' + code)) || 0;
        await this.state.storage.put('refs:' + code, n + 1);
      }
      return Response.json({ ok: true });
    }
    if (url.pathname === '/refs' && code) {
      return Response.json({ count: (await this.state.storage.get('refs:' + code)) || 0 });
    }
    return new Response('Not found', { status: 404 });
  }
}
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': '*' };
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const stub = env.PRESENCE.get(env.PRESENCE.idFromName('main'));
    const res = await stub.fetch(request);
    const out = new Response(res.body, res);
    Object.entries(CORS).forEach(([k, v]) => out.headers.set(k, v));
    out.headers.set('Cache-Control', 'no-store');
    return out;
  }
};
