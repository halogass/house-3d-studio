// Lighting: table / floor / banker's lamps, chandeliers, pendant, ceiling fan, sconce; functional
// ceiling LEDs (linear batten, square panel, industrial high-bay pendant).
// Every fixture declares userData.lights (local positions). Ceiling items hang from params.ceiling.
import * as THREE from 'three';
import {
  Kit, TAU, lathe, cyl, sphere, torus, tube, rbox, doubleSided, flipped, pleatShade,
  candleBulb, flame, knob,
} from './decor.js';

const WARM = '#ffd8a8', CANDLE = '#ffc98a';

/** Ceiling canopy + returns the y of its underside. */
function canopy(k, C, r = 0.07, name = 'ironBlack') {
  k.add(lathe([[0, 0], [r * 0.35, 0], [r * 0.9, 0.02], [r, 0.045], [r, 0.05], [0, 0.05]], 20), name, 0, C - 0.05, 0);
  return C - 0.05;
}
/** Chain of alternating links from y1 down to y0. */
function chain(k, y1, y0, name = 'brassAged', s = 1) {
  const L = 0.045 * s; let y = y1 - L / 2; let i = 0;
  const link = torus(0.014 * s, 0.0035 * s, 4, 8);
  while (y - L / 2 > y0 - 1e-3) {
    k.add(link, name, 0, y, 0, 0, i % 2 ? Math.PI / 2 : 0, 0, 1, 1.45, 1);
    y -= L * 0.72; i++;
  }
}

function tableLamp(params = {}, mat) {
  const y0 = params.y ?? 0; const k = new Kit(mat);
  const brassBase = params.base === 'brass';
  if (brassBase) {
    // Candlestick-style turned brass base on a square marble foot.
    k.box(0.15, 0.03, 0.15, 'marbleWhite', 0, y0, 0, 0.005, 1);
    k.add(lathe([[0, 0], [0.06, 0], [0.065, 0.012], [0.03, 0.03], [0.022, 0.06], [0.045, 0.1], [0.03, 0.13], [0.016, 0.16], [0.018, 0.27],
      [0.032, 0.29], [0.02, 0.31], [0.011, 0.33], [0, 0.33]], 18), 'brass', 0, y0 + 0.03, 0);
  } else {
    // Ginger-jar ceramic base on a small turned wood stand.
    k.add(lathe([[0, 0], [0.07, 0], [0.075, 0.01], [0.07, 0.025], [0.055, 0.03], [0, 0.03]], 18), 'walnut', 0, y0, 0);
    k.add(lathe([[0, 0], [0.055, 0], [0.085, 0.04], [0.105, 0.11], [0.1, 0.18], [0.075, 0.24], [0.045, 0.27], [0.04, 0.29], [0.02, 0.3], [0, 0.3]], 24), params.mat || 'porcelain', 0, y0 + 0.03, 0);
    k.add(lathe([[0, 0], [0.024, 0], [0.024, 0.015], [0.012, 0.025], [0.009, 0.03], [0, 0.03]], 12), 'brass', 0, y0 + 0.33, 0);
  }
  // Socket, harp, shade, finial.
  k.add(cyl(0.006, 0.006, 0.05, 8), 'brass', 0, y0 + 0.375, 0);
  k.add(cyl(0.017, 0.017, 0.045, 12), 'brass', 0, y0 + 0.41, 0);
  candleBulb(k, 0, y0 + 0.425, 0, 1.0);
  const sb = y0 + 0.345, sh = 0.245;
  k.add(pleatShade(0.17, 0.115, sh, 26, 0.03), 'lampShade', 0, sb + sh / 2, 0);
  k.add(torus(0.17, 0.003, 4, 48), 'lampShade', 0, sb + 0.002, 0, Math.PI / 2, 0, 0);
  k.add(torus(0.115, 0.003, 4, 40), 'lampShade', 0, sb + sh - 0.002, 0, Math.PI / 2, 0, 0);
  k.rod([-0.11, sb + sh, 0], [0.11, sb + sh, 0], 0.0018, 'brass', 4);
  k.rod([0, y0 + 0.39, 0], [0, sb + sh + 0.005, 0], 0.003, 'brass', 6);
  k.add(lathe([[0, 0], [0.008, 0], [0.004, 0.006], [0.01, 0.014], [0.006, 0.022], [0, 0.026]], 10), 'brass', 0, sb + sh, 0);
  k.light(0, y0 + 0.45, 0, { intensity: 4, distance: 4, kind: 'lamp', color: WARM });
  return k.build('tableLamp', { w: 0.35, d: 0.35, h: 0.6, solid: false });
}

