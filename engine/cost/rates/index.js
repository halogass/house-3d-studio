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
