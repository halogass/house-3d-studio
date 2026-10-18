// Kitchen: base/upper cabinet runs, island, bar stool, range hood.
// Local frame: origin floor/footprint centre, +Z FRONT (cabinet doors). rangeHood is a wall item (back at z = 0).
import * as THREE from 'three';
import {
  Kit, TAU, rbox, cyl, lathe, sphere, torus, tube, shakerDoor, slabFront, knob, barPull, cupPull,
  vase, smallPlant, bookStack, rng, seedOf,
} from './decor.js';

const COUNTER_Y = 0.9;

/** Slab counter over [x0,x1]×[z0,z1] (top at yTop) with an optional rectangular hole. */
function counter(k, x0, x1, z0, z1, yTop, t, name, hole = null) {
  const piece = (a0, a1, b0, b1) => {
    if (a1 - a0 < 0.005 || b1 - b0 < 0.005) return;
    k.add(rbox(a1 - a0, t, b1 - b0, 0.004, 1), name, (a0 + a1) / 2, yTop - t / 2, (b0 + b1) / 2);
  };
  if (!hole) return piece(x0, x1, z0, z1);
  const [hx0, hx1, hz0, hz1] = hole;
  piece(x0, hx0, z0, z1); piece(hx1, x1, z0, z1);
  piece(hx0, hx1, z0, hz0); piece(hx0, hx1, hz1, z1);
}

/** Open-topped rectangular basin hanging below a counter hole. */
function basin(k, hx0, hx1, hz0, hz1, yTop, depth, name, wall = 0.012) {
  const w = hx1 - hx0, d = hz1 - hz0, cx = (hx0 + hx1) / 2, cz = (hz0 + hz1) / 2, yb = yTop - depth;
  k.add(rbox(w + 2 * wall, wall, d + 2 * wall, 0.004, 1), name, cx, yb - wall / 2, cz);
  for (const s of [-1, 1]) {
    k.add(rbox(wall, depth, d + 2 * wall, 0.002, 1), name, cx + s * (w / 2 + wall / 2), yb + depth / 2 - 0.002, cz);
    k.add(rbox(w, depth, wall, 0.002, 1), name, cx, yb + depth / 2 - 0.002, cz + s * (d / 2 + wall / 2));
  }
  k.add(cyl(0.035, 0.035, 0.004, 16), 'steelBrushed', cx, yb + 0.002, cz);
  k.add(cyl(0.02, 0.02, 0.005, 12), 'ironBlack', cx, yb + 0.003, cz);
}

/** Bridge faucet with cross handles; deck at (x, y, z), spout reaching +Z by `reach`. */
function bridgeFaucet(k, x, y, z, reach = 0.22, metal = 'brass') {
  for (const s of [-1, 1]) {
    k.add(lathe([[0, 0], [0.026, 0], [0.026, 0.008], [0.016, 0.014], [0.014, 0.1], [0, 0.1]], 12), metal, x + s * 0.1, y, z);
    // Cross handle.
    k.rod([x + s * 0.1, y + 0.1, z], [x + s * 0.1, y + 0.13, z], 0.007, metal, 8);
    for (const a of [0, Math.PI / 2]) k.rod([x + s * 0.1 - Math.cos(a) * 0.035, y + 0.13, z - Math.sin(a) * 0.035], [x + s * 0.1 + Math.cos(a) * 0.035, y + 0.13, z + Math.sin(a) * 0.035], 0.004, metal, 6);
    for (const a of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI]) k.add(sphere(0.007, 8, 6), metal, x + s * 0.1 + Math.cos(a) * 0.035, y + 0.13, z + Math.sin(a) * 0.035);
  }
  k.rod([x - 0.1, y + 0.07, z], [x + 0.1, y + 0.07, z], 0.011, metal, 10);
  k.add(cyl(0.014, 0.016, 0.05, 12), metal, x, y + 0.07, z);
  k.add(tube([[x, y + 0.07, z], [x, y + 0.26, z + 0.01], [x, y + 0.31, z + reach * 0.45], [x, y + 0.25, z + reach * 0.9], [x, y + 0.2, z + reach]], 0.011, 22, 8), metal);
  k.add(cyl(0.013, 0.011, 0.025, 10), metal, x, y + 0.19, z + reach);
}

