// Furniture: gym (treadmill, squatRack, weightBench, dumbbellRack, rowingMachine, yogaMat) plus the
// commercial-gym set (cableCrossover, benchPress, plateTree, smithMachine, deadliftPlatform, latPulldown,
// legPress, legExtension, chestPress).
// Local frame per docs/SCHEMA.md "Furniture" (+Z = the side the user approaches / stands on).
import * as THREE from 'three';
import { Kit, seeded } from './bedroom.js';

const BODY = 'lacquer:#2b2d31';

function treadmill(p = {}, mat) {
  const W = p.w || 0.85, D = p.d || 2.0, H = p.h || 1.45;
  const k = new Kit(mat);
  const z0 = -D / 2, z1 = D / 2, deckY = 0.2;
  // deck frame + side rails + belt
  k.bb(BODY, -W / 2 + 0.06, 0.05, z0 + 0.3, W / 2 - 0.06, deckY - 0.02, z1 - 0.02, { r: 0.03 });
  for (const s of [-1, 1]) {
    k.bb('steelBrushed', s * (W / 2 - 0.1) - 0.06, deckY - 0.03, z0 + 0.32, s * (W / 2 - 0.1) + 0.06, deckY + 0.005, z1 - 0.03, { r: 0.01 });
    k.bb('rubberBlack', s * (W / 2 - 0.04) - 0.02, 0, z1 - 0.12, s * (W / 2 - 0.04) + 0.02, 0.06, z1 - 0.04);
  }
  k.bb('rubberBlack', -W / 2 + 0.17, deckY - 0.02, z0 + 0.32, W / 2 - 0.17, deckY + 0.003, z1 - 0.06, { r: 0.012 });
  k.cyl('steelBrushed', 0.035, 0.035, W - 0.32, { y: deckY - 0.02, z: z1 - 0.06, rz: Math.PI / 2, seg: 12 });
  // motor hood
  k.bb(BODY, -W / 2 + 0.03, 0.04, z0, W / 2 - 0.03, 0.32, z0 + 0.36, { r: 0.08, seg: 2 });
  k.bb('steelBrushed', -W / 2 + 0.2, 0.32, z0 + 0.1, W / 2 - 0.2, 0.322, z0 + 0.3);
  // uprights → console with handlebars
  for (const s of [-1, 1]) {
    k.sbar(BODY, [s * (W / 2 - 0.05), 0.2, z0 + 0.25], [s * (W / 2 - 0.06), 1.2, z0 + 0.2], 0.07, { r: 0.02, t2: 0.09 });
    k.tube('rubberBlack', [[s * (W / 2 - 0.06), 1.05, z0 + 0.22], [s * (W / 2 - 0.04), 1.08, z0 + 0.42], [s * (W / 2 - 0.05), 1.06, z0 + 0.6]], 0.02, { ts: 8, rs: 6 });
    k.box('chrome', 0.03, 0.01, 0.12, { x: s * (W / 2 - 0.04), y: 1.1, z: z0 + 0.42 });
  }
  k.push({ y: 1.28, z: z0 + 0.22, rx: -0.5 });
  k.box(BODY, W - 0.08, 0.32, 0.12, { r: 0.04 });
  k.bb('screenOn', -0.18, -0.08, 0.06, 0.18, 0.11, 0.0605, { uv: false });
  for (let i = 0; i < 6; i++) k.box('steelBrushed', 0.04, 0.025, 0.01, { x: -0.24 + i * 0.096, y: -0.12, z: 0.062, r: 0.004 });
  k.pop();
  k.bb(BODY, -W / 2 + 0.06, 1.12, z0 + 0.26, W / 2 - 0.06, 1.17, z0 + 0.34, { r: 0.02 });
  return k.build('treadmill', W, D, H, true);
}

function plate(k, x, y, z, r, t, axis = 'x', m = 'rubberBlack') {
  const o = axis === 'x' ? { rz: Math.PI / 2 } : axis === 'z' ? { rx: Math.PI / 2 } : {};
  k.cyl(m, r, r, t, { x, y, z, seg: 20, ...o });
  k.cyl('chrome', 0.03, 0.03, t + 0.004, { x, y, z, seg: 8, ...o });
}

function squatRack(p = {}, mat) {
  const W = p.w || 2.2, D = p.d || 1.7, H = p.h || 2.3, ST = p.frame || 'ironBlack';
  const k = new Kit(mat);
  const rw = 1.2, rd = 1.2, t = 0.075, xs = rw / 2 - t / 2, zs = rd / 2 - t / 2;
  // uprights with hole rows, base feet, top crossmembers, pull-up bar
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.bb(ST, sx * xs - t / 2, 0.05, sz * zs - t / 2, sx * xs + t / 2, H, sz * zs + t / 2, { r: 0.006 });
    for (let i = 0; i < 18; i++) k.bb('rubberBlack', sx * xs - 0.01, 0.6 + i * 0.07, sz * zs + sz * (t / 2) - 0.0005, sx * xs + 0.01, 0.62 + i * 0.07, sz * zs + sz * (t / 2) + 0.0005 * sz);
  }
  for (const sx of [-1, 1]) k.bb(ST, sx * xs - t / 2, 0, -rd / 2 - 0.05, sx * xs + t / 2, 0.05, rd / 2 + 0.05, { r: 0.006 });
  for (const sz of [-1, 1]) k.bb(ST, -xs, H - t, sz * zs - t / 2, xs, H, sz * zs + t / 2, { r: 0.006 });
  k.bb(ST, -xs, 0, -zs - t / 2, xs, t, -zs + t / 2, { r: 0.006 });
  for (const sx of [-1, 1]) k.bb(ST, sx * xs - t / 2, H - t, -zs, sx * xs + t / 2, H, zs, { r: 0.006 });
  k.cyl('chrome', 0.016, 0.016, rw + 0.1, { y: H - 0.12, z: zs + 0.1, rz: Math.PI / 2, seg: 10 });
  for (const sx of [-1, 1]) k.bb(ST, sx * xs - 0.02, H - 0.15, zs, sx * xs + 0.02, H - 0.09, zs + 0.12);
  // safety spotter arms + J-hooks
  for (const sx of [-1, 1]) {
    k.bb('steelBrushed', sx * xs - 0.025, 0.72, -zs, sx * xs + 0.025, 0.77, zs);
    k.bb(ST, sx * xs - 0.03, 1.28, zs + t / 2, sx * xs + 0.03, 1.33, zs + t / 2 + 0.1);
    k.bb(ST, sx * xs - 0.03, 1.33, zs + t / 2 + 0.07, sx * xs + 0.03, 1.38, zs + t / 2 + 0.1);
  }
  // loaded barbell on the J-hooks
  const by = 1.36, bz = zs + t / 2 + 0.045;
  k.cyl('chrome', 0.014, 0.014, 1.31, { y: by, z: bz, rz: Math.PI / 2, seg: 10 });
  for (const s of [-1, 1]) {
    k.cyl('chrome', 0.025, 0.025, 0.42, { x: s * 0.865, y: by, z: bz, rz: Math.PI / 2, seg: 10 });
    k.cyl('chrome', 0.04, 0.04, 0.03, { x: s * 0.67, y: by, z: bz, rz: Math.PI / 2, seg: 10 });
    plate(k, s * 0.72, by, bz, 0.225, 0.055);
    plate(k, s * 0.78, by, bz, 0.225, 0.055);
    plate(k, s * 0.83, by, bz, 0.16, 0.035);
  }
  // plate storage horns at the back
  for (const sx of [-1, 1]) {
    k.cyl('steelBrushed', 0.025, 0.025, 0.25, { x: sx * xs, y: 0.35, z: -zs - 0.15, rx: Math.PI / 2, seg: 8 });
    for (let i = 0; i < 2; i++) plate(k, sx * xs, 0.35, -zs - 0.08 - i * 0.05, i ? 0.16 : 0.225, 0.04, 'z');
  }
  return k.build('squatRack', W, D, H, true);
}