function floorLamp(params = {}, mat) {
  const k = new Kit(mat); const metal = params.metal || 'ironBlack';
  k.add(lathe([[0, 0], [0.15, 0], [0.155, 0.012], [0.145, 0.025], [0.06, 0.035], [0.035, 0.05], [0.03, 0.07], [0, 0.07]], 28), metal, 0, 0, 0);
  k.add(lathe([[0.014, 0], [0.014, 1.05], [0.02, 1.07], [0.012, 1.09], [0.012, 1.27], [0.0, 1.27]], 10), metal, 0, 0.07, 0);
  k.add(lathe([[0, 0], [0.016, 0], [0.024, 0.02], [0.016, 0.03], [0, 0.03]], 12), 'brass', 0, 0.62, 0);
  k.add(cyl(0.018, 0.018, 0.05, 12), metal, 0, 1.36, 0);
  candleBulb(k, 0, 1.385, 0, 1.1);
  const sb = 1.27, sh = 0.31;
  k.add(doubleSided(cyl(0.175, 0.2, sh, 40, true)), 'lampShade', 0, sb + sh / 2, 0);
  k.add(torus(0.2, 0.003, 4, 48), 'lampShade', 0, sb + 0.002, 0, Math.PI / 2, 0, 0);
  k.add(torus(0.175, 0.003, 4, 48), 'lampShade', 0, sb + sh - 0.002, 0, Math.PI / 2, 0, 0);
  for (const a of [0, Math.PI / 2]) k.rod([-0.17 * Math.cos(a), sb + sh - 0.01, -0.17 * Math.sin(a)], [0.17 * Math.cos(a), sb + sh - 0.01, 0.17 * Math.sin(a)], 0.0018, metal, 4);
  k.add(lathe([[0, 0], [0.01, 0], [0.012, 0.012], [0, 0.022]], 10), metal, 0, sb + sh - 0.01, 0);
  k.light(0, 1.42, 0, { intensity: 5, distance: 5, kind: 'lamp', color: WARM });
  return k.build('floorLamp', { w: 0.4, d: 0.4, h: 1.6, solid: true });
}

function bankersLamp(params = {}, mat) {
  const y0 = params.y ?? 0; const k = new Kit(mat);
  const glass = params.shade || 'lacquer:#1e5a3c';
  k.add(rbox(0.26, 0.025, 0.16, 0.012, 2), 'brass', 0, y0 + 0.0125, 0);
  k.add(rbox(0.2, 0.012, 0.11, 0.008, 2), 'brass', 0, y0 + 0.03, 0);
  k.add(lathe([[0, 0], [0.012, 0], [0.012, 0.22], [0.016, 0.23], [0.01, 0.24], [0, 0.24]], 10), 'brass', 0.0, y0 + 0.036, -0.03);
  k.rod([0, y0 + 0.27, -0.03], [0, y0 + 0.3, 0.0], 0.007, 'brass', 8);
  // Harp arms holding the shade.
  k.rod([-0.11, y0 + 0.3, 0], [0.11, y0 + 0.3, 0], 0.005, 'brass', 6);
  // Shade: half tube tilted forward, green glass outside, glowing cased white inside.
  k.at(0, y0 + 0.31, 0.01, 0, () => {
    const outer = cyl(0.085, 0.085, 0.28, 24, true, 0, Math.PI);
    k.add(outer, glass, 0, 0, 0, 0, 0, Math.PI / 2);
    k.add(flipped(outer, 0.96), 'lampShade', 0, 0, 0, 0, 0, Math.PI / 2);
    for (const s of [-1, 1]) {
      const cap = new THREE.CircleGeometry(0.085, 12, 0, Math.PI);
      k.add(cap, glass, s * 0.14, 0, 0, 0, s * Math.PI / 2, 0);
      k.add(cap, glass, s * 0.1395, 0, 0, 0, -s * Math.PI / 2, 0);
    }
    k.add(torus(0.085, 0.003, 4, 20, Math.PI), 'brass', 0.141, 0, 0, 0, Math.PI / 2, 0);
    k.add(torus(0.085, 0.003, 4, 20, Math.PI), 'brass', -0.141, 0, 0, 0, Math.PI / 2, 0);
    k.add(cyl(0.012, 0.012, 0.16, 8), 'bulbWarm', 0, 0.035, 0, 0, 0, Math.PI / 2);
  }, -0.25);
  // Pull chain with brass bead.
  k.rod([0.05, y0 + 0.28, 0.07], [0.05, y0 + 0.18, 0.08], 0.0012, 'brass', 4);
  k.add(sphere(0.006, 8, 6), 'brass', 0.05, y0 + 0.175, 0.08);
  k.light(0, y0 + 0.26, 0.04, { intensity: 2.5, distance: 3, kind: 'lamp', color: WARM });
  return k.build('bankersLamp', { w: 0.3, d: 0.2, h: 0.4, solid: false });
}