/** Gooseneck single-lever faucet (island prep sink). */
function goosenecFaucet(k, x, y, z, metal = 'brass') {
  k.add(lathe([[0, 0], [0.03, 0], [0.03, 0.006], [0.018, 0.012], [0.016, 0.06], [0, 0.06]], 12), metal, x, y, z);
  k.add(tube([[x, y + 0.05, z], [x, y + 0.3, z], [x, y + 0.38, z + 0.08], [x, y + 0.3, z + 0.17], [x, y + 0.23, z + 0.18]], 0.01, 20, 8), metal);
  k.rod([x + 0.017, y + 0.08, z], [x + 0.07, y + 0.1, z], 0.005, metal, 6);
}

/** Base cabinet carcass block (hidden behind fronts) + toe kick. */
function baseCarcass(k, x0, x1, zb, zf, top, cab) {
  const w = x1 - x0, cx = (x0 + x1) / 2;
  k.add(rbox(w, 0.1, zf - zb - 0.07, 0.002, 1), cab, cx, 0.05, (zb + zf - 0.07) / 2);
  k.add(rbox(w, top - 0.1, zf - zb, 0.002, 1), cab, cx, 0.1 + (top - 0.1) / 2, (zb + zf) / 2);
}

/** Cabinet fronts for one module [x0,x1] at front plane zf. kind: drawers | doorDrawer | doors. */
function baseFronts(k, x0, x1, zf, top, kind, cab, hw) {
  const w = x1 - x0, cx = (x0 + x1) / 2, g = 0.004, y0 = 0.1;
  const H = top - y0;
  if (kind === 'drawers') {
    const hs = [0.18, 0.27, H - 0.45];
    let y = top;
    for (const h of hs) {
      shakerDoor(k, cx, y - h / 2, zf, w - g, h - g, cab, 0.02, Math.min(0.055, h * 0.28));
      cupPull(k, cx, y - Math.min(h / 2, 0.08), zf + 0.02, hw);
      y -= h;
    }
  } else {
    const dh = 0.18;
    shakerDoor(k, cx, top - dh / 2, zf, w - g, dh - g, cab, 0.02, 0.05);
    cupPull(k, cx, top - dh / 2, zf + 0.02, hw);
    const nd = w > 0.62 ? 2 : 1, dw = w / nd, h2 = H - dh;
    for (let i = 0; i < nd; i++) {
      const x = x0 + dw * (i + 0.5);
      shakerDoor(k, x, y0 + h2 / 2, zf, dw - g, h2 - g, cab, 0.02, 0.065);
      const kx = nd === 2 ? (i === 0 ? x + dw / 2 - 0.045 : x - dw / 2 + 0.045) : x + dw / 2 - 0.05;
      barPull(k, kx, y0 + h2 - 0.12, zf + 0.02, 0.13, hw, true);
    }
  }
}

/** Split a span into modules of roughly `target` width. */
function modules(x0, x1, target = 0.6) {
  const n = Math.max(1, Math.round((x1 - x0) / target)); const w = (x1 - x0) / n;
  return Array.from({ length: n }, (_, i) => [x0 + i * w, x0 + (i + 1) * w]);
}

/** Open shelf decor along a shelf. */
function shelfDecor(k, x0, x1, y, z, rand) {
  let x = x0 + 0.05;
  while (x < x1 - 0.1) {
    const r = rand();
    if (r < 0.28) { const hgt = 0.12 + rand() * 0.14; vase(k, x + 0.05, y, z, hgt, 0.05 + rand() * 0.02, rand() < 0.5 ? 'porcelain' : 'terracottaPot', Math.floor(rand() * 3)); x += 0.15; }
    else if (r < 0.5) { smallPlant(k, x + 0.06, y, z, 0.09, rand, rand() < 0.5 ? 'terracottaPot' : 'porcelain'); x += 0.2; }
    else if (r < 0.72) {
      // Stack of bowls.
      for (let i = 0; i < 3; i++) k.add(lathe([[0, 0], [0.04, 0], [0.085, 0.035], [0.09, 0.045], [0.08, 0.045], [0.04, 0.01], [0, 0.01]], 16), 'porcelain', x + 0.09, y + i * 0.022, z);
      x += 0.22;
    } else if (r < 0.86) {
      // Jars with wooden lids.
      for (let i = 0; i < 2; i++) {
        const hj = 0.14 + i * 0.04;
        k.add(cyl(0.045, 0.045, hj, 14), 'glassClear', x + 0.05 + i * 0.1, y + hj / 2, z);
        k.add(cyl(0.047, 0.047, 0.02, 14), 'oak', x + 0.05 + i * 0.1, y + hj + 0.01, z);
      }
      x += 0.24;
    } else { bookStack(k, x + 0.12, y, z, 3, rand); x += 0.26; }
    x += 0.04 + rand() * 0.06;
  }
}

