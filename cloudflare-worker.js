// The Parlour - activity service (optional). Counts how many players are online and counts invite-code joins.
// Deploy it free on Cloudflare Workers (see the step list I sent). Then put its address into ADS.countUrl in the game.
export class Presence {
  constructor(state, env) { this.state = state; this.env = env || {}; this.seen = new Map(); }
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
    if (url.pathname.startsWith('/clan/')) return this.clan(url, id, code, now);
    return new Response('Not found', { status: 404 });
  }
  // ---- Clans: name + members + weekly wins. No accounts; a clan is a short code. ----
  async clan(url, id, code, now) {
    const st = this.state.storage, p = url.pathname.slice(6);
    const week = Math.floor((now + 3 * 86400000) / 604800000);
    const LV = 200, REWARD = 20;
    const view = (c, k) => ({ code: k, name: c.name, members: Object.keys(c.m).length, wins: (c.w && c.w[week]) || 0, isPublic: !!c.pub, pool: c.pool || 0, level: Math.floor((c.pool || 0) / LV), perLevel: LV, msgs: (c.msgs || []).slice(-12).map(x => ({ u: x.u, n: x.n || '', a: x.a || 0, m: x.m, e: x.e, s: x.s, g: x.g, t: x.t })) });
    const AVN = 40;
    const userOk = (n) => typeof n === 'string' && n.length >= 3 && n.length <= 16 && /^[\p{L}\p{N} _-]+$/u.test(n) && !rudeCheck(n);
    const prof = (c, i) => { const p = (c.p && c.p[i]) || null; return p ? { n: p.n, a: p.a } : { n: '', a: 0 }; };
    const readProf = (c) => {
      const n = (url.searchParams.get('n') || '').replace(/\s+/g, ' ').trim(), a = parseInt(url.searchParams.get('a') || '0', 10);
      if (!n) return { ok: true };
      if (!userOk(n)) return { ok: false, error: rudeCheck(n) ? 'rude' : 'uname' };
      if (!(a >= 0 && a < AVN)) return { ok: false, error: 'uname' };
      c.p = c.p || {}; c.p[id] = { n, a }; return { ok: true };
    };
    const lvl = (c) => Math.floor((c.pool || 0) / LV);
    const clean = (t) => String(t || '').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
    if (p === 'create') {
      const name = clean(url.searchParams.get('name'));
      if (!id || name.length < 3) return Response.json({ ok: false, error: 'name' });
      if (rudeCheck(name)) return Response.json({ ok: false, error: 'rude' });
      const mine = await st.get('mine:' + id); if (mine) return Response.json({ ok: false, error: 'already', code: mine });
      let k = ''; const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      for (let tries = 0; tries < 20; tries++) { k = ''; for (let i = 0; i < 5; i++) k += A[Math.floor(Math.random() * A.length)]; if (!(await st.get('clan:' + k))) break; }
      const c = { name, pub: url.searchParams.get('public') === '1', m: { [id]: now }, w: {}, pool: 0, cl: { [id]: 0 }, msgs: [] };
      const pr = readProf(c); if (!pr.ok) return Response.json(pr);
      await st.put('clan:' + k, c); await st.put('mine:' + id, k);
      return Response.json({ ok: true, clan: view(c, k) });
    }
    if (p === 'join') {
      if (!id || !code) return Response.json({ ok: false, error: 'code' });
      const mine = await st.get('mine:' + id); if (mine && mine !== code) return Response.json({ ok: false, error: 'already', code: mine });
      const c = await st.get('clan:' + code); if (!c) return Response.json({ ok: false, error: 'nofound' });
      if (Object.keys(c.m).length >= 50 && !c.m[id]) return Response.json({ ok: false, error: 'full' });
      const pr = readProf(c); if (!pr.ok) return Response.json(pr);
      if (!c.m[id]) { c.cl = c.cl || {}; c.cl[id] = lvl(c); } c.m[id] = now; await st.put('clan:' + code, c); await st.put('mine:' + id, code);
      return Response.json({ ok: true, clan: view(c, code) });
    }
    if (p === 'leave') {
      const k = await st.get('mine:' + id); if (!k) return Response.json({ ok: true });
      const c = await st.get('clan:' + k); await st.delete('mine:' + id);
      if (c) { delete c.m[id]; if (c.p) delete c.p[id]; if (Object.keys(c.m).length) await st.put('clan:' + k, c); else await st.delete('clan:' + k); }
      return Response.json({ ok: true });
    }
    if (p === 'me') {
      const k = id && await st.get('mine:' + id); if (!k) return Response.json({ ok: true, clan: null });
      const c = await st.get('clan:' + k); if (!c) { await st.delete('mine:' + id); return Response.json({ ok: true, clan: null }); }
      return Response.json({ ok: true, roster: Object.keys(c.m).slice(0, 50).map(i => prof(c, i)).filter(r => r.n), clan: view(c, k), claimable: Math.max(0, lvl(c) - ((c.cl && c.cl[id]) || 0)) * REWARD });
    }
    if (p === 'win') {
      const k = id && await st.get('mine:' + id); if (!k) return Response.json({ ok: false });
      const c = await st.get('clan:' + k); if (!c) return Response.json({ ok: false });
      const day = Math.floor(now / 86400000), dk = 'day:' + id;
      let d = (await st.get(dk)) || { d: day, n: 0 }; if (d.d !== day) d = { d: day, n: 0 };
      const n = Math.max(0, Math.min(40 - d.n, parseInt(url.searchParams.get('n') || '0', 10) || 0));
      if (n > 0) { d.n += n; await st.put(dk, d); c.w = { [week]: ((c.w && c.w[week]) || 0) + n }; await st.put('clan:' + k, c); }
      return Response.json({ ok: true, clan: view(c, k) });
    }
    if (p === 'profile') {
      const k = id && await st.get('mine:' + id); if (!k) return Response.json({ ok: true });
      const c = await st.get('clan:' + k); if (!c) return Response.json({ ok: true });
      const pr = readProf(c); if (!pr.ok) return Response.json(pr); await st.put('clan:' + k, c); return Response.json({ ok: true });
    }
    if (p === 'say' || p === 'give' || p === 'claim') {
      const k = id && await st.get('mine:' + id); if (!k) return Response.json({ ok: false });
      const c = await st.get('clan:' + k); if (!c) return Response.json({ ok: false });
      if (p === 'say') {
        const gi = (u) => { const v = parseInt(url.searchParams.get(u) || '-1', 10); return v; };
        const m = gi('m'), e = gi('e'), sk = gi('s'), g = (url.searchParams.get('g') || '').trim();
        const okText = m >= 0 && m < 12, okEmoji = e >= 0 && e < 24, okSticker = sk >= 0 && sk < 12, okGif = /^[A-Za-z0-9]{5,25}$/.test(g);
        if (!(okText || okEmoji || okSticker || okGif)) return Response.json({ ok: false });
        if (okGif) {
          // Only accept GIFs that Giphy itself rates G. Needs the GIPHY_KEY secret; without it GIFs are refused.
          const key = this.env.GIPHY_KEY; if (!key) return Response.json({ ok: false, error: 'nogif' });
          try { const r = await fetch('https://api.giphy.com/v1/gifs/' + g + '?api_key=' + encodeURIComponent(key)); const j = await r.json(); if (!j || !j.data || String(j.data.rating).toLowerCase() !== 'g') return Response.json({ ok: false, error: 'nogif' }); }
          catch (err) { return Response.json({ ok: false, error: 'nogif' }); }
        }
        const rk = 'say:' + id, last = (await st.get(rk)) || 0; if (now - last < 4000) return Response.json({ ok: false, error: 'slow' });
        await st.put(rk, now); const pf = prof(c, id); c.msgs = (c.msgs || []).concat([Object.assign({ u: id.slice(0, 3).toUpperCase(), n: pf.n, a: pf.a, t: now }, okGif ? { g } : okSticker ? { s: sk } : okEmoji ? { e } : { m })]).slice(-30); await st.put('clan:' + k, c);
        return Response.json({ ok: true, clan: view(c, k) });
      }
      if (p === 'give') {
        const day = Math.floor(now / 86400000), gk = 'give:' + id; let g = (await st.get(gk)) || { d: day, n: 0 }; if (g.d !== day) g = { d: day, n: 0 };
        const n = Math.max(0, Math.min(100 - g.n, parseInt(url.searchParams.get('n') || '0', 10) || 0));
        if (n > 0) { g.n += n; await st.put(gk, g); c.pool = (c.pool || 0) + n; await st.put('clan:' + k, c); }
        return Response.json({ ok: true, given: n, clan: view(c, k) });
      }
      c.cl = c.cl || {}; const have = c.cl[id] || 0, now2 = lvl(c), gems = Math.max(0, now2 - have) * REWARD;
      if (gems > 0) { c.cl[id] = now2; await st.put('clan:' + k, c); }
      return Response.json({ ok: true, gems, clan: view(c, k) });
    }
    if (p === 'top' || p === 'list') {
      const all = await st.list({ prefix: 'clan:' }); const rows = [];
      for (const [key, c] of all) if (c.pub) rows.push(view(c, key.slice(5)));
      rows.sort(p === 'top' ? ((a, b) => b.wins - a.wins || b.members - a.members) : ((a, b) => b.members - a.members || b.wins - a.wins));
      return Response.json({ ok: true, clans: rows.slice(0, 30) });
    }
    return new Response('Not found', { status: 404 });
  }
}
/*FILTER_START*/
// Rude-name filter. Same code runs in the game and in the clan service.
// STRONG words are blocked anywhere inside a name; SHORT words only when they stand alone as a word
// (so "class" and "Cockpit" are fine, but "a s s", "a$$" or "c0ck" are not).
const RUDE_STRONG = ['fuck','fuk','shit','shet','shyt','shite','bitch','biatch','cunt','whore','slut','nigg','fagg','bastard','asshole','arsehole','dickhead','pussy','wanker','twat','porn','nazi','hitler','motherfuk',
  'کسکش','جنده','حرومزاده','کونی','مادرجنده','گاییدم','گاییدن','پفیوز','دیوث','بیناموس','لاشی','عوضی','سیکتیر','قحبه','اوروسپو','پیسر','کیرم','کیری',
  'koskesh','jende','haroomzade','haramzade','gayidam','kooni','madarjende','kharkosde','pedarsag','siktir','orospu','amciq','qehbe','peyser','qancig','gotveren','sikim','sikdir'];
