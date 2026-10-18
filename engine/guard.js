// First import of engine/main.js: checks the house data before anything is built. With errors the
// page shows them in plain words (what is wrong, where, how to fix it) instead of a broken 3D view,
// and the app stops here. Warnings only go to the console.
import { RAW } from './data.js';
import { validate } from './schema.js';
import { getLang } from './i18n.js';
import { FURNITURE, furnitureInfo } from './interior/furniture/index.js';

const res = validate(RAW.project, RAW.zoning, RAW.interior, { furnitureTypes: new Set(Object.keys(FURNITURE)), furnitureInfo });
for (const w of res.warnings) console.warn('[data]', w.where, '—', w[getLang()] || w.en);
if (res.errors.length) {
  const id = getLang() === 'id';
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  document.getElementById('loading')?.remove();
  const el = document.createElement('div');
  el.id = 'dataErr';
  el.innerHTML = `<h2>${id ? 'Data rumah perlu diperbaiki' : 'The house data needs fixing'}</h2>
    <p>${id ? 'Perbaiki hal berikut (atau minta Claude memperbaikinya), lalu muat ulang. Jalankan <code>npm run validate</code> untuk daftar lengkap.'
      : 'Fix the following (or ask Claude to), then reload. Run <code>npm run validate</code> for the full list.'}</p>
    <ol>${res.errors.map(e => `<li><code>${esc(e.where)}</code><br>${esc(e[id ? 'id' : 'en'])}</li>`).join('')}</ol>`;
  document.body.appendChild(el);
  window.__dhStarted = true;
  throw new Error('house data invalid: ' + res.errors.length + ' error(s)');
}