function weightBench(p = {}, mat) {
  const W = p.w || 0.6, D = p.d || 1.35, H = p.h || 0.47, PAD = p.fabric || 'leatherBlack', ST = p.frame || 'ironBlack';
  const k = new Kit(mat);
  const padY = H - 0.06;
  // frame: spine + front/rear stabilisers
  k.sbar(ST, [0, 0.12, -D / 2 + 0.1], [0, 0.12, D / 2 - 0.1], 0.08, { r: 0.008, t2: 0.06 });
  for (const z of [-D / 2 + 0.06, D / 2 - 0.08]) k.bb(ST, -W / 2, 0, z - 0.04, W / 2, 0.06, z + 0.04, { r: 0.008 });
  for (const s of [-1, 1]) k.bb('rubberBlack', s * (W / 2 - 0.04) - 0.04, 0, D / 2 - 0.12, s * (W / 2 - 0.04) + 0.04, 0.012, D / 2 - 0.04);
  k.sbar(ST, [0, 0.05, D / 2 - 0.08], [0, padY - 0.04, D / 2 - 0.3], 0.06, { r: 0.008 });
  k.sbar(ST, [0, 0.05, -D / 2 + 0.06], [0, padY - 0.04, -0.2], 0.06, { r: 0.008 });
  k.sbar('steelBrushed', [0, 0.16, -0.05], [0, padY - 0.04, -0.15], 0.04, { r: 0.006 });
  // wheels + handle at the head end
  for (const s of [-1, 1]) k.cyl('rubberBlack', 0.04, 0.04, 0.03, { x: s * (W / 2 - 0.02), y: 0.045, z: -D / 2 + 0.06, rz: Math.PI / 2, seg: 12 });
  k.bar('chrome', [-0.08, 0.1, -D / 2 + 0.01], [0.08, 0.1, -D / 2 + 0.01], 0.012, { seg: 8 });
  // pads: seat (front) + back
  k.box(PAD, 0.3, 0.07, 0.36, { y: padY, z: D / 2 - 0.3, r: 0.025 });
  k.box(PAD, 0.3, 0.07, 0.82, { y: padY, z: -D / 2 + 0.5, r: 0.025 });
  k.box('oakLight', 0.28, 0.015, 0.34, { y: padY - 0.043, z: D / 2 - 0.3 });
  k.box('oakLight', 0.28, 0.015, 0.8, { y: padY - 0.043, z: -D / 2 + 0.5 });
  return k.build('weightBench', W, D, H, true);
}

function dumbbell(k, x, y, z, w, hr, rx = 0) {
  // hex heads + knurled chrome handle, axis along Z
  const hl = 0.13, head = 0.04 + w * 0.0028;
  k.push({ x, y, z, rx });
  k.cyl('chrome', 0.016, 0.016, hl, { rx: Math.PI / 2, seg: 8, open: true });
  for (const s of [-1, 1]) k.cyl('rubberBlack', hr, hr, head, { z: s * (hl / 2 + head / 2), rx: Math.PI / 2, ry: 0, seg: 6 });
  k.pop();
  return hl + 2 * head;
}
function dumbbellRack(p = {}, mat) {
  const W = p.w || 1.4, D = p.d || 0.55, H = p.h || 0.85, ST = p.frame || 'ironBlack';
  const k = new Kit(mat);
  const tiers = [[0.42, 0.12, 0.08], [0.72, -0.12, 0.25]];   // y, z centre, tilt
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.04);
    k.sbar(ST, [x, 0, 0.18], [x, H - 0.05, -0.12], 0.06, { r: 0.006 });
    k.sbar(ST, [x, 0, -0.2], [x, H - 0.05, -0.16], 0.06, { r: 0.006 });
    k.bb(ST, x - 0.03, 0, -D / 2, x + 0.03, 0.04, D / 2, { r: 0.006 });
    k.bb('rubberBlack', x - 0.035, 0, -D / 2, x + 0.035, 0.01, -D / 2 + 0.05);
    k.bb('rubberBlack', x - 0.035, 0, D / 2 - 0.05, x + 0.035, 0.01, D / 2);
  }
  const pairs = Math.max(2, Math.floor((W - 0.1) / 0.24));
  let wkg = 4;
  for (const [y, zc, tilt] of tiers) {
    for (const s of [-1, 1]) k.bb(ST, -W / 2 + 0.04, y - 0.06, zc + s * 0.11 - 0.02, W / 2 - 0.04, y - 0.02, zc + s * 0.11 + 0.02, { r: 0.004, rx: tilt });
    for (let i = 0; i < pairs; i++) {
      const hr = 0.045 + wkg * 0.0018, x = -W / 2 + 0.1 + (W - 0.2) * (i + 0.5) / pairs;
      for (const sx of [-1, 1]) dumbbell(k, x + sx * (hr + 0.006), y + hr - 0.02, zc, wkg, hr, tilt);
      wkg += 2.5;
    }
  }
  return k.build('dumbbellRack', W, D, H, true);
}

function rowingMachine(p = {}, mat) {
  const W = p.w || 0.6, D = p.d || 2.45, H = p.h || 0.95;
  const k = new Kit(mat);
  const z0 = -D / 2, z1 = D / 2;
  // monorail from the front leg to the rear leg
  k.sbar('steelBrushed', [0, 0.36, z0 + 0.5], [0, 0.3, z1 - 0.05], 0.06, { r: 0.008, t2: 0.11 });
  k.bb(BODY, -W / 2 + 0.03, 0, z1 - 0.12, W / 2 - 0.03, 0.05, z1 - 0.02, { r: 0.012 });
  k.bb(BODY, -0.04, 0.05, z1 - 0.1, 0.04, 0.3, z1 - 0.04, { r: 0.01 });
  // front leg / flywheel cage
  k.bb(BODY, -W / 2 + 0.02, 0, z0 + 0.05, W / 2 - 0.02, 0.05, z0 + 0.17, { r: 0.012 });
  k.sbar(BODY, [0, 0.03, z0 + 0.1], [0, 0.42, z0 + 0.45], 0.07, { r: 0.01 });
  k.cyl(BODY, 0.24, 0.24, 0.16, { y: 0.45, z: z0 + 0.3, rz: Math.PI / 2, seg: 24 });
  for (const s of [-1, 1]) k.cyl('steelBrushed', 0.2, 0.2, 0.004, { x: s * 0.082, y: 0.45, z: z0 + 0.3, rz: Math.PI / 2, seg: 24 });
  k.cyl('ironBlack', 0.05, 0.05, 0.17, { y: 0.45, z: z0 + 0.3, rz: Math.PI / 2, seg: 12 });
  // monitor arm + PM monitor
  k.tube(BODY, [[0, 0.62, z0 + 0.35], [0, 0.82, z0 + 0.45], [0, 0.88, z0 + 0.6]], 0.016, { ts: 8, rs: 6 });
  k.box(BODY, 0.2, 0.16, 0.05, { y: 0.9, z: z0 + 0.62, rx: -0.3, r: 0.015 });
  k.bb('screenOn', -0.07, 0.86, z0 + 0.645, 0.07, 0.95, z0 + 0.646, { rx: -0.3, uv: false });
  // handle + chain
  k.bar('ironBlack', [0, 0.52, z0 + 0.5], [0, 0.55, z0 + 0.72], 0.004, { seg: 4 });
  k.bar('rubberBlack', [-0.27, 0.55, z0 + 0.74], [0.27, 0.55, z0 + 0.74], 0.016, { seg: 8 });
  k.bar('steelBrushed', [-0.04, 0.55, z0 + 0.74], [0.04, 0.55, z0 + 0.74], 0.018, { seg: 8 });
  // footrests with straps
  for (const s of [-1, 1]) {
    k.box(BODY, 0.13, 0.03, 0.3, { x: s * 0.1, y: 0.42, z: z0 + 0.82, rx: -0.75, r: 0.01 });
    k.box('rubberBlack', 0.11, 0.025, 0.08, { x: s * 0.1, y: 0.46, z: z0 + 0.82, rx: -0.75, r: 0.008 });
  }
  // seat on the rail
  k.box(BODY, 0.18, 0.05, 0.2, { y: 0.415, z: 0.2, r: 0.02 });
  k.box('leatherBlack', 0.36, 0.05, 0.3, { y: 0.46, z: 0.2, r: 0.02 });
  return k.build('rowingMachine', W, D, H, true);
}