const RUDE_SHORT = ['ass','arse','dick','cock','tit','tits','rape','sex','kir','kos','kon','koon','kiri','sik','pic','pis','کیر','کص','کس','کون','سیک'];
const RUDE_ALLOW = ['scunthorpe','shitake','dickens','cockburn'];
function rudeNorm(s) {
  s = String(s == null ? '' : s).normalize('NFKD').replace(/[\u0300-\u036f\u064b-\u065f\u0670\u06d6-\u06ed\u0640\u200c\u200d\u200e\u200f]/g, '');
  s = s.toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه').replace(/ı/g, 'i').replace(/ə/g, 'e').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ё/g, 'e');
  const map = { '0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','@':'a','$':'s','!':'i','|':'i','+':'t','а':'a','е':'e','о':'o','р':'p','с':'c','х':'x','у':'y','і':'i','ѕ':'s','ј':'j' };
  s = s.replace(/[0134578@$!|+аеорсхуіѕј]/g, ch => map[ch]);
  const toks = s.split(/[\s_.\-,;:/\\]+/).map(t => t.replace(/[^\p{L}\p{N}]/gu, '').replace(/(.)\1+/gu, '$1')).filter(Boolean);
  return toks;
}
function rudeCheck(s) {
  const toks = rudeNorm(s); let full = toks.join('');
  RUDE_ALLOW.forEach(a => { full = full.split(a).join(''); });
  const col = (w) => w.replace(/(.)\1+/gu, '$1');
  const strong = RUDE_STRONG.map(col), short = RUDE_SHORT.map(col);
  for (const w of strong) if (full.indexOf(w) >= 0) return true;
  for (const w of short) { if (full === w) return true; for (const t of toks) if (t === w) return true; }
  return false;
}
/*FILTER_END*/

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
