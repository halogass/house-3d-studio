// Quantity take-off from the plan data (no three.js scene needed): what the cost estimate
// (engine/cost/calc.js, studio/cost.html) multiplies by the unit rates. Same code in the browser
// and in Node (scripts/quantities.mjs writes projects/<name>/quantities.json for the wizard).
//
//   computeQuantities({ Z, PROJECT, INTERIOR, energy?, trees? }) → Q
//     Z, PROJECT, INTERIOR  the normalised project data (engine/data.js / engine/schema.js normalize)
//     energy                optional: the built world's PV count (world.js energy); else estimated
//     trees                 optional: the exact number of trees the site builds; else estimated
//
// Q fields (metres, m², m³, counts) — see docs/SCHEMA.md "Cost estimate" for the full list:
//   levels{id: {name, elev, h, area, rooms, extWallLen, extWallArea, intWallLen, intWallArea,
//              ceilingArea, openings{type: {n, area}}}}, order[], ground, gfa, footprint, upperArea,
//   walls{extLen, extArea, intLen, intArea}, openings{type: {n, area, w}}, doors, windows,
//   roofs{plan, sloped, soffit, byType{hip|gable|shed|flat: {plan, sloped}}, byMaterial{mat: sloped}},
//   finishes{floor{material: m²}, wallTile, wallPaint, ceiling},
//   wet{rooms, baths, wcs, toilets, basins, showers, tubs}, kitchen{runM, islands},
//   rooms{bedrooms, living}, stairs{count, flights}, lift{stops}, balconies,
//   site{area, paving, terrace, path, driveway, parking, lawn, garden, court, pergola, carport,
//        buildings, pool{area, volume, count}, perimeter{wall, fence, hedge}, walls, fences,
//        hedges, gates{sliding, slidingM, swing}, trees},
//   pv{panels, kwp, estimated}, furniture{type: n}, cars
import { wallRuns, DOOR_TOP } from '../geom.js';
import { USES } from '../schema.js';

const OPEN_H = { window: 1.4, glass: 2.65, high: 0.8 };   // glazed heights (world.js)
const area = (r) => (r[2] - r[0]) * (r[3] - r[1]);
const ov = (o) => (typeof o === 'number' ? { w: o, s: o, e: o, n: o } : { w: 0, s: 0, e: 0, n: 0, ...o });
const r2 = (v) => Math.round(v * 100) / 100;
const CARS = new Set(['sedan', 'mpv', 'minivan', 'sports', 'hatchback', 'ev', 'cityCar', 'microcar', 'pickup']);

// The plot edges, named by the road side (same as engine/site.js plotEdges, kept local: no scene imports)
function plotEdges(site) {
  const { w, d } = site;
  const E = { s: [[0, 0], [w, 0]], n: [[0, d], [w, d]], w: [[0, 0], [0, d]], e: [[w, 0], [w, d]] };
  const opp = { s: 'n', n: 's', e: 'w', w: 'e' }[site.road] || 'n';
  const sides = ['n', 's', 'e', 'w'].filter(k => k !== site.road && k !== opp);
  return [{ role: 'front', seg: E[site.road] || E.s }, { role: 'back', seg: E[opp] }, ...sides.map(k => ({ role: 'sides', seg: E[k] }))];
}