function chandelierRing(params = {}, mat) {
  const C = params.ceiling ?? 3.0; const k = new Kit(mat);
  const R = (params.w ?? 1.0) / 2 - 0.02; const n = params.candles ?? 12;
  const drop = params.drop ?? Math.min(1.3, Math.max(0.55, C - 2.3));
  const ry = C - drop + 0.0;                       // ring height
  const top = canopy(k, C, 0.075);
  const hubY = ry + Math.min(0.5, drop * 0.55);
  k.rod([0, top, 0], [0, hubY + 0.03, 0], 0.008, 'ironBlack', 8);
  k.add(lathe([[0, 0], [0.012, 0], [0.03, 0.015], [0.03, 0.03], [0.012, 0.045], [0, 0.045]], 14), 'ironBlack', 0, hubY - 0.015, 0);
  k.add(torus(R, 0.017, 8, 96), 'ironBlack', 0, ry, 0, Math.PI / 2, 0, 0);
  k.add(torus(R, 0.007, 6, 96), 'ironBlack', 0, ry - 0.035, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.26;
    k.rod([0, hubY, 0], [Math.cos(a) * R, ry + 0.015, Math.sin(a) * R], 0.004, 'ironBlack', 5);
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU; const x = Math.cos(a) * R, z = Math.sin(a) * R;
    if (i % 2 === 0) k.rod([x, ry - 0.035, z], [x, ry, z], 0.004, 'ironBlack', 5);
    k.add(lathe([[0, 0], [0.012, 0], [0.026, 0.012], [0.026, 0.016], [0.016, 0.016], [0.016, 0.02], [0, 0.02]], 12), 'ironBlack', x, ry + 0.012, z);
    k.add(cyl(0.012, 0.012, 0.085, 10, true), 'porcelain', x, ry + 0.074, z);
    candleBulb(k, x, ry + 0.115, z, 0.65);
  }
  k.light(0, ry + 0.12, 0, { intensity: 10, distance: 8, kind: 'chandelier', color: CANDLE, clear: R + 0.05 });
  const w = R * 2 + 0.06;
  return k.build('chandelierRing', { w, d: w, h: drop, solid: false, mount: 'ceiling' });
}