function yogaMat(p = {}, mat) {
  const W = p.w || 0.61, D = p.d || 1.83, M = p.mat || p.fabric || 'fabricSage';
  const k = new Kit(mat);
  k.box(M, W, 0.006, D, { y: 0.003, r: 0.0029 });
  // two cork blocks + a rolled towel at the head
  k.box('oakLight', 0.15, 0.1, 0.23, { x: -0.12, y: 0.056, z: -D / 2 + 0.2, r: 0.01 });
  k.box('oakLight', 0.15, 0.1, 0.23, { x: 0.12, y: 0.056, z: -D / 2 + 0.2, ry: 0.25, r: 0.01 });
  k.cyl('linenCream', 0.05, 0.05, 0.4, { y: 0.056, z: -D / 2 + 0.45, rz: Math.PI / 2, seg: 12 });
  return k.build('yogaMat', W, D, 0.11, false);
}

// ───────────────────────── commercial-gym machines ─────────────────────────
// Shared parts: loaded barbell along X, selector weight stack, cable pulley.

const BAR_PLATES = [[0.225, 0.05], [0.225, 0.05], [0.16, 0.03]];
function barbell(k, y, z, half = 1.04, plates = BAR_PLATES, x = 0) {
  const sl = 0.4, cx = half - sl - 0.01;            // sleeve length, collar position
  k.cyl('chrome', 0.014, 0.014, 2 * cx, { x, y, z, rz: Math.PI / 2, seg: 10 });
  for (const s of [-1, 1]) {
    k.cyl('chrome', 0.025, 0.025, sl, { x: x + s * (half - sl / 2), y, z, rz: Math.PI / 2, seg: 10 });
    k.cyl('chrome', 0.04, 0.04, 0.03, { x: x + s * (cx + 0.005), y, z, rz: Math.PI / 2, seg: 10 });
    let o = cx + 0.025;
    for (const [r, t] of plates) { plate(k, x + s * (o + t / 2), y, z, r, t); o += t + 0.004; }
  }
}

// Selector stack of n plates (pw × pd) centred at (x, z) from y0; guide rods up to `top`. Returns the stack top.
function weightStack(k, x, z, y0, n, top, o = {}) {
  const pw = o.w || 0.3, pd = o.d || 0.14, pt = 0.024, gap = 0.004;
  k.bb('rubberBlack', x - pw / 2 + 0.03, y0 - 0.04, z - pd / 2 + 0.01, x + pw / 2 - 0.03, y0, z + pd / 2 - 0.01);
  for (let i = 0; i < n; i++) {
    const y = y0 + i * (pt + gap);
    k.bb(i === n - 1 ? 'steelBrushed' : 'ironBlack', x - pw / 2, y, z - pd / 2, x + pw / 2, y + pt, z + pd / 2);
  }
  const st = y0 + n * (pt + gap);
  for (const s of [-1, 1]) k.cyl('chrome', 0.011, 0.011, top - y0 + 0.04, { x: x + s * (pw / 2 - 0.045), y: (top + y0 - 0.04) / 2, z, seg: 8 });
  k.cyl('chrome', 0.009, 0.009, 0.22, { x, y: st + 0.11, z, seg: 6 });                  // lift rod
  k.cyl('chrome', 0.008, 0.008, 0.14, { x, y: y0 + 4 * (pt + gap) + pt / 2, z: z + pd / 2 + 0.05, rx: Math.PI / 2, seg: 6 });
  k.sph('rubberBlack', 0.018, { x, y: y0 + 4 * (pt + gap) + pt / 2, z: z + pd / 2 + 0.12, ws: 8, hs: 6 });
  return st;
}

// Pulley wheel with its axle along X (o.axis 'z' → axle along Z).
function pulley(k, x, y, z, r = 0.05, o = {}) {
  const rot = o.axis === 'z' ? { rx: Math.PI / 2 } : { rz: Math.PI / 2 };
  k.cyl('steelBrushed', r, r, 0.03, { x, y, z, seg: 14, ...rot });
  k.cyl('ironBlack', r * 0.35, r * 0.35, 0.05, { x, y, z, seg: 8, ...rot });
}
const cable = (k, a, b) => k.bar('ironBlack', a, b, 0.004, { seg: 4 });