function kitchenRun(params = {}, mat) {
  const w = params.w ?? 3.0, d = params.d ?? 0.62;
  const cab = params.cabinet || 'cabinetGreen', top = params.top || 'marbleWhite', hw = params.hardware || 'brass';
  const shelfWood = params.shelves || 'walnut';
  const k = new Kit(mat); const rand = rng(seedOf('kitchenRun', params));
  const zb = -d / 2, zf = d / 2 - 0.04, cTop = COUNTER_Y - 0.03;
  const tall = params.tall === 'fridge' || params.tall === 'pantry' ? params.tall : null;
  const tallSide = params.tallSide === 'left' ? -1 : 1;
  const tw = tall ? Math.min(0.78, w * 0.4) : 0;
  let bx0 = -w / 2, bx1 = w / 2;
  if (tall && tallSide > 0) bx1 -= tw; else if (tall) bx0 += tw;
  const L = bx1 - bx0;
  const place = (v, frac) => v === true ? bx0 + L * frac : typeof v === 'number' ? Math.max(bx0, Math.min(bx1, v)) : null;
  let sinkX = place(params.sink, params.cooktop ? 0.28 : 0.5), cookX = place(params.cooktop, params.sink ? 0.72 : 0.5);
  const sinkW = 0.84, cookW = 0.76;
  if (sinkX != null) sinkX = Math.max(bx0 + sinkW / 2, Math.min(bx1 - sinkW / 2, sinkX));
  if (cookX != null) cookX = Math.max(bx0 + cookW / 2, Math.min(bx1 - cookW / 2, cookX));
  // Features as occupied spans.
  const feats = [];
  if (sinkX != null) feats.push({ kind: 'sink', x0: sinkX - sinkW / 2, x1: sinkX + sinkW / 2 });
  if (cookX != null) feats.push({ kind: 'cook', x0: cookX - cookW / 2, x1: cookX + cookW / 2 });
  feats.sort((a, b) => a.x0 - b.x0);
  // Remaining spans → cabinet modules.
  const spans = []; let cur = bx0;
  for (const f of feats) { if (f.x0 - cur > 0.15) spans.push([cur, f.x0]); cur = Math.max(cur, f.x1); }
  if (bx1 - cur > 0.15) spans.push([cur, bx1]);
  let mi = 0;
  for (const [a, b] of spans) {
    baseCarcass(k, a, b, zb, zf, cTop, cab);
    for (const [m0, m1] of modules(a, b)) baseFronts(k, m0, m1, zf, cTop, mi++ % 3 === 0 ? 'drawers' : 'doorDrawer', cab, hw);
  }
  // Counter (with sink hole) — runs over the base span only.
  let hole = null;
  const sf = feats.find(f => f.kind === 'sink');
  if (sf) hole = [sf.x0 + 0.04, sf.x1 - 0.04, zb + 0.12, d / 2 + 0.01];
  const cf = feats.find(f => f.kind === 'cook');
  const cParts = cf ? [[bx0, cf.x0], [cf.x1, bx1]] : [[bx0, bx1]];
  for (const [a, b] of cParts) {
    const hh = hole && hole[0] >= a - 1e-6 && hole[1] <= b + 1e-6 ? hole : null;
    counter(k, a, b, zb, d / 2, COUNTER_Y, 0.03, top, hh);
  }
  if (sf) {
    // Farmhouse apron sink in porcelain, cabinet doors below.
    const sx0 = sf.x0, sx1 = sf.x1, cx = (sx0 + sx1) / 2, ih = 0.24;
    const [hx0, hx1, hz0] = hole; const hz1 = zf + 0.02 - 0.03;
    baseCarcass(k, sx0, sx1, zb, zf, COUNTER_Y - ih - 0.04, cab);
    basin(k, hx0, hx1, hz0, hz1, COUNTER_Y, ih, 'porcelain', 0.02);
    k.add(rbox(hx1 - hx0 + 0.04, ih + 0.02, 0.03, 0.01, 2), 'porcelain', cx, COUNTER_Y - (ih + 0.02) / 2, zf + 0.02 - 0.015 + 0.01);
    const dh = COUNTER_Y - ih - 0.04 - 0.1;
    for (const s of [-1, 1]) {
      shakerDoor(k, cx + s * (sx1 - sx0) / 4, 0.1 + dh / 2, zf, (sx1 - sx0) / 2 - 0.004, dh - 0.004, cab, 0.02, 0.065);
      barPull(k, cx + s * 0.045, 0.1 + dh - 0.1, zf + 0.02, 0.13, hw, true);
    }
    bridgeFaucet(k, cx, COUNTER_Y, zb + 0.065, 0.24, hw);
  }
  if (cf) {
    // Range: oven below, black cooktop with brass knobs and cast-iron grates.
    const cx = (cf.x0 + cf.x1) / 2, rw = cf.x1 - cf.x0;
    k.add(rbox(rw - 0.004, COUNTER_Y - 0.1, d - 0.05, 0.004, 1), 'ironBlack', cx, 0.1 + (COUNTER_Y - 0.1) / 2, zb + (d - 0.05) / 2);
    k.add(rbox(rw - 0.02, 0.1, d - 0.12, 0.002, 1), 'ironBlack', cx, 0.05, zb + (d - 0.12) / 2);
    k.add(rbox(rw - 0.03, 0.5, 0.02, 0.006, 1), 'steelBrushed', cx, 0.38, zf + 0.0);
    k.add(rbox(rw - 0.2, 0.22, 0.006, 0.003, 1), 'graniteBlack', cx, 0.38, zf + 0.012);
    k.rod([cx - rw / 2 + 0.07, 0.6, zf + 0.05], [cx + rw / 2 - 0.07, 0.6, zf + 0.05], 0.009, hw, 10);
    for (const s of [-1, 1]) k.rod([cx + s * (rw / 2 - 0.09), 0.6, zf + 0.01], [cx + s * (rw / 2 - 0.09), 0.6, zf + 0.05], 0.006, hw, 6);
    k.add(rbox(rw - 0.03, 0.12, 0.02, 0.004, 1), 'ironBlack', cx, 0.74, zf);
    for (let i = 0; i < 5; i++) knob(k, cx - rw / 2 + 0.1 + i * (rw - 0.2) / 4, 0.74, zf + 0.01, hw, 1.3);
    k.add(rbox(rw, 0.03, d, 0.004, 1), 'graniteBlack', cx, COUNTER_Y - 0.015, 0);
    const grate = (gx, gz) => {
      for (const s of [-1, 1]) {
        k.rod([gx - 0.15, COUNTER_Y + 0.025, gz + s * 0.12], [gx + 0.15, COUNTER_Y + 0.025, gz + s * 0.12], 0.006, 'ironBlack', 4);
        k.rod([gx + s * 0.15, COUNTER_Y + 0.025, gz - 0.12], [gx + s * 0.15, COUNTER_Y + 0.025, gz + 0.12], 0.006, 'ironBlack', 4);
      }
      k.rod([gx - 0.15, COUNTER_Y + 0.025, gz], [gx + 0.15, COUNTER_Y + 0.025, gz], 0.006, 'ironBlack', 4);
      k.rod([gx, COUNTER_Y + 0.025, gz - 0.12], [gx, COUNTER_Y + 0.025, gz + 0.12], 0.006, 'ironBlack', 4);
    };
    grate(cx - rw / 4 + 0.0, 0.0); grate(cx + rw / 4, 0.0);
    for (const s of [-1, 1]) for (const t of [-1, 1]) {
      k.add(cyl(0.045, 0.05, 0.02, 16), 'ironBlack', cx + s * rw / 4, COUNTER_Y + 0.01, t * 0.13);
      k.add(cyl(0.03, 0.03, 0.008, 12), 'brassAged', cx + s * rw / 4, COUNTER_Y + 0.022, t * 0.13);
    }
  }
  // Backsplash.
  const uppers = !!params.uppers;
  const upY0 = 1.45, upY1 = 2.3, upD = 0.34;
  const bsTop = uppers ? upY1 : COUNTER_Y + 0.5;
  k.add(rbox(L, bsTop - COUNTER_Y, 0.015, 0, 1), top, (bx0 + bx1) / 2, (COUNTER_Y + bsTop) / 2, zb + 0.0075);
  if (uppers) {
    const hood = cf ? [cf.x0 - 0.12, cf.x1 + 0.12] : null;
    const uspans = [];
    if (hood) { if (hood[0] - bx0 > 0.25) uspans.push([bx0, hood[0], 'right']); if (bx1 - hood[1] > 0.25) uspans.push([hood[1], bx1, 'left']); }
    else uspans.push([bx0, bx1, null]);
    const zu = zb + 0.015;
    for (const [a, b, near] of uspans) {
      // Near the hood (or centre when no hood): open walnut shelves; the rest: cabinets.
      let shelf = null;
      if (near === 'right') shelf = [Math.max(a, b - 0.9), b];
      else if (near === 'left') shelf = [a, Math.min(b, a + 0.9)];
      else if (b - a > 2.2) { const m = (a + b) / 2; shelf = [m - 0.45, m + 0.45]; }
      const cabSpans = [];
      if (!shelf) cabSpans.push([a, b]);
      else { if (shelf[0] - a > 0.25) cabSpans.push([a, shelf[0]]); else shelf[0] = a; if (b - shelf[1] > 0.25) cabSpans.push([shelf[1], b]); else shelf[1] = b; }
      if (shelf) {
        for (const sy of [1.55, 1.95]) {
          k.add(rbox(shelf[1] - shelf[0], 0.045, 0.28, 0.006, 1), shelfWood, (shelf[0] + shelf[1]) / 2, sy - 0.0225, zu + 0.14);
          shelfDecor(k, shelf[0], shelf[1], sy, zu + 0.14, rand);
        }
      }
      for (const [c0, c1] of cabSpans) {
        const cw = c1 - c0, cx = (c0 + c1) / 2, hU = upY1 - upY0;
        k.add(rbox(cw, hU - 0.06, upD - 0.02, 0.002, 1), cab, cx, upY0 + (hU - 0.06) / 2, zu + (upD - 0.02) / 2);
        for (const [m0, m1] of modules(c0, c1, 0.5)) {
          const mx = (m0 + m1) / 2;
          shakerDoor(k, mx, upY0 + (hU - 0.06) / 2, zu + upD - 0.02, m1 - m0 - 0.004, hU - 0.064, cab, 0.02, 0.06);
          knob(k, mx + (m1 - m0) / 2 - 0.045, upY0 + 0.07, zu + upD, hw);
        }
        k.add(rbox(cw + 0.02, 0.03, upD + 0.03, 0.006, 1), cab, cx, upY1 - 0.045, zu + (upD + 0.03) / 2);
        k.add(rbox(cw + 0.04, 0.03, upD + 0.05, 0.008, 2), cab, cx, upY1 - 0.015, zu + (upD + 0.05) / 2);
        k.light(cx, upY0 - 0.03, zu + upD - 0.08, { intensity: 1.2, distance: 2, kind: 'spot', color: '#ffe0b8' });
      }
    }
  }
  // Tall unit (integrated fridge or pantry) at one end.
  if (tall) {
    const tx0 = tallSide > 0 ? w / 2 - tw : -w / 2, tx1 = tx0 + tw, tcx = (tx0 + tx1) / 2;
    const tH = 2.3;
    k.add(rbox(tw, tH - 0.1, d - 0.04, 0.002, 1), cab, tcx, 0.1 + (tH - 0.1) / 2, -0.02);
    k.add(rbox(tw, 0.1, d - 0.11, 0.002, 1), cab, tcx, 0.05, -0.055);
    if (tall === 'fridge') {
      const split = 1.5;
      for (const s of [-1, 1]) {
        shakerDoor(k, tcx + s * tw / 4, split + (tH - 0.05 - split) / 2, zf, tw / 2 - 0.004, tH - 0.05 - split - 0.004, cab, 0.02, 0.07);
        barPull(k, tcx - s * 0.035, split + 0.35, zf + 0.02, 0.45, hw, true);
      }
      shakerDoor(k, tcx, 0.1 + (split - 0.1) / 2, zf, tw - 0.004, split - 0.1 - 0.004, cab, 0.02, 0.07);
      barPull(k, tcx, split - 0.12, zf + 0.02, 0.4, hw, false);
    } else {
      const split = 1.85;
      for (const s of [-1, 1]) {
        shakerDoor(k, tcx + s * tw / 4, 0.1 + (split - 0.1) / 2, zf, tw / 2 - 0.004, split - 0.1 - 0.004, cab, 0.02, 0.07);
        barPull(k, tcx - s * 0.035, 1.05, zf + 0.02, 0.3, hw, true);
        shakerDoor(k, tcx + s * tw / 4, split + (tH - 0.05 - split) / 2, zf, tw / 2 - 0.004, tH - 0.05 - split - 0.004, cab, 0.02, 0.06);
        knob(k, tcx - s * 0.035, split + 0.07, zf + 0.02, hw);
      }
    }
    k.add(rbox(tw + 0.01, 0.05, d - 0.0, 0.008, 2), cab, tcx, tH - 0.025, 0.0);
  }
  const hMax = tall || uppers ? 2.3 : COUNTER_Y;
  return k.build('kitchenRun', { w, d, h: hMax, solid: true }, {
    counter: COUNTER_Y, sink: sinkX, cooktop: cookX, tall, uppers,
  });
}