function chandelierCrystal(params = {}, mat) {
  const C = params.ceiling ?? 3.0; const k = new Kit(mat);
  const metal = params.metal || 'brass'; const n = params.arms ?? 8;
  const R = (params.w ?? 0.9) / 2 - 0.03;
  const drop = params.drop ?? Math.min(1.1, Math.max(0.75, C - 2.15));
  const yb = C - drop;                              // bottom of fixture
  const top = canopy(k, C, 0.08, metal);
  const colTop = yb + 0.62;
  chain(k, top, colTop, metal, 0.9);
  // Central baluster column.
  k.add(lathe([[0, 0], [0.012, 0.0], [0.03, 0.03], [0.022, 0.06], [0.05, 0.12], [0.075, 0.16], [0.08, 0.19], [0.06, 0.21], [0.03, 0.24],
    [0.02, 0.3], [0.04, 0.36], [0.05, 0.4], [0.035, 0.44], [0.015, 0.47], [0.03, 0.52], [0.028, 0.56], [0.012, 0.6], [0.02, 0.62], [0, 0.62]], 16), metal, 0, yb, 0);
  const glassCrystal = new THREE.OctahedronGeometry(0.014, 0);
  const prism = new THREE.OctahedronGeometry(0.02, 0);
  const armY = yb + 0.2, cupY = yb + 0.34;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU; const c = Math.cos(a), s = Math.sin(a);
    const P = (r, y) => [c * r, y, s * r];
    k.add(tube([P(0.06, armY), P(0.16, armY - 0.06), P(0.28, armY - 0.04), P(R - 0.02, armY + 0.04), P(R, cupY - 0.03)], 0.007, 16, 5), metal);
    // Scroll under each arm.
    k.add(tube([P(0.05, armY + 0.12), P(0.12, armY + 0.14), P(0.15, armY + 0.08), P(0.12, armY + 0.05)], 0.004, 10, 4), metal);
    const [x, , z] = P(R, 0);
    k.add(lathe([[0, 0], [0.012, 0], [0.03, 0.012], [0.042, 0.014], [0.042, 0.018], [0.018, 0.02], [0.016, 0.026], [0, 0.026]], 14), metal, x, cupY - 0.03, z);
    k.add(cyl(0.013, 0.013, 0.09, 10, true), 'porcelain', x, cupY + 0.04, z);
    candleBulb(k, x, cupY + 0.085, z, 0.7);
    // Drops under the bobeche.
    k.add(glassCrystal, 'crystal', x, cupY - 0.06, z, 0, 0, 0, 1, 2.2, 1);
    k.add(prism, 'crystal', x, cupY - 0.11, z, 0, a, 0, 0.6, 1.8, 0.25);
    pts.push([x, cupY - 0.025, z]);
  }
  // Festoons of crystals between bobeches.
  const bead = new THREE.OctahedronGeometry(0.008, 0);
  for (let i = 0; i < n; i++) {
    const A = pts[i], Bp = pts[(i + 1) % n];
    for (let j = 1; j < 6; j++) {
      const t = j / 6; const sag = Math.sin(t * Math.PI) * 0.08;
      k.add(bead, 'crystal', A[0] + (Bp[0] - A[0]) * t, A[1] - sag, A[2] + (Bp[2] - A[2]) * t);
    }
  }
  // Crystal basket under the column.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    k.add(glassCrystal, 'crystal', Math.cos(a) * 0.075, yb + 0.12, Math.sin(a) * 0.075, 0, 0, 0, 0.8, 2, 0.8);
  }
  k.add(prism, 'crystal', 0, yb - 0.02, 0, 0, 0, 0, 1, 2.2, 1);
  k.add(torus(0.08, 0.004, 4, 24), metal, 0, yb + 0.16, 0, Math.PI / 2, 0, 0);
  k.light(0, cupY + 0.05, 0, { intensity: 10, distance: 8, kind: 'chandelier', color: CANDLE, clear: R + 0.05 });
  const w = R * 2 + 0.09;
  return k.build('chandelierCrystal', { w, d: w, h: drop + 0.045, solid: false, mount: 'ceiling' });
}