export function computeQuantities({ Z, PROJECT, INTERIOR, energy = null, trees = null }) {
  const order = Z.levels.map(l => l.id);
  const ground = order.find(id => Z.levels.find(l => l.id === id).elev >= -0.6) || order[0];
  const Q = {
    project: PROJECT.name, region: PROJECT.cost?.region || PROJECT.location?.region, generated: new Date().toISOString(),
    order, ground, levels: {}, gfa: 0, footprint: 0, upperArea: 0,
    walls: { extLen: 0, extArea: 0, intLen: 0, intArea: 0 }, openings: {}, doors: 0, windows: 0,
    roofs: { plan: 0, sloped: 0, soffit: 0, byType: {}, byMaterial: {} },
    finishes: { floor: {}, wallTile: 0, wallPaint: 0, ceiling: 0 },
    wet: { rooms: 0, baths: 0, wcs: 0, toilets: 0, basins: 0, showers: 0, tubs: 0 },
    kitchen: { runM: 0, islands: 0 }, rooms: { bedrooms: 0, living: 0, total: 0 },
    stairs: { count: 0, flights: 0 }, lift: { stops: 0 }, balconies: 0,
    site: {}, pv: {}, furniture: {}, cars: 0,
  };
  const finishOf = (id) => INTERIOR?.rooms?.[id]?.finish || {};

  // ---------------------------------------------------------------- per level
  for (const L of Z.levels) {
    const rooms = Z.floors[L.id] || [];
    const base = L.id === ground ? Math.min(0, L.elev) : L.elev;
    const wallH = L.elev + L.h - base, clear = L.h - 0.3;
    const lv = { name: L.name, elev: L.elev, h: L.h, area: 0, rooms: rooms.length, extWallLen: 0, extWallArea: 0, intWallLen: 0, intWallArea: 0, ceilingArea: 0, openings: {} };
    for (const r of rooms) {
      const a = area(r.r);
      lv.area += a;
      lv.ceilingArea += a;
      const use = USES[r.use] || USES.other;
      const fin = finishOf(r.id);
      // the house's own materials (project.json "materials") are priced like `costAs` if given
      let floor = fin.floor || use.floor || 'travertine';
      if (PROJECT?.materials?.[floor]?.costAs) floor = PROJECT.materials[floor].costAs;
      Q.finishes.floor[floor] = (Q.finishes.floor[floor] || 0) + a;
      // room wall faces (perimeter × clear height): tiled in wet rooms (or finish.walls 'tile')
      const faces = 2 * ((r.r[2] - r.r[0]) + (r.r[3] - r.r[1])) * clear;
      if ((fin.walls || (use.wet && r.use !== 'laundry' ? 'tile' : 'paint')) === 'tile') Q.finishes.wallTile += faces;
      else Q.finishes.wallPaint += faces;
      if (use.wet) Q.wet.rooms++;
      if (r.use === 'bath') Q.wet.baths++;
      if (r.use === 'wc') Q.wet.wcs++;
      if (use.bedroom) Q.rooms.bedrooms++;
      if (['living', 'family'].includes(r.use)) Q.rooms.living++;
      Q.rooms.total++;
    }
    // walls from the 0.5 m lattice runs, net of their openings
    const ops = Z.openings[L.id] || [];
    for (const run of wallRuns(rooms, Z.open[L.id] || [])) {
      const len = run.end - run.start;
      let holes = 0;
      for (const d of ops) {
        if (d.o !== run.o || Math.abs((run.o === 'h' ? d.y : d.x) - run.fixed) > 1e-6) continue;
        const a = run.o === 'h' ? d.x : d.y, w = Math.max(0, Math.min(a + d.w, run.end) - Math.max(a, run.start));
        holes += w * (OPEN_H[d.t] ?? DOOR_TOP[d.t] ?? 2.2);
      }
      if (run.cls === 'ext') { lv.extWallLen += len; lv.extWallArea += len * wallH - holes; }
      else { lv.intWallLen += len; lv.intWallArea += len * L.h - holes; }
    }
    for (const d of ops) {
      const o = (lv.openings[d.t] ||= { n: 0, area: 0 });
      const g = (Q.openings[d.t] ||= { n: 0, area: 0, w: 0 });
      const a = d.w * (OPEN_H[d.t] ?? DOOR_TOP[d.t] ?? 2.2);
      o.n++; o.area += a; g.n++; g.area += a; g.w += d.w;
      if (['swing', 'double', 'sliding', 'folding', 'garage'].includes(d.t)) Q.doors++;
      else if (OPEN_H[d.t]) Q.windows++;
    }
    for (const o of Z.outdoor[L.id] || []) if (o.r) Q.balconies += area(o.r);
    Q.levels[L.id] = lv;
    Q.gfa += lv.area;
    Q.walls.extLen += lv.extWallLen; Q.walls.extArea += lv.extWallArea;
    Q.walls.intLen += lv.intWallLen; Q.walls.intArea += lv.intWallArea;
    Q.finishes.ceiling += lv.ceilingArea;
  }
  Q.footprint = Q.levels[ground]?.area || 0;
  Q.upperArea = Q.gfa - Q.footprint;

  // ---------------------------------------------------------------- roofs
  const pvRoofs = [];
  for (const R of Z.roofs || []) {
    if (!Array.isArray(R.r)) continue;
    const o = ov(R.over);
    const X = R.r[2] - R.r[0] + o.w + o.e, Y = R.r[3] - R.r[1] + o.s + o.n;
    const plan = X * Y, sloped = R.type === 'flat' ? plan : plan * Math.hypot(1, R.pitch ?? 0.45);
    const t = (Q.roofs.byType[R.type] ||= { plan: 0, sloped: 0 });
    t.plan += plan; t.sloped += sloped;
    const mat = R.type === 'flat' ? 'flatSlab' : (R.material || PROJECT.style?.roof || 'terracotta');
    Q.roofs.byMaterial[mat] = (Q.roofs.byMaterial[mat] || 0) + sloped;
    Q.roofs.plan += plan; Q.roofs.sloped += sloped;
    Q.roofs.soffit += plan - area(R.r);
    if (R.type === 'hip' && R.pv && PROJECT.features?.pv !== false) pvRoofs.push({ X, Y, pitch: R.pitch ?? 0.45 });
  }

  // ---------------------------------------------------------------- interior items
  const all = { ...(INTERIOR?.rooms || {}), ...(INTERIOR?.areas || {}) };
  for (const entry of Object.values(all)) for (const it of entry.items || []) {
    Q.furniture[it.type] = (Q.furniture[it.type] || 0) + 1;
    if (CARS.has(it.type)) Q.cars++;
    if (it.type === 'toilet') Q.wet.toilets++;
    if (it.type === 'vanity') Q.wet.basins += it.sinks || 1;
    if (it.type === 'showerGlass') Q.wet.showers++;
    if (it.type === 'bathtubFreestanding') Q.wet.tubs++;
    if (it.type === 'kitchenRun') Q.kitchen.runM += it.w ?? 3.0;
    if (it.type === 'kitchenIsland') Q.kitchen.islands++;
  }

  // ---------------------------------------------------------------- stairs, lift
  for (const s of Z.stairs || []) { Q.stairs.count++; Q.stairs.flights += s.type === 'U' ? 2 : 1; }
  Q.lift.stops = Z.lift ? (Z.lift.stops || []).length : 0;

  // ---------------------------------------------------------------- site
  const S = Z.site, items = S.items || [];
  const sum = (kind) => items.filter(i => i.kind === kind && i.r).reduce((s, i) => s + area(i.r), 0);
  const len = (i) => Math.hypot(i.to[0] - i.from[0], i.to[1] - i.from[1]);
  const pools = items.filter(i => i.kind === 'pool' && i.r);
  const site = {
    area: S.w * S.d,
    paving: sum('paving'), terrace: sum('terrace'), path: sum('path'), driveway: sum('driveway'), parking: sum('parking'),
    lawn: sum('lawn'), garden: sum('garden'), court: sum('court'), pergola: sum('pergola'), carport: sum('carport'), buildings: sum('building'),
    pool: { count: pools.length, area: pools.reduce((s, p) => s + area(p.r), 0), volume: pools.reduce((s, p) => s + area(p.r) * (p.depth ?? 1.4), 0) },
    walls: items.filter(i => i.kind === 'wall' && i.from).reduce((s, i) => s + len(i), 0),
    fences: items.filter(i => i.kind === 'fence' && i.from).reduce((s, i) => s + len(i), 0),
    hedges: items.filter(i => i.kind === 'hedge' && i.from).reduce((s, i) => s + len(i), 0),
    gates: { sliding: 0, slidingM: 0, swing: 0 },
    perimeter: { wall: 0, fence: 0, hedge: 0 },
    trees: trees ?? 0,
  };
  // paved areas under a pool are not paved
  for (const p of pools) for (const it of items) if (it.kind === 'paving' && it.r) {
    const ox = Math.max(0, Math.min(it.r[2], p.r[2]) - Math.max(it.r[0], p.r[0])), oy = Math.max(0, Math.min(it.r[3], p.r[3]) - Math.max(it.r[1], p.r[1]));
    site.paving -= ox * oy;
  }
  const gates = items.filter(i => i.kind === 'gate' && i.from);
  for (const g of gates) {
    if (g.type === 'swing') site.gates.swing++;
    else { site.gates.sliding++; site.gates.slidingM += len(g); }
  }
  const P = S.perimeter || {};
  for (const { role, seg } of plotEdges(S)) {
    const kind = P[role] ?? 'wall';
    if (!kind || kind === 'none') continue;
    const [[ax, ay], [bx, by]] = seg, h = ay === by;
    let L = Math.hypot(bx - ax, by - ay);
    for (const g of gates) {
      const on = h ? Math.abs(g.from[1] - ay) < 0.3 && Math.abs(g.to[1] - ay) < 0.3 : Math.abs(g.from[0] - ax) < 0.3 && Math.abs(g.to[0] - ax) < 0.3;
      if (on) L -= len(g) + 0.3;
    }
    site.perimeter[kind] = (site.perimeter[kind] || 0) + Math.max(0, L);
  }
  if (trees == null) {
    for (const it of items) {
      if (it.kind === 'tree') site.trees++;
      if (it.kind === 'trees' && it.r) { const sp = it.spacing ?? 4; site.trees += Math.max(1, Math.floor((it.r[2] - it.r[0]) / sp) * Math.max(1, Math.floor((it.r[3] - it.r[1]) / sp))); }
    }
  }
  Q.site = site;

  // ---------------------------------------------------------------- PV
  const wp = PROJECT.spec?.panelWp || 550;
  if (energy && typeof energy.totalPanels === 'number') Q.pv = { panels: energy.totalPanels, kwp: energy.totalKwp, estimated: false };
  else {
    // ≈ 45 % of the roof planes that do not face the pole (hip roof: N + E + W or S + E + W), 2.58 m² per module
    let panels = 0;
    for (const R of pvRoofs) {
      const long = Math.max(R.X, R.Y), short = Math.min(R.X, R.Y);
      const trap = (long + (long - short)) / 2 * short / 2, tri = short * short / 4;   // plan areas of a long / short plane
      // one long plane faces the equator when the ridge runs east–west (X ≥ Y), else both long planes are E / W
      const usable = (R.X >= R.Y ? trap + 2 * tri : 2 * trap + tri) * Math.hypot(1, R.pitch);
      panels += Math.floor(usable * 0.45 / 2.58);
    }
    Q.pv = { panels, kwp: Math.round(panels * wp / 10) / 100, estimated: true };
  }

  // round for readability
  const round = (o) => { for (const k of Object.keys(o)) { if (typeof o[k] === 'number') o[k] = r2(o[k]); else if (o[k] && typeof o[k] === 'object') round(o[k]); } return o; };
  return round(Q);
}
