// Construction cost estimate of the active house (studio/cost.html): quantities measured from the
// plan (engine/cost/quantities.js) × the unit rates of a region (engine/cost/rates/), plus design
// fees, permits, contingency and PPN. Everything recomputes live when an assumption changes.
// ESTIMATE only: the page says so at the top.
import { Z, PROJECT, INTERIOR } from '../engine/data.js';
import { LEVELS } from '../engine/config.js';
import { t, tr, getLang, setLang, applyI18n, LANGS } from '../engine/i18n.js';
import { computeQuantities } from '../engine/cost/quantities.js';
import { calc, defaults, QUALITIES } from '../engine/cost/calc.js';
import { RATES, DEFAULT_REGION, ratesFor as tableFor, withProject } from '../engine/cost/rates/index.js';

const $ = (id) => document.getElementById(id);
const loc = getLang() === 'id' ? 'id-ID' : 'en-GB';
const num = (v, d = 0) => Number(v).toLocaleString(loc, { maximumFractionDigits: d, minimumFractionDigits: d });
// Rupiah: "Rp 1,2 M" (miliar / billion) or "Rp 350 jt" (juta / million) in the headlines, full in tables
const big = (v) => (v >= 1e9 ? `Rp ${num(v / 1e9, 2)} ${getLang() === 'id' ? 'M' : 'bn'}` : `Rp ${num(v / 1e6, 0)} ${getLang() === 'id' ? 'jt' : 'm'}`);
const rp = (v) => 'Rp ' + num(Math.round(v));

const Q = computeQuantities({ Z, PROJECT, INTERIOR });
const wanted = PROJECT.cost?.region || DEFAULT_REGION;
// the project's own adjustments (project.json cost.rates / extra / label) apply to its own table
const ratesFor = (id) => (id === (RATES[wanted] ? wanted : DEFAULT_REGION) ? withProject(tableFor(id), PROJECT) : tableFor(id));
let R = ratesFor(wanted);
let A = defaults(R, PROJECT);

applyI18n(document);
document.title = `${tr(PROJECT.title)} · ${t('costTitle')}`;
$('title').textContent = `${tr(PROJECT.title)} · ${t('costTitle')}`;
$('meta').textContent = [PROJECT.location.city, `${num(Q.gfa, 1)} m²`].filter(Boolean).join(' · ');
if (!RATES[wanted]) { $('regionWarn').hidden = false; $('regionWarn').textContent = t('costRegionMissing', { r: wanted, d: tr(R.name) }); }

// ---------------------------------------------------------------- controls
const langSel = $('lang');
for (const l of LANGS) langSel.add(new Option(l === 'id' ? 'Bahasa Indonesia' : 'English', l));
langSel.value = getLang();
langSel.onchange = () => { setLang(langSel.value); location.reload(); };
const regionSel = $('region');
for (const [id, r] of Object.entries(RATES)) regionSel.add(new Option(tr(r.name), id));
regionSel.value = R.id;
regionSel.onchange = () => { R = ratesFor(regionSel.value); A = { ...defaults(R, PROJECT), quality: A.quality }; syncControls(); render(); };
const qBox = $('quality');
for (const q of QUALITIES) {
  const b = document.createElement('button');
  b.dataset.q = q;
  b.onclick = () => { A.quality = q; syncControls(); render(); };
  qBox.appendChild(b);
}
const sliders = { regionIdx: ['region', (v) => num(v, 2)], fee: ['fee', (v) => num(v, 1) + ' %'], cont: ['cont', (v) => num(v) + ' %'], ppn: ['ppn', (v) => num(v) + ' %'], range: ['range', (v) => '± ' + num(v) + ' %'] };
for (const [id, [key]] of Object.entries(sliders)) $(id).oninput = (e) => { A[key] = +e.target.value; syncControls(); render(); };
function syncControls() {
  $('regionNote').textContent = tr(R.note);
  qBox.querySelectorAll('button').forEach(b => { b.textContent = tr(R.QUALITY[b.dataset.q].label); b.classList.toggle('on', b.dataset.q === A.quality); });
  for (const [id, [key, f]] of Object.entries(sliders)) { $(id).value = A[key]; $(id.replace('Idx', '') + 'Out').textContent = f(A[key]); }
}