function cableCrossover(p = {}, mat) {
  const W = p.w || 2.6, D = p.d || 1.1, H = p.h || 2.3, ST = p.frame || BODY;
  const k = new Kit(mat);
  const z0 = -D / 2, z1 = D / 2, tw = 0.28;
  const tx0 = W / 2 - tw;
  for (const s of [-1, 1]) {
    const tx = s * tx0;
    // base plate + forward stabiliser foot
    k.bb(ST, tx - tw, 0, z0, tx + tw, 0.06, z0 + 0.5, { r: 0.008 });
    k.bb(ST, tx - 0.05, 0, z0 + 0.5, tx + 0.05, 0.06, z1 - 0.04, { r: 0.008 });
    k.bb('rubberBlack', tx - 0.06, 0, z1 - 0.06, tx + 0.06, 0.07, z1);
    // rear uprights, front pulley column, top cap
    for (const sx of [-1, 1]) k.bb(ST, tx + sx * 0.24 - 0.04, 0.06, z0 + 0.01, tx + sx * 0.24 + 0.04, H - 0.1, z0 + 0.09, { r: 0.006 });
    k.bb(ST, tx - 0.05, 0.06, z0 + 0.36, tx + 0.05, H - 0.1, z0 + 0.46, { r: 0.006 });
    for (let i = 0; i < 16; i++) k.bb('steelBrushed', tx - 0.012, 0.45 + i * 0.1, z0 + 0.4595, tx + 0.012, 0.47 + i * 0.1, z0 + 0.462);
    k.bb(ST, tx - tw, H - 0.1, z0, tx + tw, H - 0.02, z0 + 0.5, { r: 0.01 });
    // outer side shroud with a brushed band
    const ox = tx + s * 0.255;
    k.bb(BODY, ox - 0.008, 0.3, z0 + 0.02, ox + 0.008, H - 0.25, z0 + 0.34, { r: 0.004 });
    k.bb('steelBrushed', ox - 0.01, 1.4, z0 + 0.04, ox + 0.01, 1.48, z0 + 0.32);
    // weight stack between the rear uprights and the pulley column
    const top = weightStack(k, tx, z0 + 0.2, 0.12, 15, H - 0.12, { w: 0.3, d: 0.14 });
    // cable: stack → top pulleys → adjustable carriage
    const cy = 1.3;
    pulley(k, tx, H - 0.16, z0 + 0.2, 0.045);
    pulley(k, tx, H - 0.16, z0 + 0.41, 0.045);
    cable(k, [tx, top + 0.22, z0 + 0.2], [tx, H - 0.2, z0 + 0.2]);
    cable(k, [tx, H - 0.12, z0 + 0.2], [tx, H - 0.12, z0 + 0.41]);
    cable(k, [tx, H - 0.2, z0 + 0.47], [tx, cy + 0.08, z0 + 0.47]);
    k.bb('steelBrushed', tx - 0.075, cy - 0.09, z0 + 0.46, tx + 0.075, cy + 0.09, z0 + 0.53, { r: 0.01 });
    k.cyl('rubberBlack', 0.02, 0.02, 0.06, { x: tx + 0.09, y: cy + 0.05, z: z0 + 0.5, rz: Math.PI / 2, seg: 8 }); // pop-pin knob
    pulley(k, tx, cy - 0.04, z0 + 0.58);
    k.bb('steelBrushed', tx - 0.03, cy - 0.06, z0 + 0.53, tx + 0.03, cy, z0 + 0.6);
    cable(k, [tx, cy - 0.09, z0 + 0.6], [tx, cy - 0.32, z0 + 0.64]);
    k.torus('chrome', 0.06, 0.009, { x: tx, y: cy - 0.39, z: z0 + 0.64, rs: 6, ts: 14 });
    k.cyl('rubberBlack', 0.016, 0.016, 0.11, { x: tx, y: cy - 0.43, z: z0 + 0.64, rz: Math.PI / 2, seg: 8 });
  }
  // top cross beams (front + rear) and pull-up bar on brackets
  const ix = tx0 - tw;
  k.bb(ST, -ix, H - 0.12, z0 + 0.36, ix, H, z0 + 0.48, { r: 0.008 });
  k.bb(ST, -ix, H - 0.1, z0 + 0.01, ix, H - 0.02, z0 + 0.09, { r: 0.008 });
  for (const s of [-1, 1]) k.bb(ST, s * 0.62 - 0.03, H - 0.1, z0 + 0.48, s * 0.62 + 0.03, H - 0.04, z0 + 0.82, { r: 0.006 });
  k.cyl('chrome', 0.016, 0.016, 1.42, { y: H - 0.13, z: z0 + 0.79, rz: Math.PI / 2, seg: 10 });
  for (const s of [-1, 1]) {
    k.cyl('rubberBlack', 0.02, 0.02, 0.22, { x: s * 0.45, y: H - 0.13, z: z0 + 0.79, rz: Math.PI / 2, seg: 10 });
    k.bar('chrome', [s * 0.25, H - 0.07, z0 + 0.79], [s * 0.18, H - 0.3, z0 + 0.9], 0.014, { seg: 8 });   // neutral grips
  }
  // attachment hooks on the rear beam with a rope + straight bar
  k.bar('steelBrushed', [-0.2, H - 0.06, z0 + 0.09], [-0.2, H - 0.06, z0 + 0.16], 0.008);
  k.bar('steelBrushed', [0.2, H - 0.06, z0 + 0.09], [0.2, H - 0.06, z0 + 0.16], 0.008);
  k.tube('ironBlack', [[-0.2, H - 0.07, z0 + 0.15], [-0.22, H - 0.4, z0 + 0.15], [-0.15, H - 0.55, z0 + 0.15]], 0.014, { ts: 8, rs: 6 });
  k.bar('chrome', [0.05, H - 0.1, z0 + 0.15], [0.35, H - 0.1, z0 + 0.15], 0.012, { seg: 8 });
  return k.build('cableCrossover', W, D, H, true);
}

function benchPress(p = {}, mat) {
  const inc = !!p.incline;
  const W = p.w || 2.1, D = p.d || 1.75, H = p.h || (inc ? 1.55 : 1.4), PAD = p.fabric || 'leatherBlack', ST = p.frame || 'ironBlack';
  const k = new Kit(mat);
  const z0 = -D / 2, z1 = D / 2, ux = 0.55, uz = z0 + 0.2, barY = inc ? 1.3 : 1.08, barZ = uz + 0.08;
  // upright frame at the head end: rear base, side feet, posts, top tie
  k.bb(ST, -ux - 0.1, 0, z0, ux + 0.1, 0.06, z0 + 0.1, { r: 0.006 });
  for (const s of [-1, 1]) {
    k.bb(ST, s * ux - 0.035, 0, z0, s * ux + 0.035, 0.06, z0 + 0.62, { r: 0.006 });
    k.bb('rubberBlack', s * ux - 0.04, 0, z0 + 0.56, s * ux + 0.04, 0.012, z0 + 0.62);
    k.bb(ST, s * ux - 0.03, 0.06, uz - 0.03, s * ux + 0.03, H - 0.04, uz + 0.03, { r: 0.005 });
    k.sbar(ST, [s * ux, 0.06, z0 + 0.5], [s * ux, 0.75, uz + 0.02], 0.05, { r: 0.005 });
    for (let i = 0; i < 9; i++) k.bb('rubberBlack', s * ux - 0.008, barY - 0.36 + i * 0.07, uz + 0.0295, s * ux + 0.008, barY - 0.34 + i * 0.07, uz + 0.0305);
    // J-cups + spotter arms
    k.bb('steelBrushed', s * ux - 0.035, barY - 0.07, uz + 0.03, s * ux + 0.035, barY - 0.025, uz + 0.14);
    k.bb('steelBrushed', s * ux - 0.035, barY - 0.025, uz + 0.11, s * ux + 0.035, barY + 0.03, uz + 0.14);
    k.bb(ST, s * ux - 0.025, barY - 0.36, uz + 0.03, s * ux + 0.025, barY - 0.32, uz + 0.42, { r: 0.004 });
    // plate storage horns on the back of the uprights
    k.cyl('steelBrushed', 0.025, 0.025, 0.19, { x: s * ux, y: 0.32, z: uz - 0.1, rx: Math.PI / 2, seg: 8 });
    plate(k, s * ux, 0.32, uz - 0.07, 0.2, 0.04, 'z');
    plate(k, s * ux, 0.32, uz - 0.115, 0.16, 0.035, 'z');
  }
  k.bb(ST, -ux, H - 0.06, uz - 0.03, ux, H, uz + 0.03, { r: 0.005 });
  for (const s of [-1, 1]) k.cyl('steelBrushed', 0.02, 0.02, 0.05, { x: s * ux, y: H - 0.03, z: uz, seg: 8 });
  // bench spine, legs and pads
  k.bb(ST, -0.04, 0.06, z0 + 0.1, 0.04, 0.14, z1 - 0.08, { r: 0.006 });
  k.bb(ST, -0.3, 0, z1 - 0.1, 0.3, 0.06, z1, { r: 0.006 });
  for (const s of [-1, 1]) k.bb('rubberBlack', s * 0.26 - 0.04, 0, z1 - 0.1, s * 0.26 + 0.04, 0.012, z1);
  if (!inc) {
    const py = 0.405;
    k.sbar(ST, [0, 0.12, z0 + 0.55], [0, py - 0.05, z0 + 0.55], 0.06, { r: 0.006 });
    k.sbar(ST, [0, 0.06, z1 - 0.06], [0, py - 0.05, z1 - 0.3], 0.06, { r: 0.006 });
    k.box('oakLight', 0.27, 0.015, 1.18, { y: py - 0.043, z: z0 + 0.95 });
    k.box(PAD, 0.29, 0.07, 1.2, { y: py, z: z0 + 0.95, r: 0.025 });
  } else {
    // seat + inclined back pad (≈ 45°) rising towards the uprights, foot plate at the front
    const sy = 0.48, b = 0.825;
    k.sbar(ST, [0, 0.12, z0 + 1.25], [0, sy - 0.05, z0 + 1.25], 0.06, { r: 0.006 });
    k.box('oakLight', 0.29, 0.015, 0.36, { y: sy - 0.043, z: z0 + 1.27 });
    k.box(PAD, 0.31, 0.07, 0.38, { y: sy, z: z0 + 1.27, r: 0.025 });
    k.sbar(ST, [0, 0.12, z0 + 0.62], [0, 0.85, z0 + 0.62], 0.06, { r: 0.006 });
    k.sbar(ST, [0, 0.12, z0 + 1.08], [0, 0.66, z0 + 0.62], 0.05, { r: 0.006 });
    k.push({ y: 0.86, z: z0 + 0.72, rx: b });
    k.box('oakLight', 0.29, 0.015, 0.86, { y: -0.043 });
    k.box(PAD, 0.31, 0.07, 0.88, { r: 0.025 });
    k.pop();
    k.sbar(ST, [0, 0.06, z1 - 0.06], [0, 0.22, z1 - 0.12], 0.05, { r: 0.006 });
    k.bb('steelBrushed', -0.22, 0.2, z1 - 0.16, 0.22, 0.23, z1 - 0.06, { r: 0.006 });
  }
  barbell(k, barY + 0.01, barZ, W / 2 - 0.01);
  return k.build('benchPress', W, D, H, true);
}