function chandelierCandle(params = {}, mat) {
  const C = params.ceiling ?? 3.0; const k = new Kit(mat);
  const metal = params.metal || 'brassAged'; const n = params.arms ?? 6;
  const R = (params.w ?? 0.8) / 2 - 0.04;
  const drop = params.drop ?? Math.min(1.05, Math.max(0.7, C - 2.2));
  const yb = C - drop;
  const top = canopy(k, C, 0.075, metal);
  const colTop = yb + 0.6;
  k.rod([0, top, 0], [0, colTop, 0], 0.007, metal, 8);
  k.add(lathe([[0, 0], [0.01, 0], [0.025, 0.02], [0.018, 0.05], [0.045, 0.1], [0.085, 0.15], [0.09, 0.17], [0.07, 0.19], [0.035, 0.2],
    [0.022, 0.25], [0.035, 0.3], [0.02, 0.36], [0.03, 0.42], [0.018, 0.48], [0.025, 0.52], [0.014, 0.57], [0.022, 0.6], [0, 0.6]], 18), metal, 0, yb, 0);
  const cupY = yb + 0.32;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU; const c = Math.cos(a), s = Math.sin(a);
    const P = (r, y) => [c * r, y, s * r];
    // Main S-arm out of the bowl rim.
    k.add(tube([P(0.08, yb + 0.165), P(0.18, yb + 0.12), P(0.3, yb + 0.15), P(R, yb + 0.22), P(R, cupY - 0.02)], 0.009, 18, 6), metal);
    // Upper C-scroll from column to arm.
    k.add(tube([P(0.02, yb + 0.42), P(0.1, yb + 0.44), P(0.17, yb + 0.37), P(0.15, yb + 0.3), P(0.12, yb + 0.31)], 0.005, 14, 5), metal);
    // Lower curl.
    k.add(tube([P(0.24, yb + 0.135), P(0.26, yb + 0.07), P(0.22, yb + 0.05), P(0.2, yb + 0.08)], 0.005, 10, 5), metal);
    const [x, , z] = P(R, 0);
    k.add(lathe([[0, 0], [0.01, 0], [0.032, 0.014], [0.046, 0.016], [0.046, 0.02], [0.018, 0.022], [0.016, 0.03], [0, 0.03]], 14), metal, x, cupY - 0.025, z);
    k.add(cyl(0.014, 0.014, 0.1, 10, true), 'linenCream', x, cupY + 0.055, z);
    candleBulb(k, x, cupY + 0.105, z, 0.72);
  }
  k.add(lathe([[0, 0], [0.008, 0.02], [0.02, 0.05], [0.012, 0.075], [0, 0.08]], 12), metal, 0, yb - 0.08, 0);
  k.light(0, cupY + 0.06, 0, { intensity: 9, distance: 7, kind: 'chandelier', color: CANDLE, clear: R + 0.05 });
  const w = R * 2 + 0.1;
  return k.build('chandelierCandle', { w, d: w, h: drop + 0.08, solid: false, mount: 'ceiling' });
}

function pendantDome(params = {}, mat) {
  const C = params.ceiling ?? 3.0; const k = new Kit(mat);
  const R = (params.w ?? 0.45) / 2; const shell = params.mat || 'ironBlack';
  const bottom = params.bottom ?? Math.min(1.85, C - 0.6);
  const top = canopy(k, C, 0.065, shell);
  const H = R * 0.62;
  const domeTop = bottom + H;
  k.add(cyl(0.004, 0.004, top - (domeTop + 0.06), 6), 'rubberBlack', 0, (top + domeTop + 0.06) / 2, 0);
  k.add(lathe([[0, 0], [0.018, 0], [0.02, 0.05], [0.012, 0.065], [0, 0.065]], 12), shell, 0, domeTop - 0.005, 0);
  // Dome shell: outer black, inner warm white.
  const prof = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; const a = t * Math.PI / 2; prof.push([R * Math.cos(a) * (1 - 0.1 * t) + 0.0, H * Math.sin(a)]); }
  prof[prof.length - 1][0] = 0.02;
  const outer = [[R - 0.004, -0.008], [R, 0], ...prof.slice(1)];
  k.add(lathe(outer, 40), shell, 0, bottom, 0);
  const inner = prof.map(([r, y]) => [r - 0.004, y - 0.004]).reverse();
  inner.push([R - 0.004, -0.008]);
  k.add(lathe(inner, 40), params.inner || 'brass', 0, bottom, 0);
  k.add(sphere(0.045, 16, 12), 'bulbWarm', 0, bottom + H * 0.42, 0);
  k.add(cyl(0.02, 0.02, 0.05, 10), shell, 0, bottom + H * 0.42 + 0.06, 0);
  k.light(0, bottom + H * 0.3, 0, { intensity: 5, distance: 5, kind: 'pendant', color: WARM });
  return k.build('pendantDome', { w: R * 2, d: R * 2, h: C - bottom + 0.008, solid: false, mount: 'ceiling' });
}