// ---------------------------------------------------------------- render
function bars(el, rows) {
  const max = Math.max(...rows.map(r => r[1]), 1);
  el.innerHTML = rows.map(([n, v]) => `<div class="lbl">${n}</div><div class="track"><b style="width:${(v / max * 100).toFixed(1)}%"></b></div><div class="val">${big(v)}</div>`).join('');
}
function render() {
  const E = calc(Q, R, A);
  $('total').innerHTML = `${big(E.total)} <small>${t('estimateBadge').toLowerCase()}</small>`;
  $('perM2').textContent = `≈ ${big(E.perM2.total)} ${t('costPerM2')}`;
  $('low').textContent = big(E.low); $('high').textContent = big(E.high);
  const tile = (k, v) => `<div class="tile"><div class="k">${k}</div><div class="v">${big(v)}</div></div>`;
  $('tiles').innerHTML = tile(t('costConstruction'), E.construction) + tile(t('costFees'), E.fees) + tile(t('costPermits'), E.permits)
    + tile(`${t('costCont')} + ${t('costPpn')}`, E.cont + E.ppn);
  const k = E.construction ? E.total / E.construction : 1;
  bars($('catBars'), E.cats.map(c => [tr(c.name), c.total * k]));
  bars($('lvBars'), Object.entries(E.perLevel).filter(([, v]) => v > 0).map(([lv, v]) => [lv === 'site' ? t('costSite') : LEVELS[lv].name, v]));
  bars($('drivers'), E.drivers.map(d => [tr(d.n), d.amt]));
  const head = `<thead><tr><th>${t('costItem')}</th><th class="n">${t('costQty')}</th><th>${t('costUnit')}</th><th class="n">${t('costRate')}</th><th class="n">${t('costAmount')}</th></tr></thead>`;
  $('cats').innerHTML = E.cats.map(c => `<details class="cat"><summary><span class="cn">${tr(c.name)}</span><span class="n">${rp(c.total)}</span></summary><div class="body scroll"><table>${head}<tbody>`
    + c.items.map(i => `<tr><td>${tr(i.n)}</td><td class="n">${num(i.qty, i.qty % 1 ? 1 : 0)}</td><td>${i.u}</td><td class="n">${rp(i.rate)}</td><td class="n">${rp(i.amt)}</td></tr>`).join('')
    + `<tr class="sum"><td colspan="4">${t('total')}</td><td class="n">${rp(c.total)}</td></tr></tbody></table></div></details>`).join('')
    + `<details class="cat" open><summary><span class="cn">${t('costTotal')}</span><span class="n">${rp(E.total)}</span></summary><div class="body"><table><tbody>`
    + `<tr><td>${t('costConstruction')}</td><td class="n">${rp(E.construction)}</td></tr>`
    + E.feeLines.map(f => `<tr><td>${t('costFees')} · ${tr(f.n)}</td><td class="n">${rp(f.amt)}</td></tr>`).join('')
    + E.permitLines.map(p => `<tr><td>${t('costPermits')} · ${tr(p.n)}</td><td class="n">${rp(p.amt)}</td></tr>`).join('')
    + `<tr><td>${t('costCont')} (${num(A.cont)} %)</td><td class="n">${rp(E.cont)}</td></tr><tr><td>${t('costPpn')} (${num(A.ppn)} %)</td><td class="n">${rp(E.ppn)}</td></tr>`
    + `<tr class="grand"><td>${t('costTotal')}</td><td class="n">${rp(E.total)}</td></tr></tbody></table></div></details>`;
}
// quantities measured from the plan
{
  const rows = [
    [t('costGfa'), `${num(Q.gfa, 1)} m² (${Q.order.map(l => `${LEVELS[l].short} ${num(Q.levels[l].area, 1)}`).join(' · ')})`],
    [t('costSite'), `${num(Q.site.area)} m²`],
    [t('costWalls'), `${num(Q.walls.extArea)} / ${num(Q.walls.intArea)} m²`],
    [t('costRoof'), `${num(Q.roofs.sloped)} m²`],
    [t('specDoors'), `${Q.doors} / ${Q.windows}`],
    [t('specBaths'), `${Q.wet.baths} / ${Q.wet.wcs}`],
    [t('costPv'), `${num(Q.pv.kwp, 2)} kWp`],
  ];
  $('qty').innerHTML = '<tbody>' + rows.map(([k, v]) => `<tr><td>${k}</td><td class="n">${v}</td></tr>`).join('') + '</tbody>';
}
syncControls();
render();
window.__cost = { ready: true, Q, calc: () => calc(Q, R, A) };