function plateTree(p = {}, mat) {
  const W = p.w || 0.8, D = p.d || 0.65, H = p.h || 1.25, ST = p.frame || 'ironBlack';
  const k = new Kit(mat);
  k.bb(ST, -0.05, 0, -D / 2, 0.05, 0.06, D / 2, { r: 0.006 });
  k.bb(ST, -0.3, 0, -0.05, 0.3, 0.06, 0.05, { r: 0.006 });
  for (const s of [-1, 1]) {
    k.bb('rubberBlack', -0.06, 0, s * D / 2 - 0.06 * s - 0.03, 0.06, 0.012, s * D / 2 - 0.06 * s + 0.03);
    k.bb('rubberBlack', s * 0.27 - 0.03, 0, -0.06, s * 0.27 + 0.03, 0.012, 0.06);
  }
  k.bb(ST, -0.04, 0.06, -0.04, 0.04, H - 0.05, 0.04, { r: 0.006 });
  k.bb(ST, -0.05, H - 0.05, -0.05, 0.05, H, 0.05, { r: 0.008 });
  const hl = W / 2 - 0.06;
  const levels = [[0.3, 0.225, 0.05, [4, 3]], [0.72, 0.18, 0.04, [3, 4]], [1.06, 0.13, 0.03, [3, 2]]];
  for (const [y, r, t, counts] of levels) {
    for (const s of [-1, 1]) {
      k.cyl('steelBrushed', 0.025, 0.025, hl, { x: s * (0.04 + hl / 2), y, seg: 8, rz: Math.PI / 2 });
      k.cyl('steelBrushed', 0.032, 0.032, 0.015, { x: s * (0.04 + hl), y, seg: 8, rz: Math.PI / 2 });
      const n = counts[s < 0 ? 0 : 1];
      for (let i = 0; i < n; i++) plate(k, s * (0.06 + t / 2 + i * (t + 0.004)), y, 0, r, t);
    }
  }
  return k.build('plateTree', W, D, H, true);
}

function smithMachine(p = {}, mat) {
  const W = p.w || 2.1, D = p.d || 1.5, H = p.h || 2.25, ST = p.frame || BODY, bench = p.bench !== false;
  const k = new Kit(mat);
  const px = 0.8, pz = D / 2 - 0.07, t = 0.07, rx = 0.5, barY = 1.25;
  // frame: four posts, base rails, top rails, centre cross beams carrying the guide rods
  for (const sx of [-1, 1]) {
    k.bb(ST, sx * px - t / 2, 0, -D / 2, sx * px + t / 2, 0.06, D / 2, { r: 0.006 });
    for (const sz of [-1, 1]) {
      k.bb(ST, sx * px - t / 2, 0.06, sz * pz - t / 2, sx * px + t / 2, H, sz * pz + t / 2, { r: 0.006 });
      k.bb('rubberBlack', sx * px - 0.045, 0, sz * (D / 2 - 0.04) - 0.04, sx * px + 0.045, 0.012, sz * (D / 2 - 0.04) + 0.04);
    }
    k.bb(ST, sx * px - t / 2, H - t, -pz, sx * px + t / 2, H, pz, { r: 0.006 });
    // guide rod with its linear bearing + safety stop
    k.cyl('chrome', 0.017, 0.017, H - 0.14, { x: sx * rx, y: (H - 0.14) / 2 + 0.06, seg: 10 });
    k.bb('steelBrushed', sx * rx - 0.045, barY - 0.09, -0.045, sx * rx + 0.045, barY + 0.09, 0.045, { r: 0.008 });
    k.bb('rubberBlack', sx * rx - 0.03, 0.42, -0.03, sx * rx + 0.03, 0.48, 0.03);
    k.bb('steelBrushed', sx * rx - 0.04, 0.48, -0.04, sx * rx + 0.04, 0.5, 0.04);
    // hook handle on the carriage + plate horns on the rear posts
    k.bb('steelBrushed', sx * rx - 0.012, barY - 0.02, 0.045, sx * rx + 0.012, barY + 0.1, 0.075);
    k.cyl('steelBrushed', 0.025, 0.025, 0.22, { x: sx * px, y: 0.35, z: -pz + 0.14, rx: Math.PI / 2, seg: 8 });
    plate(k, sx * px, 0.35, -pz + 0.085, 0.225, 0.045, 'z');
    plate(k, sx * px, 0.35, -pz + 0.14, 0.2, 0.04, 'z');
  }
  for (const sz of [-1, 1]) k.bb(ST, -px, H - t, sz * pz - t / 2, px, H, sz * pz + t / 2, { r: 0.006 });
  k.bb(ST, -px, H - 0.08, -0.04, px, H - 0.02, 0.04, { r: 0.006 });
  k.bb(ST, -px, 0, -0.04, px, 0.06, 0.04, { r: 0.006 });
  k.bb(ST, -px, 0, -pz - t / 2, px, 0.06, -pz + t / 2, { r: 0.006 });
  // pull-up bar across the front
  k.cyl('chrome', 0.016, 0.016, 2 * px + 0.04, { y: H - 0.14, z: pz, rz: Math.PI / 2, seg: 10 });
  // bar on the carriages
  barbell(k, barY, 0.02, W / 2 - 0.01, [[0.225, 0.045], [0.16, 0.03]]);
  if (bench) {
    const py = 0.44;
    k.bb('ironBlack', -0.04, 0.06, -0.6, 0.04, 0.14, 0.6, { r: 0.006 });
    for (const z of [-0.6, 0.55]) k.bb('ironBlack', -0.25, 0, z - 0.04, 0.25, 0.06, z + 0.04, { r: 0.006 });
    for (const z of [-0.35, 0.35]) k.sbar('ironBlack', [0, 0.12, z], [0, py - 0.05, z], 0.06, { r: 0.006 });
    k.box('oakLight', 0.27, 0.015, 1.16, { y: py - 0.043, z: -0.02 });
    k.box('leatherBlack', 0.29, 0.07, 1.18, { y: py, z: -0.02, r: 0.025 });
  }
  return k.build('smithMachine', W, D, H, true);
}