function kitchenIsland(params = {}, mat) {
  const w = params.w ?? 2.8, d = params.d ?? 1.1, h = params.h ?? 0.92;
  const cab = params.cabinet || 'cabinetGreen', top = params.top || 'marbleWhite', hw = params.hardware || 'brass';
  const flute = params.back || 'oak';
  const k = new Kit(mat);
  const over = Math.min(0.32, d * 0.3);
  const zb = -d / 2 + over, zf = d / 2 - 0.05, bx = w / 2 - 0.05;
  const tT = 0.04, cTop = h - tT;
  // Carcass + toe kick.
  k.add(rbox(2 * bx - 0.04, 0.1, zf - zb - 0.12, 0.002, 1), cab, 0, 0.05, (zb + zf) / 2);
  k.add(rbox(2 * bx, cTop - 0.1, zf - zb, 0.003, 1), cab, 0, 0.1 + (cTop - 0.1) / 2, (zb + zf) / 2);
  // Ends: framed panels.
  for (const s of [-1, 1]) {
    k.add(rbox(0.03, cTop, zf - zb + 0.04, 0.006, 1), cab, s * (bx + 0.015), cTop / 2, (zb + zf) / 2 + 0.0);
    k.at(s * (bx + 0.03), 0, (zb + zf) / 2, s * Math.PI / 2, () => {
      shakerDoor(k, 0, 0.1 + (cTop - 0.14) / 2, 0, zf - zb - 0.06, cTop - 0.16, cab, 0.015, 0.07);
    });
  }
  // Working side fronts (+Z).
  let sinkHole = null;
  const mods = modules(-bx, bx, 0.6);
  // sink: null | 'front' (+Z working side) | 'back' (−Z seating side). Legacy `true` = 'front'.
  const sinkSide = params.sink === 'back' ? 'back' : params.sink ? 'front' : null;
  const sinkI = sinkSide === 'front' ? Math.floor(mods.length / 2) : -1;
  if (sinkSide === 'back') { const [m0, m1] = mods[Math.floor(mods.length / 2)]; const cx = -(m0 + m1) / 2; sinkHole = [cx - 0.22, cx + 0.22, -0.02, 0.36]; }
  mods.forEach(([m0, m1], i) => {
    if (i === sinkI) {
      const cx = (m0 + m1) / 2; const H = cTop - 0.1;
      for (const s of [-1, 1]) {
        shakerDoor(k, cx + s * (m1 - m0) / 4, 0.1 + H / 2, zf, (m1 - m0) / 2 - 0.004, H - 0.004, cab, 0.02, 0.065);
        barPull(k, cx + s * 0.04, 0.1 + H - 0.12, zf + 0.02, 0.13, hw, true);
      }
      sinkHole = [cx - 0.22, cx + 0.22, -0.02, 0.36];
    } else baseFronts(k, m0, m1, zf, cTop, i % 2 === 0 ? 'drawers' : 'doorDrawer', cab, hw);
  });
  // Seating side (−Z): fluted wood panel.
  const nF = Math.floor((2 * bx) / 0.035);
  const fl = cyl(0.0175, 0.0175, cTop - 0.12, 6, false, -Math.PI / 2, Math.PI);
  for (let i = 0; i < nF; i++) {
    const x = -bx + 0.0175 + i * (2 * bx - 0.035) / (nF - 1);
    k.add(fl, flute, x, 0.1 + (cTop - 0.12) / 2, zb - 0.001, 0, Math.PI, 0);
  }
  k.add(rbox(2 * bx + 0.02, 0.03, 0.03, 0.006, 1), flute, 0, cTop - 0.025, zb - 0.01);
  k.add(rbox(2 * bx + 0.02, 0.1, 0.02, 0.004, 1), flute, 0, 0.05, zb + 0.005);
  // Top with overhang to the seating side.
  const tg = rbox(w, tT, d, 0.01, 2);
  if (!sinkHole) k.add(tg, top, 0, h - tT / 2, 0);
  else {
    // Built in the 'front' frame; a 'back' sink is the same assembly turned 180° about Y.
    k.at(0, 0, 0, sinkSide === 'back' ? Math.PI : 0, () => {
      const [hx0, hx1, hz0, hz1] = sinkHole;
      counter(k, -w / 2, w / 2, -d / 2, d / 2, h, tT, top, sinkHole);
      basin(k, hx0, hx1, hz0, hz1, h - 0.005, 0.2, 'steelBrushed', 0.01);
      // Undermount rim: polished steel lip just inside the stone cut-out.
      for (const s of [-1, 1]) {
        k.add(rbox(hx1 - hx0, 0.012, 0.005, 0.0015, 1), 'chrome', (hx0 + hx1) / 2, h - tT - 0.004, (s < 0 ? hz0 : hz1) - s * 0.0025);
        k.add(rbox(0.005, 0.012, hz1 - hz0, 0.0015, 1), 'chrome', (s < 0 ? hx0 : hx1) - s * 0.0025, h - tT - 0.004, (hz0 + hz1) / 2);
      }
      goosenecFaucet(k, (hx0 + hx1) / 2, h, hz0 - 0.06, hw);
    });
  }
  // Corbels under the overhang.
  const corbel = new THREE.Shape();
  corbel.moveTo(0, 0); corbel.lineTo(0, 0.22); corbel.lineTo(over - 0.03, 0.22); corbel.quadraticCurveTo(over * 0.35, 0.18, 0.04, 0.0); corbel.lineTo(0, 0);
  const cg = new THREE.ExtrudeGeometry(corbel, { depth: 0.05, bevelEnabled: false, curveSegments: 6 });
  cg.translate(0, 0, -0.025);
  for (const x of [-bx + 0.15, 0, bx - 0.15]) if (Math.abs(x) < bx) k.add(cg, flute, x, cTop - 0.22, zb - 0.02, 0, Math.PI / 2, 0);
  return k.build('kitchenIsland', { w, d, h, solid: true }, { seatingSide: '-Z', sink: sinkSide });
}