function ceilingFan(params = {}, mat) {
  const C = params.ceiling ?? 3.0; const k = new Kit(mat);
  const metal = params.metal || 'ironBlack'; const blade = params.blade || 'walnut';
  const D = params.w ?? 1.3; const n = params.blades ?? 5;
  const top = canopy(k, C, 0.07, metal);
  const rodLen = Math.max(0.08, Math.min(0.35, C - 2.75));
  const motorTop = top - rodLen;
  k.add(cyl(0.011, 0.011, rodLen, 10), metal, 0, (top + motorTop) / 2, 0);
  k.add(lathe([[0, 0], [0.09, 0], [0.12, 0.02], [0.125, 0.05], [0.115, 0.09], [0.06, 0.12], [0.03, 0.135], [0, 0.135]], 28), metal, 0, motorTop - 0.135, 0);
  const rotorY = motorTop - 0.095;
  // Rotor (separate child so the app can spin it).
  const r = new Kit(mat);
  r.add(cyl(0.1, 0.1, 0.03, 28), metal, 0, rotorY, 0);
  const bl = D / 2 - 0.15;
  const bladeG = rbox(bl, 0.009, 0.13, 0.004, 1);
  const p = bladeG.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = (p.getX(i) + bl / 2) / bl; p.setZ(i, p.getZ(i) * (0.85 + 0.25 * t)); }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    r.at(0, rotorY, 0, a, () => {
      r.add(rbox(0.12, 0.012, 0.035, 0.004, 1), metal, 0.13, -0.005, 0, 0.0, 0, -0.05);
      r.add(bladeG, blade, 0.15 + bl / 2, -0.012, 0, 0.16, 0, 0);
    });
  }
  k.sub('rotor', r);
  // Light kit: switch housing + frosted bowl with bulb (params.light === false: none, e.g. the gym,
  // lit by its LED lines; the fan's own warm bulb would cast the blades' shadows over the ceiling)
  const kitTop = motorTop - 0.135;
  if (params.light === false) {
    k.add(lathe([[0, 0], [0.04, 0], [0.06, 0.03], [0, 0.03]], 20), metal, 0, kitTop - 0.03, 0);
    return k.build('ceilingFan', { w: D, d: D, h: C - (kitTop - 0.03), solid: false, mount: 'ceiling' },
      { spin: { node: 'rotor', axis: 'y', speed: params.speed ?? 2.2 } });
  }
  k.add(lathe([[0, 0], [0.04, 0], [0.065, 0.03], [0.07, 0.05], [0, 0.05]], 20), metal, 0, kitTop - 0.05, 0);
  k.add(lathe([[0, 0], [0.04, 0.005], [0.075, 0.03], [0.09, 0.07], [0.092, 0.08], [0.06, 0.082], [0, 0.082]], 24), params.glass || 'glassFrosted', 0, kitTop - 0.13, 0);
  k.add(sphere(0.035, 12, 8), 'bulbWarm', 0, kitTop - 0.08, 0);
  k.add(sphere(0.008, 8, 6), 'brass', 0, kitTop - 0.135, 0);
  k.rod([0.05, kitTop - 0.03, 0], [0.05, kitTop - 0.16, 0], 0.0012, 'brass', 4);
  k.add(sphere(0.007, 8, 6), 'brass', 0.05, kitTop - 0.163, 0);
  k.light(0, kitTop - 0.11, 0, { intensity: 6, distance: 6, kind: 'pendant', color: WARM, clear: D / 2 });
  return k.build('ceilingFan', { w: D, d: D, h: C - (kitTop - 0.17), solid: false, mount: 'ceiling' },
    { spin: { node: 'rotor', axis: 'y', speed: params.speed ?? 2.2 } });
}

