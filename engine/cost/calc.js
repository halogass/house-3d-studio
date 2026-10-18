// Cost estimate: quantities × unit rates, then design fees, permits, contingency, PPN (VAT) and a ±
// range. Pure function, browser and Node.
//
//   calc(Q, R, A) → result
//     Q  engine/cost/quantities.js computeQuantities()
//     R  a rates table (engine/cost/rates/<region>.js)
//     A  assumptions, defaults R.DEFAULTS: { quality: 'standard'|'premium'|'luxury', region: index (1 = the
//        table's own region), fee: % design & engineering, cont: % contingency, ppn: % VAT, range: % ± }
//   result: { A, qm, cats: [{ id, name, items: [{ id, n, u, qty, rate, amt, w }], total }], construction,
//     fees, feeLines, permits, permitLines, subtotal, cont, ppn, total, low, high, perM2, perLevel, drivers }
export const QUALITIES = ['standard', 'premium', 'luxury'];

export function defaults(R, project = {}) {
  const A = { ...R.DEFAULTS };
  if (QUALITIES.includes(project?.cost?.quality)) A.quality = project.cost.quality;
  for (const k of ['region', 'fee', 'cont', 'ppn', 'range']) if (typeof project?.cost?.[k] === 'number') A[k] = project.cost[k];
  // project.json cost.index: regional price index against the table's own region (cost.region is
  // the table id, a string), e.g. 0.88 for a cheaper city than the table's
  if (typeof project?.cost?.index === 'number') A.region = project.cost.index;
  return A;
}

// How an item is spread over the floors: weights per level id (+ 'site')
function weights(lv, Q) {
  const L = Q.order, area = (k) => Q.levels[k]?.area || 0;
  let w;
  if (typeof lv === 'function') w = lv(Q);
  else if (lv === 'gfa') w = Object.fromEntries(L.map(k => [k, area(k)]));
  else if (lv === 'ground') w = { [Q.ground]: 1 };
  else if (lv === 'upper') w = Object.fromEntries(L.filter(k => k !== Q.ground && (Q.levels[k]?.elev ?? 0) > 0).map(k => [k, area(k)]));
  else if (lv && Q.levels[lv]) w = { [lv]: 1 };
  else w = { site: 1 };
  const s = Object.values(w).reduce((a, b) => a + b, 0);
  const out = {};
  for (const k of [...L, 'site']) out[k] = s > 0 ? (w[k] || 0) / s : 0;
  if (s <= 0) out.site = 1;
  return out;
}

export function calc(Q, R, A0 = {}) {
  const A = { ...R.DEFAULTS, ...A0 };
  const qm = (R.QUALITY[A.quality] || R.QUALITY.standard).m;
  const keys = [...Q.order, 'site'];
  const cats = R.CATEGORIES.map(c => {
    const items = c.items.map(it => {
      const qty = Math.max(0, +it.q(Q, A) || 0);
      const rate = it.r * (1 + (it.qs || 0) * (qm - 1)) * (it.reg === false ? 1 : A.region);
      return { id: it.id, n: it.n, u: it.u, qty, rate, amt: qty * rate, w: weights(it.lv, Q) };
    }).filter(i => i.qty > 0);
    return { id: c.id, name: c.name, items, total: items.reduce((s, i) => s + i.amt, 0) };
  }).filter(c => c.items.length);
  const construction = cats.reduce((s, c) => s + c.total, 0);
  const fees = construction * A.fee / 100;
  const feeLines = (R.FEES || []).map(f => ({ n: f.n, amt: fees * f.share }));
  const permitLines = (R.PERMITS || []).map(p => ({ n: p.n, amt: (p.r + (p.perM2 || 0) * Q.gfa) * (p.reg === false ? 1 : A.region) }));
  const permits = permitLines.reduce((s, p) => s + p.amt, 0);
  const subtotal = construction + fees + permits;
  const cont = subtotal * A.cont / 100;
  // PPN on the contractor's work and the design fees (incl. their contingency), not on permits
  const ppn = (construction + fees) * (1 + A.cont / 100) * A.ppn / 100;
  const total = subtotal + cont + ppn;
  const k = construction ? total / construction : 1;   // all-in factor for allocations
  const perLevel = Object.fromEntries(keys.map(l => [l, cats.reduce((s, c) => s + c.items.reduce((t, i) => t + i.amt * i.w[l], 0), 0) * k]));
  const drivers = cats.flatMap(c => c.items.map(i => ({ cat: c.name, n: i.n, amt: i.amt * k }))).sort((a, b) => b.amt - a.amt).slice(0, 10);
  return {
    A, qm, cats, construction, fees, feeLines, permits, permitLines, subtotal, cont, ppn, total,
    low: total * (1 - A.range / 100), high: total * (1 + A.range / 100),
    perM2: { total: Q.gfa ? total / Q.gfa : 0, construction: Q.gfa ? construction / Q.gfa : 0 },
    perLevel, drivers,
  };
}
