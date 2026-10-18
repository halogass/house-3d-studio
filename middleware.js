// Optional PIN gate on Vercel (Routing Middleware): set SITE_PIN (and optionally SITE_SECRET) in
// the Vercel project's Environment Variables and every request (pages, scripts, the house data)
// needs a valid PIN cookie. Without SITE_PIN the site is public and this does nothing.
// Not used by `npm run dev` / `npm run preview`.
import { next } from '@vercel/functions';

export const config = { matcher: '/:path*' };

const COOKIE = 'h3s_auth';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function sign(value, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const safePath = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : '/');
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(to, wrong, lang) {
  const id = lang === 'id';
  const html = `<!doctype html><html lang="${id ? 'id' : 'en'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>PIN</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f1e7;color:#3a3028;font:15px/1.5 system-ui,sans-serif;padding:16px}
  form{background:#fbf8f2;border:1px solid #ddd2c1;border-radius:14px;padding:24px;width:100%;max-width:320px;box-shadow:0 6px 24px rgba(0,0,0,.08)}
  h1{font:600 24px Georgia,serif;margin:0 0 12px}
  input{width:100%;box-sizing:border-box;font-size:22px;letter-spacing:6px;text-align:center;padding:10px;border:1px solid #ddd2c1;border-radius:10px;margin:8px 0 12px}
  button{width:100%;padding:10px;border:0;border-radius:10px;background:#3a3028;color:#fbf8f2;font-size:15px;cursor:pointer}
  p{color:#b3261e;margin:0 0 8px}
</style></head><body>
<form method="post" action="/__pin">
  <h1>🏠</h1>
  ${wrong ? `<p>${id ? 'PIN salah, coba lagi.' : 'Wrong PIN, try again.'}</p>` : ''}
  <label for="pin">${id ? 'Masukkan PIN' : 'Enter the PIN'}</label>
  <input id="pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" autofocus required>
  <input type="hidden" name="to" value="${esc(to)}">
  <button type="submit">${id ? 'Masuk' : 'Enter'}</button>
</form></body></html>`;
  return new Response(html, { status: wrong ? 401 : 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export default async function middleware(request) {
  const pin = process.env.SITE_PIN;
  if (!pin) return next();                         // no PIN configured: public site
  const secret = process.env.SITE_SECRET || pin;
  const url = new URL(request.url);
  // The offline-cache worker holds no house data; let it register even if fetched without cookies
  if (url.pathname === '/sw.js') return next();
  const lang = /^id\b/i.test(request.headers.get('accept-language') || '') ? 'id' : 'en';
  const token = await sign('house-3d-studio:' + pin, secret);

  if (url.pathname === '/__pin' && request.method === 'POST') {
    const form = await request.formData();
    const to = safePath(String(form.get('to') || '/'));
    if (safeEqual(String(form.get('pin') || ''), pin)) {
      return new Response(null, { status: 303, headers: { location: to, 'set-cookie': `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax` } });
    }
    await new Promise(r => setTimeout(r, 800)); // slow down guessing
    return page(to, true, lang);
  }
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)h3s_auth=([^;]+)/);
  if (m && safeEqual(m[1], token)) return next();
  return page(safePath(url.pathname + url.search), false, lang);
}
