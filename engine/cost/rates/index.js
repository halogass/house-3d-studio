// Unit-rate tables per region, for the cost estimate (engine/cost/calc.js, studio/cost.html).
// project.json → "cost": { "region": "<id>", "quality": "standard" | "premium" | "luxury" } picks one.
//
// Add a region:
//   1. copy rates/jawa-barat-2026.js to rates/<region>-<year>.js (e.g. bali-2026.js)
//   2. change `id`, `name`, `note` and the rates (keep every item id: the page compares regions)
//   3. import it below and add it to RATES
//   4. set project.json "cost": { "region": "bali-2026" }
// A region missing from RATES falls back to DEFAULT_REGION (the page says so).
import jawaBarat2026 from './jawa-barat-2026.js';

export const RATES = {
  'jawa-barat-2026': jawaBarat2026,
};
export const DEFAULT_REGION = 'jawa-barat-2026';
export const ratesFor = (id) => RATES[id] || RATES[DEFAULT_REGION];

// The house's own adjustments from project.json "cost" (no engine edit needed for a new city):
//   index: 0.88                      regional price index (calc.js defaults)
//   rates: { "<itemId>": 950000 }    unit rate overrides (IDR at standard quality), e.g. a local quote
//   extra: [{ "id": "bathWallTile", "n": { "id": "…", "en": "…" }, "u": "m²", "qty": 38, "r": 185000,
//             "qs": 0.5, "lv": "gfa" }]   items the model does not measure
//   label: { "id": "…", "en": "…" }   shown with the table name (e.g. "Yogyakarta: Jawa Barat × 0.88")
export function withProject(R, project) {
  const c = project?.cost || {};
  const rates = c.rates && typeof c.rates === 'object' ? c.rates : {};
  const extra = Array.isArray(c.extra) ? c.extra : [];
  if (!Object.keys(rates).length && !extra.length && !c.label) return R;
  const cats = R.CATEGORIES.map((cat) => ({ ...cat, items: cat.items.map((it) => (typeof rates[it.id] === 'number' ? { ...it, r: rates[it.id], overridden: true } : it)) }));
  if (extra.length) cats.push({
    id: 'project', name: { id: 'Tambahan proyek', en: 'Project additions' },
    items: extra.map((e, i) => ({ id: e.id || `extra${i + 1}`, n: typeof e.n === 'string' ? { id: e.n, en: e.n } : e.n, u: e.u || 'ls', q: () => +e.qty || 0, r: +e.r || 0, qs: e.qs ?? 0.5, lv: e.lv || 'gfa', reg: e.reg })),
  });
  const lab = (l) => (typeof c.label === 'string' ? c.label : c.label?.[l]);
  return { ...R, CATEGORIES: cats, name: c.label ? { id: `${R.name.id} · ${lab('id') || lab('en')}`, en: `${R.name.en} · ${lab('en') || lab('id')}` } : R.name };
}
