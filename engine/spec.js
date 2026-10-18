// "House spec" tab: numbers computed from the model (areas, rooms, doors and windows, rooftop
// solar, rainwater) with the household assumptions of project.json "spec". Estimates only.
//
//   renderSpec(el, { Z, PROJECT, energy, seats, doors })
//   specNumbers({ Z, PROJECT, energy, seats }) → the same numbers as data (Node: tests, cost page)
import { LEVELS, LEVEL_ORDER, GROUND, isBasement } from './config.js';
import { USES } from './schema.js';
import { t, getLang } from './i18n.js';

const area = (r) => (r[2] - r[0]) * (r[3] - r[1]);
const ov = (o) => (typeof o === 'number' ? { w: o, s: o, e: o, n: o } : { w: 0, s: 0, e: 0, n: 0, ...o });

export function specNumbers({ Z, PROJECT, energy, seats = [] }) {
  const S = PROJECT.spec;
  const levels = LEVEL_ORDER.map(lv => {
    const rooms = Z.floors[lv] || [];
    return { id: lv, name: LEVELS[lv].name, area: rooms.reduce((s, r) => s + area(r.r), 0), rooms: rooms.length, ceiling: LEVELS[lv].h - 0.3, basement: isBasement(lv) };
  });
  const all = Object.values(Z.floors).flat();
  const gfa = levels.reduce((s, l) => s + l.area, 0);
  const footprint = levels.find(l => l.id === GROUND)?.area || 0;
  const siteArea = Z.site.w * Z.site.d;
  const bedrooms = all.filter(r => USES[r.use]?.bedroom).length;
  const baths = all.filter(r => r.use === 'bath').length, wcs = all.filter(r => r.use === 'wc').length;
  const ops = Object.values(Z.openings).flat();
  const doorsN = ops.filter(o => ['swing', 'double', 'sliding', 'folding', 'garage'].includes(o.t)).length;
  const windowsN = ops.filter(o => ['window', 'glass', 'high'].includes(o.t)).length;
  // roof catchment: plan area under the roofs incl. overhangs, plus balconies / roof terraces
  const roofArea = Z.roofs.filter(R => Array.isArray(R.r)).reduce((s, R) => { const o = ov(R.over); return s + (R.r[2] - R.r[0] + o.w + o.e) * (R.r[3] - R.r[1] + o.s + o.n); }, 0);
  const pvKwp = energy?.totalKwp || 0;
  const pvKwhDay = pvKwp * S.peakSunHours * S.pvLosses;
  const useKwhDay = S.occupants * S.kwhPerPersonDay;
  const rainM3Year = roofArea * (S.rainfallMm / 1000) * S.runoff;
  const demandLDay = S.occupants * S.litresPerPersonDay;
  return {
    levels, gfa, footprint, siteArea, coverage: siteArea ? footprint / siteArea : 0,
    bedrooms, baths, wcs, rooms: all.length, seats: seats.filter(s => s.kind === 'sit').length, beds: new Set(seats.filter(s => s.kind === 'lie').map(s => s.id.split(':').slice(0, 2).join(':'))).size,
    doors: doorsN, windows: windowsN,
    pv: { panels: energy?.totalPanels || 0, kwp: pvKwp, kwhDay: pvKwhDay, useKwhDay, cover: useKwhDay ? pvKwhDay / useKwhDay : 0 },
    water: { roofArea, rainM3Year, rainLDay: rainM3Year * 1000 / 365, demandLDay, cover: demandLDay ? rainM3Year * 1000 / 365 / demandLDay : 0 },
    assumptions: S,
  };
}

export function renderSpec(el, ctx) {
  const N = specNumbers(ctx);
  const loc = getLang() === 'id' ? 'id-ID' : 'en-GB';
  const fmt = (v, d = 0) => Number(v).toLocaleString(loc, { maximumFractionDigits: d, minimumFractionDigits: d });
  const pct = (v) => fmt(Math.min(9.99, v) * 100) + ' %';
  const row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
  const table = (title, rows, note) => `<h4>${title}</h4><table>${rows.join('')}</table>${note ? `<p class="note">${note}</p>` : ''}`;
  const A = [
    ...N.levels.map(l => row(t('specLevel', { name: l.name }), t('specLevelRow', { a: fmt(l.area), n: l.rooms, h: fmt(l.ceiling, 1) }))),
    row(t('specGfa'), `<b>±${fmt(N.gfa)} m²</b>`),
    row(t('specSite'), `${fmt(ctx.Z.site.w, 1)} × ${fmt(ctx.Z.site.d, 1)} m = ${fmt(N.siteArea)} m²`),
    row(t('specBuilt'), `${fmt(N.footprint)} m² · ${pct(N.coverage)}`),
  ];
  const R = [
    row(t('specBedrooms'), N.bedrooms),
    row(t('specBaths'), `${N.baths} / ${N.wcs}`),
    row(t('specDoors'), `${N.doors} / ${N.windows}`),
    row(t('specSeats'), `${N.seats} / ${N.beds}`),
  ];
  const E = [
    row(t('specPv'), N.pv.panels ? t('specPvVal', { n: N.pv.panels, kwp: fmt(N.pv.kwp, 2) }) : '—'),
    row(t('specPvYield'), t('specPerDay', { v: `±${fmt(N.pv.kwhDay, 1)} kWh` })),
    row(t('specUse'), t('specPerDay', { v: `±${fmt(N.pv.useKwhDay, 1)} kWh` })),
    row(t('specCover'), pct(N.pv.cover)),
  ];
  const Wt = [
    row(t('specRoof'), `±${fmt(N.water.roofArea)} m²`),
    row(t('specRain'), `${t('specPerYear', { v: `±${fmt(N.water.rainM3Year)} m³` })} (≈ ${fmt(N.water.rainLDay)} L/${getLang() === 'id' ? 'hari' : 'day'})`),
    row(t('specDemand'), t('specPerDay', { v: `±${fmt(N.water.demandLDay)} L` })),
    row(t('specRainCover'), pct(N.water.cover)),
  ];
  const S = N.assumptions;
  const id = getLang() === 'id';
  const assume = `<details><summary>${t('specAssume')}</summary><ul>
    <li>${id ? 'Penghuni' : 'Occupants'}: ${S.occupants}</li>
    <li>${id ? 'Listrik' : 'Electricity'}: ${fmt(S.kwhPerPersonDay, 1)} kWh / ${id ? 'orang / hari' : 'person / day'}</li>
    <li>${id ? 'Air' : 'Water'}: ${fmt(S.litresPerPersonDay)} L / ${id ? 'orang / hari' : 'person / day'}</li>
    <li>${id ? 'Curah hujan' : 'Rainfall'}: ${fmt(S.rainfallMm)} mm / ${id ? 'tahun' : 'year'} · ${id ? 'koefisien limpasan' : 'runoff'} ${fmt(S.runoff, 2)}</li>
    <li>${id ? 'Jam matahari puncak' : 'Peak sun hours'}: ${fmt(S.peakSunHours, 1)} · ${id ? 'efisiensi sistem PV' : 'PV system efficiency'} ${fmt(S.pvLosses * 100)} % · ${fmt(S.panelWp)} Wp / panel</li>
  </ul></details>`;
  el.innerHTML = table('📐 ' + t('specArea'), A) + table('🛏 ' + t('specRooms'), R) + table('☀️ ' + t('specEnergy'), E) + table('💧 ' + t('specWater'), Wt) + assume + `<p class="note">${t('specNote')}</p>`;
}