function sconce(params = {}, mat) {
  const k = new Kit(mat); const cy = params.y ?? 1.8;
  const metal = params.metal || 'brass'; const style = params.style || 'shade';
  // Oval back plate.
  k.add(lathe([[0, 0], [0.045, 0], [0.05, 0.008], [0.04, 0.016], [0.02, 0.02], [0, 0.022]], 20), metal, 0, cy - 0.04, 0, Math.PI / 2, 0, 0, 1, 1, 1.7);
  k.add(tube([[0, cy - 0.04, 0.02], [0, cy - 0.06, 0.08], [0, cy - 0.02, 0.13], [0, cy + 0.02, 0.14]], 0.006, 14, 6), metal);
  k.add(tube([[0, cy - 0.06, 0.08], [0, cy - 0.11, 0.07], [0, cy - 0.12, 0.04], [0, cy - 0.1, 0.03]], 0.004, 8, 4), metal);
  k.add(lathe([[0, 0], [0.012, 0], [0.034, 0.012], [0.038, 0.016], [0.016, 0.018], [0.014, 0.024], [0, 0.024]], 14), metal, 0, cy + 0.02, 0.14);
  k.add(cyl(0.012, 0.012, 0.075, 10, true), 'porcelain', 0, cy + 0.08, 0.14);
  candleBulb(k, 0, cy + 0.115, 0.14, 0.62);
  if (style === 'shade') {
    k.add(pleatShade(0.08, 0.05, 0.12, 16, 0.03), 'lampShade', 0, cy + 0.17, 0.14);
    k.rod([-0.05, cy + 0.225, 0.14], [0.05, cy + 0.225, 0.14], 0.0015, metal, 4);
    k.add(sphere(0.007, 8, 6), metal, 0, cy + 0.235, 0.14);
  }
  k.light(0, cy + 0.14, 0.16, { intensity: 2.5, distance: 3, kind: 'sconce', color: style === 'candle' ? CANDLE : WARM });
  return k.build('sconce', { w: 0.2, d: 0.2, h: 0.4, solid: false, mount: 'wall' }, { style });
}

// ---------------------------------------------------------------- functional ceiling LEDs
// Colour temperature → light colour + diffuser material. cool ≈ 6000 K (showroom), neutral ≈ 4000 K
// (gym, kitchens, work), warm ≈ 3000 K (cosy rooms).
const CCT = {
  cool: { color: '#eef3ff', mat: 'ledCool' },
  neutral: { color: '#fff1de', mat: 'ledNeutral' },
  warm: { color: '#ffd6a6', mat: 'ledWarm' },
};
const cctOf = (p) => CCT[p.cct] || CCT.neutral;

/** Surface-mounted linear LED batten: params.w = length (x), intensity per metre (default 1.5).
 * Long runs emit one light per ≤ 4.5 m segment, each sampled over its length by the bake. */
function linearLed(params = {}, mat) {
  const C = params.ceiling ?? 3.0; const k = new Kit(mat);
  const L = params.w ?? 1.5, W = 0.075, H = 0.055;
  const t = cctOf(params);
  k.box(L, H, W, params.mat || 'powderWhite', 0, C - H, 0, 0.008, 1);
  k.box(L - 0.03, 0.008, W - 0.016, t.mat, 0, C - H - 0.006, 0, 0.003, 1);
  const n = Math.max(1, Math.ceil(L / 4.5 - 1e-6)), seg = L / n;
  for (let i = 0; i < n; i++) {
    k.light(-L / 2 + seg * (i + 0.5), C - H - 0.02, 0, {
      intensity: (params.intensity ?? 1.5) * seg, distance: params.distance ?? 9, kind: 'ceiling', color: t.color,
      ext: [seg / 2 - 0.02, 0, 0.02], down: true, clear: 0.12, rtDrop: 0.45,
    });
  }
  return k.build('linearLed', { w: L, d: W, h: H + 0.006, solid: false, mount: 'ceiling' }, { cct: params.cct || 'neutral' });
}

/** Surface-mounted LED panel, params.w × params.d (default 0.6 × 0.6 m; 1.2 × 0.6 for corridors). */
function panelLed(params = {}, mat) {
  const C = params.ceiling ?? 3.0; const k = new Kit(mat);
  const S = params.w ?? 0.6, D = params.d ?? S, H = 0.035;
  const t = cctOf(params);
  k.box(S, H, D, params.mat || 'powderWhite', 0, C - H, 0, 0.006, 1);
  k.box(S - 0.05, 0.006, D - 0.05, t.mat, 0, C - H - 0.004, 0, 0.002, 1);
  k.light(0, C - H - 0.02, 0, {
    intensity: params.intensity ?? 3.5 * Math.sqrt(S * D / 0.36), distance: params.distance ?? 8, kind: 'ceiling', color: t.color,
    ext: [S / 2 - 0.04, 0, D / 2 - 0.04], down: true, clear: 0.1, rtDrop: 0.45,
  });
  return k.build('panelLed', { w: S, d: D, h: H + 0.004, solid: false, mount: 'ceiling' }, { cct: params.cct || 'neutral' });
}