function barStool(params = {}, mat) {
  const h = params.h ?? 0.75, wood = params.frame || 'oak', seat = params.seat || 'leatherCognac';
  const k = new Kit(mat);
  const sy = h - 0.06;
  k.add(lathe([[0, 0], [0.17, 0], [0.18, 0.012], [0.18, 0.03], [0, 0.03]], 24), wood, 0, sy - 0.03, 0);
  k.add(lathe([[0, 0], [0.175, 0], [0.185, 0.02], [0.18, 0.04], [0.15, 0.058], [0.08, 0.064], [0, 0.065]], 24), seat, 0, sy - 0.003, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4; const c = Math.cos(a), s = Math.sin(a);
    k.rod([c * 0.13, sy - 0.03, s * 0.13], [c * 0.195, 0, s * 0.195], 0.017, wood, 8, 0.014);
  }
  k.add(torus(0.172, 0.011, 6, 32), wood, 0, 0.26, 0, Math.PI / 2, 0, 0);
  k.add(torus(0.172, 0.0115, 6, 32), 'brassAged', 0, 0.26, 0, Math.PI / 2, 0, 0, 1.0, 1.0, 0.6);
  for (let i = 0; i < 2; i++) {
    const a = (i / 2) * Math.PI + Math.PI / 4; const c = Math.cos(a), s = Math.sin(a);
    k.rod([c * 0.155, 0.48, s * 0.155], [-c * 0.155, 0.48, -s * 0.155], 0.009, wood, 6);
  }
  return k.build('barStool', { w: 0.42, d: 0.42, h, solid: true });
}