function deadliftPlatform(p = {}, mat) {
  const W = p.w || 2.4, D = p.d || 1.8, bar = p.barbell !== false, T = 0.04;
  const k = new Kit(mat);
  const cw = Math.min(1.2, W - 0.8);                          // wood stand-in strip between the rubber drop zones
  k.bb('ironBlack', -W / 2, 0, -D / 2, W / 2, T - 0.004, D / 2);
  const n = 6, pw = cw / n;
  for (let i = 0; i < n; i++) k.bb(i % 2 ? 'oak' : 'oakLight', -cw / 2 + i * pw + 0.002, T - 0.006, -D / 2 + 0.03, -cw / 2 + (i + 1) * pw - 0.002, T, D / 2 - 0.03);
  for (const s of [-1, 1]) {
    k.bb('rubberBlack', s * cw / 2, T - 0.006, -D / 2 + 0.03, s * (W / 2 - 0.03), T, -0.002);
    k.bb('rubberBlack', s * cw / 2, T - 0.006, 0.002, s * (W / 2 - 0.03), T, D / 2 - 0.03);
  }
  let H = T;
  if (bar) {
    const r = 0.225;
    barbell(k, T + r, 0.15, 1.1, [[r, 0.06], [r, 0.06], [0.16, 0.035]]);
    H = T + 2 * r;
    // chalk bowl in a rear corner
    k.lathe('steelBrushed', [[0, 0], [0.12, 0], [0.16, 0.08], [0.15, 0.09], [0.1, 0.02], [0, 0.02]], { x: W / 2 - 0.25, y: T, z: -D / 2 + 0.25, seg: 14 });
    k.cyl('linenWhite', 0.14, 0.14, 0.01, { x: W / 2 - 0.25, y: T + 0.04, z: -D / 2 + 0.25, seg: 14 });
  }
  return k.build('deadliftPlatform', W, D, p.h || H, false);
}

function latPulldown(p = {}, mat) {
  const W = p.w || 1.2, D = p.d || 1.6, H = p.h || 2.2, ST = p.frame || BODY, PAD = p.fabric || 'leatherBlack';
  const k = new Kit(mat);
  const z0 = -D / 2, z1 = D / 2, tz = z0 + 0.2;
  // base: spine + rear and front feet
  k.bb(ST, -0.06, 0, z0, 0.06, 0.07, z1 - 0.05, { r: 0.008 });
  k.bb(ST, -0.42, 0, z0, 0.42, 0.06, z0 + 0.4, { r: 0.008 });
  k.bb(ST, -0.4, 0, z1 - 0.1, 0.4, 0.06, z1, { r: 0.008 });
  for (const s of [-1, 1]) k.bb('rubberBlack', s * 0.36 - 0.04, 0, z1 - 0.1, s * 0.36 + 0.04, 0.012, z1);
  // tower: twin posts, stack, top cap, side shrouds
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.bb(ST, sx * 0.22 - 0.035, 0.06, tz + sz * 0.13 - 0.035, sx * 0.22 + 0.035, H - 0.12, tz + sz * 0.13 + 0.035, { r: 0.006 });
  for (const sx of [-1, 1]) k.bb(BODY, sx * 0.25 - 0.006, 0.35, tz - 0.12, sx * 0.25 + 0.006, H - 0.3, tz + 0.12, { r: 0.003 });
  const top = weightStack(k, 0, tz, 0.12, 17, H - 0.14, { w: 0.3, d: 0.14 });
  k.bb(ST, -0.27, H - 0.14, tz - 0.18, 0.27, H - 0.06, tz + 0.18, { r: 0.01 });
  // overhead boom with the high pulley
  k.sbar(ST, [0, H - 0.1, tz + 0.1], [0, H - 0.1, z0 + 1.05], 0.1, { r: 0.01, roll: 0 });
  k.bb(ST, -0.05, H - 0.1, z0 + 0.95, 0.05, H, z0 + 1.08, { r: 0.008 });
  pulley(k, 0, H - 0.07, tz, 0.05);
  pulley(k, 0, H - 0.17, z0 + 1.02, 0.05);
  cable(k, [0, top + 0.22, tz], [0, H - 0.12, tz]);
  cable(k, [0, H - 0.04, tz + 0.04], [0, H - 0.04, z0 + 0.98]);
  const by = 1.82, bz = z0 + 1.02;
  cable(k, [0, H - 0.22, bz], [0, by + 0.02, bz]);
  // lat bar with bent ends + grips
  k.bar('chrome', [-0.38, by, bz], [0.38, by, bz], 0.014, { seg: 8 });
  for (const s of [-1, 1]) {
    k.bar('chrome', [s * 0.38, by, bz], [s * (W / 2 - 0.02), by - 0.12, bz], 0.014, { seg: 8 });
    k.bar('rubberBlack', [s * 0.42, by - 0.025, bz], [s * (W / 2 - 0.02), by - 0.12, bz], 0.019, { seg: 8 });
  }
  // low-row pulley + foot plate on the base, V-handle parked on it
  pulley(k, 0, 0.18, tz + 0.2, 0.045);
  k.bb(ST, -0.05, 0.06, tz + 0.15, 0.05, 0.24, tz + 0.24);
  k.box('steelBrushed', 0.5, 0.03, 0.28, { y: 0.2, z: z0 + 0.62, rx: -0.9, r: 0.008 });
  k.sbar(ST, [0, 0.07, z0 + 0.72], [0, 0.18, z0 + 0.66], 0.05, { r: 0.006 });
  cable(k, [0, 0.18, tz + 0.24], [0, 0.32, z0 + 0.6]);
  k.tube('chrome', [[-0.08, 0.33, z0 + 0.62], [0, 0.38, z0 + 0.6], [0.08, 0.33, z0 + 0.62]], 0.012, { ts: 8, rs: 6 });
  // seat post, seat, thigh hold-down rollers
  const sz = z0 + 1.2, sy = 0.5;
  k.sbar(ST, [0, 0.07, sz], [0, sy - 0.05, sz], 0.07, { r: 0.008 });
  k.box(PAD, 0.42, 0.08, 0.36, { y: sy, z: sz, r: 0.03 });
  k.sbar(ST, [0, 0.07, z0 + 0.93], [0, 0.72, z0 + 0.98], 0.06, { r: 0.006 });
  k.bb('steelBrushed', -0.04, 0.68, z0 + 0.95, 0.04, 0.76, z0 + 1.02);
  k.cyl('chrome', 0.014, 0.014, 0.42, { y: 0.74, z: z0 + 0.99, rz: Math.PI / 2, seg: 8 });
  for (const s of [-1, 1]) k.cyl(PAD, 0.06, 0.06, 0.15, { x: s * 0.13, y: 0.74, z: z0 + 0.99, rz: Math.PI / 2, seg: 14 });
  return k.build('latPulldown', W, D, H, true);
}