/** Industrial high-bay pendant over workbenches: steel reflector dome on a rod, LED disc below. */
function industrialPendant(params = {}, mat) {
  const C = params.ceiling ?? 3.0; const k = new Kit(mat);
  const R = (params.w ?? 0.45) / 2, shell = params.mat || 'steelBrushed';
  const drop = params.drop ?? Math.min(1.0, Math.max(0.6, C - 2.6));
  const bottom = C - drop, H = R * 0.75;
  const t = cctOf({ cct: params.cct || 'cool' });
  const top = canopy(k, C, 0.06, shell);
  k.add(cyl(0.008, 0.008, top - (bottom + H + 0.1), 8), shell, 0, (top + bottom + H + 0.1) / 2, 0);
  // driver housing + conical reflector (open at the bottom), white inside
  k.add(cyl(0.07, 0.08, 0.1, 20), 'ironBlack', 0, bottom + H + 0.05, 0);
  const prof = [[R, 0], [R * 0.93, H * 0.35], [R * 0.6, H * 0.8], [0.08, H]];
  k.add(lathe([[R + 0.006, -0.004], ...prof, [0, H]], 32), shell, 0, bottom, 0);
  k.add(lathe([[0, H - 0.004], ...prof.slice().reverse().map(([r, y]) => [r - 0.005, y - 0.004]), [R - 0.005, -0.002]], 32), 'powderWhite', 0, bottom, 0);
  k.add(cyl(0.11, 0.11, 0.012, 24), t.mat, 0, bottom + H * 0.55, 0);
  k.light(0, bottom + H * 0.4, 0, {
    intensity: params.intensity ?? 6, distance: params.distance ?? 9, kind: 'pendant', color: t.color,
    ext: [0.08, 0, 0.08], down: true, clear: R + 0.05,
  });
  return k.build('industrialPendant', { w: R * 2 + 0.012, d: R * 2 + 0.012, h: drop + 0.004, solid: false, mount: 'ceiling' });
}

export const LIGHTING = {
  tableLamp, floorLamp, bankersLamp, chandelierRing, chandelierCrystal, chandelierCandle, pendantDome, ceilingFan, sconce,
  linearLed, panelLed, industrialPendant,
};
export const INFO = {
  tableLamp: { w: 0.35, d: 0.35, h: 0.6, mount: 'floor', solid: false },
  floorLamp: { w: 0.4, d: 0.4, h: 1.6, mount: 'floor', solid: true },
  bankersLamp: { w: 0.3, d: 0.2, h: 0.4, mount: 'floor', solid: false },
  chandelierRing: { w: 1.0, d: 1.0, h: 0.9, mount: 'ceiling', solid: false },
  chandelierCrystal: { w: 0.9, d: 0.9, h: 0.9, mount: 'ceiling', solid: false },
  chandelierCandle: { w: 0.8, d: 0.8, h: 0.85, mount: 'ceiling', solid: false },
  pendantDome: { w: 0.45, d: 0.45, h: 0.8, mount: 'ceiling', solid: false },
  ceilingFan: { w: 1.3, d: 1.3, h: 0.6, mount: 'ceiling', solid: false },
  sconce: { w: 0.2, d: 0.2, h: 0.4, mount: 'wall', solid: false },
  linearLed: { w: 1.5, d: 0.075, h: 0.06, mount: 'ceiling', solid: false },
  panelLed: { w: 0.6, d: 0.6, h: 0.04, mount: 'ceiling', solid: false },
  industrialPendant: { w: 0.46, d: 0.46, h: 1.0, mount: 'ceiling', solid: false },
};
void knob; void flame;