function rangeHood(params = {}, mat) {
  const w = params.w ?? 1.0, d = params.d ?? 0.55, h = params.h ?? 1.2;
  const y0 = params.y ?? 1.55; const name = params.mat || 'cabinetCream'; const trim = params.trim || 'walnut';
  const k = new Kit(mat);
  const bandH = 0.17;
  // Mantle band with wood ledge.
  k.add(rbox(w, bandH, d, 0.008, 1), name, 0, y0 + bandH / 2, d / 2);
  k.add(rbox(w + 0.05, 0.05, d + 0.025, 0.01, 2), trim, 0, y0 + bandH + 0.025, (d + 0.025) / 2);
  k.add(rbox(w + 0.02, 0.025, d + 0.01, 0.006, 1), name, 0, y0 + 0.0125, (d + 0.01) / 2);
  // Tapered chimney: back stays on the wall.
  const ch = h - bandH - 0.05; const cy0 = y0 + bandH + 0.05;
  const g = new THREE.BoxGeometry(w * 0.94, ch, d - 0.04, 1, 4, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + ch / 2) / ch; const e = 1 - (1 - t) ** 2;   // concave sweep
    const sx = 1 - 0.42 * e, sz = 1 - 0.55 * e;
    p.setX(i, p.getX(i) * sx);
    p.setZ(i, -(d - 0.04) / 2 + (p.getZ(i) + (d - 0.04) / 2) * sz);
  }
  g.computeVertexNormals();
  k.add(g, name, 0, cy0 + ch / 2, (d - 0.04) / 2);
  // Underside: steel insert and two lamp discs.
  k.add(rbox(w - 0.08, 0.01, d - 0.08, 0.002, 1), 'steelBrushed', 0, y0 - 0.004, d / 2);
  for (const s of [-1, 1]) k.add(cyl(0.03, 0.03, 0.006, 14), 'bulbWarm', s * w * 0.25, y0 - 0.01, d / 2 + 0.05);
  k.light(0, y0 - 0.1, d / 2 + 0.05, { intensity: 2.5, distance: 3, kind: 'spot', color: '#ffe2bd' });
  return k.build('rangeHood', { w, d, h, solid: false, mount: 'wall' });
}

export const KITCHEN = { kitchenRun, kitchenIsland, barStool, rangeHood };
export const INFO = {
  kitchenRun: { w: 3.0, d: 0.62, h: 0.9, mount: 'floor', solid: true },
  kitchenIsland: { w: 2.8, d: 1.1, h: 0.92, mount: 'floor', solid: true },
  barStool: { w: 0.42, d: 0.42, h: 0.75, mount: 'floor', solid: true },
  rangeHood: { w: 1.0, d: 0.55, h: 1.2, mount: 'wall', solid: false },
};
void slabFront;