function legPress(p = {}, mat) {
  const W = p.w || 1.5, D = p.d || 2.3, H = p.h || 1.5, ST = p.frame || BODY, PAD = p.fabric || 'leatherBlack';
  const k = new Kit(mat);
  const z0 = -D / 2, z1 = D / 2;
  // floor frame
  for (const s of [-1, 1]) k.bb(ST, s * 0.45 - 0.04, 0, z0, s * 0.45 + 0.04, 0.08, z1, { r: 0.008 });
  k.bb(ST, -0.49, 0, z0, 0.49, 0.08, z0 + 0.1, { r: 0.008 });
  k.bb(ST, -0.49, 0, z1 - 0.1, 0.49, 0.08, z1, { r: 0.008 });
  k.bb(ST, -0.49, 0, -0.05, 0.49, 0.08, 0.05, { r: 0.008 });
  // inclined sled rails (≈ 40°) from the seat up to the rear A-frame
  const B = [0.45, 0.15], T = [1.42, z0 + 0.12];            // [y, z] bottom / top
  const a = Math.atan2(T[0] - B[0], B[1] - T[1]);
  for (const s of [-1, 1]) {
    k.sbar('steelBrushed', [s * 0.3, B[0], B[1]], [s * 0.3, T[0], T[1]], 0.06, { r: 0.006 });
    k.sbar(ST, [s * 0.45, 0.08, z0 + 0.05], [s * 0.3, H - 0.04, z0 + 0.1], 0.08, { r: 0.008 });
    k.sbar(ST, [s * 0.45, 0.08, B[1] + 0.05], [s * 0.3, B[0], B[1]], 0.07, { r: 0.008 });
    const mz = -0.8, my = B[0] + (B[1] - mz) / (B[1] - T[1]) * (T[0] - B[0]);
    k.sbar(ST, [s * 0.45, 0.08, mz], [s * 0.3, my - 0.03, mz], 0.06, { r: 0.006 });
  }
  k.bb(ST, -0.34, H - 0.08, z0 + 0.06, 0.34, H, z0 + 0.16, { r: 0.008 });
  // sled: carriage, foot plate, plate horns with plates
  const s0 = 0.5, cy = B[0] + s0 * (T[0] - B[0]), cz = B[1] + s0 * (T[1] - B[1]);
  k.push({ y: cy, z: cz, rx: a });
  k.box(ST, 0.7, 0.08, 0.45, { y: 0.07, r: 0.01 });
  k.box('steelBrushed', 0.8, 0.62, 0.04, { y: 0.42, z: 0.18, r: 0.01 });
  k.box('rubberBlack', 0.74, 0.56, 0.01, { y: 0.42, z: 0.205 });
  k.sbar(ST, [0, 0.1, -0.2], [0, 0.42, 0.16], 0.06, { r: 0.006 });
  for (const s of [-1, 1]) {
    k.cyl('steelBrushed', 0.025, 0.025, 0.36, { x: s * 0.53, y: 0.14, z: -0.08, rz: Math.PI / 2, seg: 8 });
    plate(k, s * 0.4, 0.14, -0.08, 0.225, 0.05);
    plate(k, s * 0.46, 0.14, -0.08, 0.225, 0.05);
    plate(k, s * 0.51, 0.14, -0.08, 0.16, 0.03);
    k.cyl('steelBrushed', 0.035, 0.035, 0.015, { x: s * 0.715, y: 0.14, z: -0.08, rz: Math.PI / 2, seg: 8 });
  }
  k.pop();
  // seat + reclined back pad, handles + safety levers
  const sz = z1 - 0.6, sy = 0.45;
  k.sbar(ST, [0, 0.08, sz], [0, sy - 0.05, sz], 0.08, { r: 0.008 });
  k.bb(ST, -0.3, sy - 0.08, sz - 0.2, 0.3, sy - 0.04, z1 - 0.12, { r: 0.006 });
  k.box(PAD, 0.5, 0.08, 0.36, { y: sy, z: sz, r: 0.03 });
  k.sbar(ST, [0, 0.08, z1 - 0.1], [0, 0.82, z1 - 0.25], 0.07, { r: 0.008 });
  k.push({ y: 0.82, z: z1 - 0.24, rx: -1.0 });
  k.box(PAD, 0.5, 0.08, 0.76, { r: 0.03 });
  k.pop();
  for (const s of [-1, 1]) {
    k.sbar(ST, [s * 0.3, sy - 0.06, sz - 0.1], [s * 0.36, 0.62, sz - 0.05], 0.04, { r: 0.006 });
    k.bar('chrome', [s * 0.36, 0.62, sz - 0.2], [s * 0.36, 0.62, sz + 0.12], 0.016, { seg: 8 });
    k.bar('rubberBlack', [s * 0.36, 0.62, sz - 0.12], [s * 0.36, 0.62, sz + 0.1], 0.021, { seg: 8 });
    k.bar('steelBrushed', [s * 0.3, B[0] + 0.1, B[1] - 0.12], [s * 0.42, 0.75, B[1] - 0.1], 0.014, { seg: 6 });
  }
  return k.build('legPress', W, D, H, true);
}

function legExtension(p = {}, mat) {
  const W = p.w || 1.0, D = p.d || 1.5, H = p.h || 1.6, ST = p.frame || BODY, PAD = p.fabric || 'leatherBlack';
  const k = new Kit(mat);
  const z0 = -D / 2, z1 = D / 2, tz = z0 + 0.2;
  k.bb(ST, -0.06, 0, z0, 0.06, 0.07, z1 - 0.25, { r: 0.008 });
  k.bb(ST, -W / 2 + 0.02, 0, z0, W / 2 - 0.02, 0.06, z0 + 0.4, { r: 0.008 });
  k.bb(ST, -0.42, 0, z1 - 0.38, 0.42, 0.06, z1 - 0.28, { r: 0.008 });
  for (const s of [-1, 1]) k.bb('rubberBlack', s * 0.38 - 0.04, 0, z1 - 0.38, s * 0.38 + 0.04, 0.012, z1 - 0.28);
  // stack tower behind the seat
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.bb(ST, sx * 0.22 - 0.035, 0.06, tz + sz * 0.13 - 0.035, sx * 0.22 + 0.035, H - 0.08, tz + sz * 0.13 + 0.035, { r: 0.006 });
  for (const sx of [-1, 1]) k.bb(BODY, sx * 0.25 - 0.006, 0.3, tz - 0.12, sx * 0.25 + 0.006, H - 0.25, tz + 0.12, { r: 0.003 });
  const top = weightStack(k, 0, tz, 0.12, 13, H - 0.1, { w: 0.3, d: 0.14 });
  k.bb(ST, -0.27, H - 0.1, tz - 0.18, 0.27, H, tz + 0.18, { r: 0.01 });
  pulley(k, 0, H - 0.14, tz, 0.045);
  cable(k, [0, top + 0.22, tz], [0, H - 0.17, tz]);
  cable(k, [0, H - 0.12, tz + 0.04], [0.34, 0.56, z0 + 1.1]);
  // seat + back pad + side grips
  const sz = z0 + 0.92, sy = 0.5;
  k.sbar(ST, [0, 0.07, sz], [0, sy - 0.05, sz], 0.07, { r: 0.008 });
  k.bb(ST, -0.04, sy - 0.08, z0 + 0.4, 0.04, sy - 0.04, sz + 0.1, { r: 0.006 });
  k.box(PAD, 0.42, 0.08, 0.42, { y: sy, z: sz, r: 0.03 });
  k.sbar(ST, [0, sy - 0.06, z0 + 0.62], [0, 1.15, z0 + 0.58], 0.06, { r: 0.006 });
  k.push({ y: 0.88, z: z0 + 0.66, rx: -0.12 });
  k.box(PAD, 0.42, 0.55, 0.08, { r: 0.03 });
  k.pop();
  for (const s of [-1, 1]) {
    k.sbar(ST, [s * 0.04, sy - 0.06, sz], [s * 0.3, sy - 0.02, sz], 0.035);
    k.bar('chrome', [s * 0.3, sy - 0.02, sz - 0.15], [s * 0.3, sy - 0.02, sz + 0.12], 0.014, { seg: 8 });
    k.bar('rubberBlack', [s * 0.3, sy - 0.02, sz - 0.12], [s * 0.3, sy - 0.02, sz + 0.05], 0.02, { seg: 8 });
  }
  // knee-axis cam + lever arm with shin roller and thigh hold-down
  const kz = z0 + 1.15, ky = 0.55;
  k.cyl('steelBrushed', 0.09, 0.09, 0.03, { x: 0.36, y: ky, z: kz, rz: Math.PI / 2, seg: 16 });
  k.cyl(ST, 0.03, 0.03, 0.12, { x: 0.3, y: ky, z: kz, rz: Math.PI / 2, seg: 8 });
  k.sbar(ST, [0.3, 0.06, kz - 0.05], [0.3, ky, kz], 0.06, { r: 0.006 });
  k.sbar(ST, [0.35, ky, kz], [0.35, 0.24, z1 - 0.1], 0.05, { r: 0.006 });
  k.cyl('chrome', 0.014, 0.014, 0.5, { x: 0.12, y: 0.24, z: z1 - 0.08, rz: Math.PI / 2, seg: 8 });
  for (const s of [-1, 1]) k.cyl(PAD, 0.065, 0.065, 0.15, { x: s * 0.12, y: 0.24, z: z1 - 0.08, rz: Math.PI / 2, seg: 14 });
  k.sbar(ST, [-0.3, sy - 0.06, kz - 0.1], [-0.3, 0.68, kz - 0.06], 0.04, { r: 0.006 });
  k.cyl('chrome', 0.014, 0.014, 0.5, { x: -0.08, y: 0.68, z: kz - 0.06, rz: Math.PI / 2, seg: 8 });
  for (const s of [-1, 1]) k.cyl(PAD, 0.055, 0.055, 0.14, { x: s * 0.11, y: 0.68, z: kz - 0.06, rz: Math.PI / 2, seg: 14 });
  return k.build('legExtension', W, D, H, true);
}

function chestPress(p = {}, mat) {
  const W = p.w || 1.3, D = p.d || 1.5, H = p.h || 1.75, ST = p.frame || BODY, PAD = p.fabric || 'leatherBlack';
  const k = new Kit(mat);
  const z0 = -D / 2, z1 = D / 2, tz = z0 + 0.2;
  k.bb(ST, -0.06, 0, z0, 0.06, 0.07, z1 - 0.05, { r: 0.008 });
  k.bb(ST, -0.45, 0, z0, 0.45, 0.06, z0 + 0.4, { r: 0.008 });
  k.bb(ST, -0.42, 0, z1 - 0.1, 0.42, 0.06, z1, { r: 0.008 });
  for (const s of [-1, 1]) k.bb('rubberBlack', s * 0.38 - 0.04, 0, z1 - 0.1, s * 0.38 + 0.04, 0.012, z1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.bb(ST, sx * 0.22 - 0.035, 0.06, tz + sz * 0.13 - 0.035, sx * 0.22 + 0.035, H - 0.1, tz + sz * 0.13 + 0.035, { r: 0.006 });
  for (const sx of [-1, 1]) k.bb(BODY, sx * 0.25 - 0.006, 0.3, tz - 0.12, sx * 0.25 + 0.006, H - 0.3, tz + 0.12, { r: 0.003 });
  const top = weightStack(k, 0, tz, 0.12, 15, H - 0.12, { w: 0.3, d: 0.14 });
  k.bb(ST, -0.27, H - 0.12, tz - 0.18, 0.27, H - 0.04, tz + 0.18, { r: 0.01 });
  pulley(k, 0, H - 0.16, tz, 0.045);
  cable(k, [0, top + 0.22, tz], [0, H - 0.19, tz]);
  // overhead pivot beam carrying the two converging press arms
  const pz = z0 + 0.55, py = H - 0.12;
  k.sbar(ST, [0, H - 0.08, tz + 0.1], [0, py, pz + 0.1], 0.1, { r: 0.01 });
  k.cyl('steelBrushed', 0.05, 0.05, 0.7, { y: py, z: pz, rz: Math.PI / 2, seg: 14 });
  cable(k, [0, H - 0.12, tz + 0.05], [0, py - 0.03, pz - 0.05]);
  for (const s of [-1, 1]) {
    k.cyl(ST, 0.06, 0.06, 0.08, { x: s * 0.33, y: py, z: pz, rz: Math.PI / 2, seg: 12 });
    k.tube(ST, [[s * 0.33, py, pz], [s * 0.45, py - 0.12, pz + 0.3], [s * 0.5, 1.12, pz + 0.62], [s * 0.48, 1.0, pz + 0.72]], 0.032, { ts: 12, rs: 8 });
    // horizontal + vertical grips
    k.bar('chrome', [s * 0.48, 1.0, pz + 0.72], [s * (W / 2 - 0.02), 1.0, pz + 0.72], 0.016, { seg: 8 });
    k.bar('rubberBlack', [s * 0.52, 1.0, pz + 0.72], [s * (W / 2 - 0.02), 1.0, pz + 0.72], 0.021, { seg: 8 });
    k.bar('rubberBlack', [s * 0.47, 0.92, pz + 0.66], [s * 0.47, 1.08, pz + 0.75], 0.02, { seg: 8 });
  }
  // seat, back pad, foot assist bar
  const sz = z0 + 0.82, sy = 0.5;
  k.sbar(ST, [0, 0.07, sz], [0, sy - 0.05, sz], 0.07, { r: 0.008 });
  k.box(PAD, 0.44, 0.08, 0.4, { y: sy, z: sz, r: 0.03 });
  k.sbar(ST, [0, 0.07, z0 + 0.5], [0, 1.35, z0 + 0.5], 0.07, { r: 0.008 });
  k.push({ y: 0.98, z: z0 + 0.58, rx: -0.08 });
  k.box(PAD, 0.42, 0.72, 0.08, { r: 0.03 });
  k.pop();
  k.sbar(ST, [0, 0.07, z1 - 0.35], [0, 0.22, z1 - 0.25], 0.04);
  k.bar('chrome', [-0.18, 0.22, z1 - 0.25], [0.18, 0.22, z1 - 0.25], 0.014, { seg: 8 });
  return k.build('chestPress', W, D, H, true);
}

export const GYM = {
  treadmill, squatRack, weightBench, dumbbellRack, rowingMachine, yogaMat,
  cableCrossover, benchPress, plateTree, smithMachine, deadliftPlatform, latPulldown, legPress, legExtension, chestPress,
};

export const INFO = {
  treadmill: { w: 0.85, d: 2.0, h: 1.45, mount: 'floor', solid: true },
  squatRack: { w: 2.2, d: 1.7, h: 2.3, mount: 'floor', solid: true },
  weightBench: { w: 0.6, d: 1.35, h: 0.47, mount: 'floor', solid: true },
  dumbbellRack: { w: 1.4, d: 0.55, h: 0.85, mount: 'floor', solid: true },
  rowingMachine: { w: 0.6, d: 2.45, h: 0.95, mount: 'floor', solid: true },
  yogaMat: { w: 0.61, d: 1.83, h: 0.11, mount: 'floor', solid: false },
  cableCrossover: { w: 2.6, d: 1.1, h: 2.3, mount: 'floor', solid: true },
  benchPress: { w: 2.1, d: 1.75, h: 1.4, mount: 'floor', solid: true },     // incline: true → h 1.55
  plateTree: { w: 0.8, d: 0.65, h: 1.25, mount: 'floor', solid: true },
  smithMachine: { w: 2.1, d: 1.5, h: 2.25, mount: 'floor', solid: true },
  deadliftPlatform: { w: 2.4, d: 1.8, h: 0.49, mount: 'floor', solid: false }, // walkable; h incl. the loaded bar
  latPulldown: { w: 1.2, d: 1.6, h: 2.2, mount: 'floor', solid: true },
  legPress: { w: 1.5, d: 2.3, h: 1.5, mount: 'floor', solid: true },
  legExtension: { w: 1.0, d: 1.5, h: 1.6, mount: 'floor', solid: true },
  chestPress: { w: 1.3, d: 1.5, h: 1.75, mount: 'floor', solid: true },
};
void THREE; void seeded;
