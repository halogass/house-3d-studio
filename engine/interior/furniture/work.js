// Furniture: workshop / lab / tech (workbench, toolWall, labBench, shelvingUnit, serverRack).
// Local frame per docs/SCHEMA.md "Furniture" (+Z = user side / front).
import * as THREE from 'three';
import { Kit, seeded, knob } from './bedroom.js';

const RED = 'lacquer:#a8322a', YELLOW = 'lacquer:#d9a520', GREY = 'lacquer:#5a5f66', BLUEGREY = 'lacquer:#3d5a73';

function workbench(p = {}, mat) {
  const W = p.w || 2.0, D = p.d || 0.8, H = p.h || 0.9, TOP = p.top || 'oak', F = p.frame || 'oak';
  const k = new Kit(mat);
  const R = seeded('workbench', p);
  // laminated butcher-block top (strips)
  const n = Math.round(D / 0.05);
  for (let i = 0; i < n; i++) k.bb(TOP, -W / 2, H - 0.06, -D / 2 + i * D / n, W / 2, H, -D / 2 + (i + 1) * D / n - 0.0015, { r: i === 0 || i === n - 1 ? 0.008 : 0 });
  // legs, aprons, stretchers, lower shelf
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.bb(F, sx * (W / 2 - 0.08) - 0.04, 0, sz * (D / 2 - 0.08) - 0.04, sx * (W / 2 - 0.08) + 0.04, H - 0.06, sz * (D / 2 - 0.08) + 0.04, { r: 0.005 });
  k.bb(F, -W / 2 + 0.06, H - 0.16, -D / 2 + 0.06, W / 2 - 0.06, H - 0.06, -D / 2 + 0.09);
  for (const sx of [-1, 1]) k.bb(F, sx * (W / 2 - 0.08) - 0.03, 0.1, -D / 2 + 0.1, sx * (W / 2 - 0.08) + 0.03, 0.16, D / 2 - 0.1);
  k.bb('oakLight', -W / 2 + 0.12, 0.16, -D / 2 + 0.1, W / 2 - 0.12, 0.18, D / 2 - 0.1);
  // two drawers under the top (front)
  for (const s of [-1, 1]) {
    k.bb(F, s * W / 4 - 0.3, H - 0.16, D / 2 - 0.1, s * W / 4 + 0.3, H - 0.065, D / 2 - 0.08, { r: 0.004 });
    k.bar('steelBrushed', [s * W / 4 - 0.07, H - 0.11, D / 2 - 0.06], [s * W / 4 + 0.07, H - 0.11, D / 2 - 0.06], 0.006, { seg: 6 });
  }
  // storage bins on the shelf
  for (let i = 0; i < 3; i++) k.box(i % 2 ? GREY : BLUEGREY, 0.38, 0.2, 0.5, { x: -W / 2 + 0.4 + i * 0.55, y: 0.28, z: 0, r: 0.01 });
  // front vice (left)
  const vx = -W / 2 + 0.3, vz = D / 2;
  k.bb('ironBlack', vx - 0.09, H - 0.11, vz - 0.12, vx + 0.09, H - 0.01, vz - 0.02, { r: 0.008 });
  k.bb('ironBlack', vx - 0.1, H - 0.12, vz + 0.02, vx + 0.1, H + 0.02, vz + 0.06, { r: 0.008 });
  k.bb('steelBrushed', vx - 0.1, H - 0.0, vz + 0.0, vx + 0.1, H + 0.02, vz + 0.02);
  k.cyl('steelBrushed', 0.014, 0.014, 0.12, { x: vx, y: H - 0.07, z: vz + 0.05, rx: Math.PI / 2, seg: 8 });
  k.bar('steelBrushed', [vx - 0.14, H - 0.07, vz + 0.1], [vx + 0.14, H - 0.07, vz + 0.1], 0.008, { seg: 6 });
  for (const s of [-1, 1]) k.sph('ironBlack', 0.016, { x: vx + s * 0.14, y: H - 0.07, z: vz + 0.1, ws: 6, hs: 4 });
  // tools on the bench: mallet, hand plane, clamp
  k.box('oak', 0.06, 0.06, 0.11, { x: 0.3, y: H + 0.03, z: 0.12, r: 0.008 });
  k.bar('oak', [0.3, H + 0.02, 0.12], [0.3 + 0.24, H + 0.016, 0.18], 0.012, { seg: 6 });
  k.box(RED, 0.06, 0.05, 0.24, { x: 0.65, y: H + 0.025, z: -0.05, ry: 0.4 + R() * 0.1, r: 0.01 });
  k.box('ironBlack', 0.05, 0.02, 0.2, { x: 0.65, y: H + 0.06, z: -0.05, ry: 0.45, r: 0.006 });
  return k.build('workbench', W, D, H, true);
}

function toolWall(p = {}, mat) {
  const W = p.w || 2.0, H = p.h || 1.2, y0 = p.y ?? 1.0;
  const k = new Kit(mat);
  const z = 0.02;
  for (const fy of [0.05, 0.5, 0.95]) k.bb('oak', -W / 2, y0 + H * fy - 0.025, 0, W / 2, y0 + H * fy + 0.025, z);
  k.bb('pegboard', -W / 2, y0, z, W / 2, y0 + H, z + 0.006);
  const fz = z + 0.006;
  const hook = (x, y) => k.bar('chrome', [x, y, fz], [x, y + 0.01, fz + 0.06], 0.003, { seg: 4 });
  let x = -W / 2 + 0.12;
  // hammers
  for (let i = 0; i < 2; i++, x += 0.12) {
    hook(x - 0.02, y0 + H - 0.2); hook(x + 0.02, y0 + H - 0.2);
    k.box('oak', 0.025, 0.32, 0.02, { x, y: y0 + H - 0.38, z: fz + 0.035, r: 0.008 });
    k.box('ironBlack', 0.12, 0.03, 0.03, { x, y: y0 + H - 0.205, z: fz + 0.035, r: 0.006 });
  }
  // wrench set, graded
  for (let i = 0; i < 8; i++, x += 0.045) {
    const len = 0.14 + i * 0.02;
    hook(x, y0 + H - 0.15);
    k.box('chrome', 0.014 + i * 0.001, len, 0.006, { x, y: y0 + H - 0.16 - len / 2, z: fz + 0.025 });
    k.torus('chrome', 0.012 + i * 0.001, 0.004, { x, y: y0 + H - 0.16 - len, z: fz + 0.025, arc: Math.PI * 1.5, rz: -Math.PI * 0.25, rs: 3, ts: 8 });
  }
  x += 0.05;
  // screwdrivers in a rack
  k.bb('steelBrushed', x - 0.02, y0 + 0.6, fz, x + 0.3, y0 + 0.62, fz + 0.06);
  for (let i = 0; i < 6; i++) {
    const sx = x + i * 0.05;
    k.cyl(i % 2 ? RED : YELLOW, 0.012, 0.014, 0.1, { x: sx, y: y0 + 0.68, z: fz + 0.035, seg: 6 });
    k.cyl('chrome', 0.003, 0.003, 0.12, { x: sx, y: y0 + 0.57, z: fz + 0.035, seg: 4 });
  }
  // saw
  const sx = x + 0.55;
  hook(sx, y0 + H - 0.12);
  const saw = new THREE.Shape();
  saw.moveTo(-0.05, 0); saw.lineTo(0.05, 0); saw.lineTo(0.09, -0.5); saw.lineTo(-0.03, -0.5); saw.closePath();
  k.ext('steelBrushed', saw, 0.002, { x: sx, y: y0 + H - 0.24, z: fz + 0.03 });
  k.box('oak', 0.12, 0.14, 0.025, { x: sx, y: y0 + H - 0.17, z: fz + 0.03, r: 0.01 });
  // pliers / clamps / tape / level on the right
  let rx = sx + 0.25;
  for (let i = 0; i < 3; i++, rx += 0.09) {
    hook(rx, y0 + 0.9);
    k.box(i ? RED : BLUEGREY, 0.025, 0.12, 0.015, { x: rx - 0.012, y: y0 + 0.8, z: fz + 0.03, rz: 0.12, r: 0.006 });
    k.box(i ? RED : BLUEGREY, 0.025, 0.12, 0.015, { x: rx + 0.012, y: y0 + 0.8, z: fz + 0.03, rz: -0.12, r: 0.006 });
    k.box('ironBlack', 0.03, 0.06, 0.016, { x: rx, y: y0 + 0.89, z: fz + 0.03 });
  }
  if (rx < W / 2 - 0.15) {
    k.cyl(YELLOW, 0.04, 0.04, 0.035, { x: rx + 0.03, y: y0 + 0.3, z: fz + 0.04, rx: Math.PI / 2, seg: 14 });
    hook(rx + 0.03, y0 + 0.35);
  }
  k.box(YELLOW, Math.min(0.6, W * 0.3), 0.05, 0.025, { x: -W / 2 + 0.4, y: y0 + 0.2, z: fz + 0.03, r: 0.006 });
  hook(-W / 2 + 0.2, y0 + 0.24); hook(-W / 2 + 0.6, y0 + 0.24);
  // top shelf with paint tins
  k.bb('oak', -W / 2, y0 + H + 0.02, 0, W / 2, y0 + H + 0.04, 0.12);
  for (let i = 0; i < Math.floor(W / 0.2); i++) k.cyl(i % 3 ? 'steelBrushed' : RED, 0.045, 0.045, 0.1, { x: -W / 2 + 0.12 + i * 0.2, y: y0 + H + 0.09, z: 0.065, seg: 12 });
  return k.build('toolWall', W, 0.12, H, false, { y: y0 });
}

function labBench(p = {}, mat) {
  const W = p.w || 2.0, D = p.d || 0.8, H = p.h || 0.9, TOP = p.top || BLUEGREY, ST = p.frame || 'steelBrushed';
  const k = new Kit(mat);
  const top = H;
  k.bb('oakLight', -W / 2, top - 0.04, -D / 2, W / 2, top - 0.004, D / 2, { r: 0.004 });
  k.bb(TOP, -W / 2 + 0.01, top - 0.004, -D / 2 + 0.01, W / 2 - 0.01, top, D / 2 - 0.01);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.bb(ST, sx * (W / 2 - 0.05) - 0.025, 0, sz * (D / 2 - 0.05) - 0.025, sx * (W / 2 - 0.05) + 0.025, top - 0.04, sz * (D / 2 - 0.05) + 0.025);
  for (const sx of [-1, 1]) k.bb(ST, sx * (W / 2 - 0.05) - 0.02, 0.12, -D / 2 + 0.05, sx * (W / 2 - 0.05) + 0.02, 0.16, D / 2 - 0.05);
  k.bb(ST, -W / 2 + 0.05, 0.12, -D / 2 + 0.03, W / 2 - 0.05, 0.16, -D / 2 + 0.07);
  // drawer pedestal (right)
  const px = W / 2 - 0.3;
  k.bb(GREY, px - 0.22, 0.05, -D / 2 + 0.08, px + 0.22, top - 0.06, D / 2 - 0.05, { r: 0.006 });
  for (let i = 0; i < 4; i++) {
    const y = 0.1 + i * 0.19;
    k.bb(GREY, px - 0.21, y, D / 2 - 0.05, px + 0.21, y + 0.17, D / 2 - 0.035, { r: 0.004 });
    k.bar('steelBrushed', [px - 0.08, y + 0.14, D / 2 - 0.025], [px + 0.08, y + 0.14, D / 2 - 0.025], 0.005, { seg: 6 });
  }
  // rear uprights + instrument shelf + power strip + LED task light
  const sy = top + 0.5, bz = -D / 2 + 0.04;
  for (const s of [-1, 1]) k.bb(ST, s * (W / 2 - 0.05) - 0.02, top, bz - 0.02, s * (W / 2 - 0.05) + 0.02, sy + 0.25, bz + 0.02);
  k.bb(ST, -W / 2 + 0.03, sy - 0.02, -D / 2 + 0.01, W / 2 - 0.03, sy, -D / 2 + 0.33);
  k.bb('ironBlack', -W / 2 + 0.1, top + 0.08, bz + 0.01, W / 2 - 0.1, top + 0.13, bz + 0.05);
  for (let i = 0; i < 10; i++) k.bb('trimWhite', -W / 2 + 0.2 + i * (W - 0.4) / 9 - 0.015, top + 0.095, bz + 0.05, -W / 2 + 0.2 + i * (W - 0.4) / 9 + 0.015, top + 0.115, bz + 0.052);
  k.bb(ST, -W / 2 + 0.06, sy + 0.23, -D / 2 + 0.0, W / 2 - 0.06, sy + 0.25, -D / 2 + 0.3);
  k.bb('coveLight', -W / 2 + 0.1, sy + 0.225, -D / 2 + 0.25, W / 2 - 0.1, sy + 0.23, -D / 2 + 0.28, { uv: false });
  k.light([0, sy + 0.18, -D / 2 + 0.3], { kind: 'spot', intensity: 3, distance: 3, color: '#f4f0ff' });
  // instruments on the shelf: oscilloscope, bench PSU, function generator
  const inst = (x, w, h, d, screen) => {
    k.box(GREY, w, h, d, { x, y: sy + h / 2, z: -D / 2 + 0.03 + d / 2, r: 0.008 });
    const fz = -D / 2 + 0.03 + d;
    if (screen) k.bb('screenOn', x - w / 2 + 0.03, sy + h * 0.25, fz, x - w / 2 + 0.03 + w * 0.5, sy + h * 0.85, fz + 0.002, { uv: false });
    for (let i = 0; i < 4; i++) knob(k, x + w / 2 - 0.05 - (i % 2) * 0.05, sy + h * (0.3 + 0.35 * (i >> 1)), fz, 0.01, 'ironBlack');
  };
  inst(-0.55, 0.36, 0.18, 0.26, true);
  inst(-0.1, 0.24, 0.14, 0.26, true);
  inst(0.3, 0.3, 0.1, 0.24, false);
  // monitor on a stand
  k.box('ironBlack', 0.24, 0.015, 0.18, { x: 0.1, y: top + 0.0075, z: -0.12, r: 0.004 });
  k.bb('ironBlack', 0.08, top, -0.18, 0.12, top + 0.32, -0.15);
  k.box('ironBlack', 0.62, 0.38, 0.03, { x: 0.1, y: top + 0.36, z: -0.14, r: 0.005 });
  k.bb('screenOn', 0.1 - 0.29, top + 0.185, -0.1245, 0.1 + 0.29, top + 0.535, -0.124, { uv: false });
  // keyboard, soldering station, magnifier
  k.box('ironBlack', 0.44, 0.02, 0.14, { x: 0.1, y: top + 0.01, z: 0.18, r: 0.005 });
  k.box(BLUEGREY, 0.16, 0.09, 0.14, { x: -0.6, y: top + 0.045, z: 0.05, r: 0.01 });
  k.bb('screenOn', -0.65, top + 0.05, 0.121, -0.55, top + 0.075, 0.122, { uv: false });
  k.tube('ironBlack', [[-0.48, top + 0.06, 0.05], [-0.42, top + 0.12, 0.08], [-0.38, top + 0.08, 0.14]], 0.004, { ts: 6, rs: 4 });
  // fume extractor: base + articulated arm + hood
  const ex = -W / 2 + 0.25;
  k.box(GREY, 0.2, 0.12, 0.2, { x: ex, y: top + 0.06, z: -0.2, r: 0.02 });
  k.tube(GREY, [[ex, top + 0.12, -0.2], [ex + 0.02, top + 0.45, -0.16], [ex + 0.1, top + 0.55, 0.0], [ex + 0.2, top + 0.4, 0.12]], 0.025, { ts: 16, rs: 8 });
  for (const t of [[ex + 0.02, top + 0.45, -0.16], [ex + 0.1, top + 0.55, 0.0]]) k.sph('ironBlack', 0.032, { x: t[0], y: t[1], z: t[2], ws: 8, hs: 6 });
  k.lathe(GREY, [[0.03, 0.08], [0.035, 0.06], [0.09, 0.0], [0.088, -0.005], [0.03, 0.055]], { x: ex + 0.22, y: top + 0.3, z: 0.13, rx: 0.4, seg: 14 });
  return k.build('labBench', W, D, top + 0.75, true);
}

function shelvingUnit(p = {}, mat) {
  const W = p.w || 1.2, D = p.d || 0.5, H = p.h || 2.0, ST = p.frame || 'steelBrushed';
  const k = new Kit(mat);
  const R = seeded('shelving' + W, p);
  // angle posts (two flanges each)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (W / 2 - 0.02), z = sz * (D / 2 - 0.02);
    k.bb(ST, x - 0.02, 0, z - 0.002, x + 0.02, H, z + 0.002);
    k.bb(ST, x - 0.002, 0, z - 0.02, x + 0.002, H, z + 0.02);
    k.cyl('rubberBlack', 0.02, 0.02, 0.01, { x, y: 0.005, z, seg: 8 });
  }
  const n = 5;
  for (let i = 0; i < n; i++) {
    const y = 0.12 + i * (H - 0.17) / (n - 1);
    k.bb(ST, -W / 2, y - 0.03, -D / 2, W / 2, y, D / 2);
    k.bb('oakLight', -W / 2 + 0.02, y, -D / 2 + 0.02, W / 2 - 0.02, y + 0.012, D / 2 - 0.02);
    if (i === n - 1) continue;
    // bins and boxes
    let x = -W / 2 + 0.05;
    const room = (H - 0.17) / (n - 1) - 0.06;
    while (x < W / 2 - 0.2) {
      const kind = R(), w = 0.25 + R() * 0.12;
      if (x + w > W / 2 - 0.04) break;
      const h = Math.min(room, kind < 0.5 ? 0.22 : 0.18 + R() * 0.15);
      if (kind < 0.5) {
        k.box(kind < 0.25 ? BLUEGREY : GREY, w, h, D - 0.08, { x: x + w / 2, y: y + 0.012 + h / 2, z: 0, r: 0.012 });
        k.box('trimWhite', 0.08, 0.03, 0.002, { x: x + w / 2, y: y + 0.012 + h * 0.7, z: (D - 0.08) / 2 + 0.002 });
      } else if (kind < 0.85) {
        k.box('lacquer:#b08a5a', w, h, D - 0.12, { x: x + w / 2, y: y + 0.012 + h / 2, z: -0.01, r: 0.003 });
      }
      x += w + 0.03;
    }
  }
  return k.build('shelvingUnit', W, D, H, true);
}

function serverRack(p = {}, mat) {
  const W = p.w || 0.6, D = p.d || 1.0, H = p.h || 2.0;
  const k = new Kit(mat);
  const R = seeded('server', p);
  const t = 0.02, zf = D / 2;
  // cabinet
  for (const s of [-1, 1]) k.bb('ironBlack', s * W / 2 - (s > 0 ? t : 0), 0.05, -D / 2, s * W / 2 + (s < 0 ? t : 0), H - 0.03, D / 2 - 0.03, { r: 0.004 });
  k.bb('ironBlack', -W / 2, H - 0.05, -D / 2, W / 2, H, D / 2 - 0.02, { r: 0.006 });
  k.bb('ironBlack', -W / 2, 0.05, -D / 2, W / 2, 0.1, D / 2 - 0.03);
  k.bb('ironBlack', -W / 2 + t, 0.05, -D / 2, W / 2 - t, H - 0.05, -D / 2 + 0.02);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl('rubberBlack', 0.025, 0.025, 0.05, { x: sx * (W / 2 - 0.06), y: 0.025, z: sz * (D / 2 - 0.08), seg: 8 });
  // equipment: 1U/2U servers, switch, patch panel
  const u = 0.0445, x0 = -W / 2 + 0.04, x1 = W / 2 - 0.04, ez = zf - 0.1;
  let y = 0.14, slot = 0;
  // Dedicated fills: 'gpu' = 2 × 7U AI servers (8 GPUs each), 'storage' = UPS + NVR + NAS + switch
  const bays = (yb, nu, n) => {
    const h = nu * u - 0.002, bw = (x1 - x0 - 0.12) / n;
    for (let i = 0; i < n; i++) k.bb('ironBlack', x0 + 0.1 + i * bw + 0.002, yb + 0.008, ez, x0 + 0.1 + (i + 1) * bw - 0.002, yb + h - 0.008, ez + 0.003);
  };
  const led = (yb, n = 2) => { for (let i = 0; i < n; i++) k.bb('screenOn', x0 + 0.02 + i * 0.018, yb + 0.012, ez, x0 + 0.03 + i * 0.018, yb + 0.02, ez + 0.003, { uv: false }); };
  const chassis = (yb, nu, m = 'steelBrushed', depth = 0.85) => { k.bb(m, x0, yb, ez - depth, x1, yb + nu * u - 0.002, ez); return yb + nu * u; };
  if (p.fill === 'gpu') {
    for (let s2 = 0; s2 < 2; s2++) {
      const yb = y; y = chassis(y, 7, 'ironBlack', 0.9);
      const h = 7 * u;
      // honeycomb front with 4 big intake fans, handles, status bar
      for (let i = 0; i < 4; i++) {
        const cx = x0 + 0.07 + i * (x1 - x0 - 0.14) / 3;
        k.cyl('rubberBlack', 0.055, 0.055, 0.006, { x: cx, y: yb + h * 0.55, z: ez + 0.003, rx: Math.PI / 2, seg: 16 });
        k.cyl('steelBrushed', 0.012, 0.012, 0.008, { x: cx, y: yb + h * 0.55, z: ez + 0.004, rx: Math.PI / 2, seg: 8 });
      }
      for (const sx of [x0 + 0.012, x1 - 0.012]) k.bb('steelBrushed', sx - 0.008, yb + 0.03, ez, sx + 0.008, yb + h - 0.03, ez + 0.03);
      k.bb('screenOn', x0 + 0.05, yb + 0.02, ez, x1 - 0.05, yb + 0.026, ez + 0.003, { uv: false });
      y += 0.01;
    }
    k.bb('ironBlack', x0, y, ez - 0.01, x1, y + u - 0.002, ez); y += u;              // blank
    chassis(y, 1, 'ironBlack', 0.4);                                                   // 100 GbE switch
    for (let i = 0; i < 16; i++) k.bb('rubberBlack', x0 + 0.03 + i * 0.03, y + 0.012, ez, x0 + 0.052 + i * 0.03, y + 0.032, ez + 0.002);
    led(y, 3); y += u;
    while (y < H - 0.2) { k.bb('ironBlack', x0, y, ez - 0.01, x1, y + 2 * u - 0.002, ez); y += 2 * u; } // vented blanks
  } else if (p.fill === 'storage') {
    y = chassis(y, 3, 'ironBlack', 0.7);                                               // online UPS
    k.bb('screenOn', x0 + 0.05, 0.14 + 0.05, ez, x0 + 0.14, 0.14 + 0.09, ez + 0.003, { uv: false });
    y += 0.01;
    for (const label of ['nvr', 'nas']) { const yb = y; y = chassis(y, 4); bays(yb, 4, 12); led(yb + 0.14, 3); y += 0.01; void label; }
    const ys = y; y = chassis(y, 1, 'ironBlack', 0.4);                                // PoE switch
    for (let i = 0; i < 24; i++) k.bb('rubberBlack', x0 + 0.03 + (i % 12) * 0.038, ys + 0.006 + (i >> 4) * 0.02, ez, x0 + 0.058 + (i % 12) * 0.038, ys + 0.019 + (i >> 4) * 0.02, ez + 0.002);
    const yp = y; y = chassis(y, 1, 'ironBlack', 0.15);                               // patch panel
    for (let i = 0; i < 24; i++) k.bb('trimWhite', x0 + 0.03 + (i % 12) * 0.038, yp + 0.008 + Math.floor(i / 12) * 0.018, ez, x0 + 0.05 + (i % 12) * 0.038, yp + 0.02 + Math.floor(i / 12) * 0.018, ez + 0.002);
    while (y < H - 0.2) { k.bb('ironBlack', x0, y, ez - 0.01, x1, y + 2 * u - 0.002, ez); y += 2 * u; }
  }
  while (!p.fill && y < H - 0.15) {
    const r = R();
    const nu = y > H - 0.4 ? 1 : r < 0.5 ? 1 : r < 0.85 ? 2 : 4;
    const h = nu * u - 0.002;
    if (r > 0.94 && y > 0.6) { k.bb('ironBlack', x0, y, ez - 0.01, x1, y + h, ez); y += nu * u; continue; }  // blank
    const top = y > H - 0.4;
    k.bb(top ? 'ironBlack' : 'steelBrushed', x0, y, ez - 0.6, x1, y + h, ez);
    if (!top) {
      // drive bays
      const bays = nu === 1 ? 8 : 12, bw = (x1 - x0 - 0.12) / bays;
      for (let i = 0; i < bays && nu > 1; i++) k.bb('ironBlack', x0 + 0.1 + i * bw + 0.002, y + 0.006, ez, x0 + 0.1 + (i + 1) * bw - 0.002, y + h - 0.006, ez + 0.003);
      if (nu === 1) k.bb('ironBlack', x0 + 0.1, y + 0.01, ez, x1 - 0.03, y + h - 0.01, ez + 0.002);
    } else {
      // switch / patch ports
      for (let i = 0; i < 12; i++) k.bb('rubberBlack', x0 + 0.04 + i * 0.038, y + 0.012, ez, x0 + 0.07 + i * 0.038, y + 0.032, ez + 0.002);
    }
    // status LEDs
    const leds = nu === 1 ? 2 : 4;
    for (let i = 0; i < leds; i++) if (R() < 0.85) k.bb('screenOn', x0 + 0.02 + (i % 2) * 0.018, y + 0.012 + (i >> 1) * 0.02, ez, x0 + 0.03 + (i % 2) * 0.018, y + 0.02 + (i >> 1) * 0.02, ez + 0.003, { uv: false });
    if (top) for (let i = 0; i < 12; i++) if (R() < 0.7) k.bb('screenOn', x0 + 0.045 + i * 0.038, y + 0.034, ez, x0 + 0.05 + i * 0.038, y + 0.038, ez + 0.002, { uv: false });
    y += nu * u; slot++;
  }
  // rails
  for (const s of [-1, 1]) k.bb('steelBrushed', s * (W / 2 - 0.035) - 0.012, 0.1, ez - 0.01, s * (W / 2 - 0.035) + 0.012, H - 0.05, ez + 0.004);
  // glass front door with frame + handle
  k.bb('ironBlack', -W / 2, 0.1, zf - 0.03, -W / 2 + 0.04, H - 0.05, zf);
  k.bb('ironBlack', W / 2 - 0.04, 0.1, zf - 0.03, W / 2, H - 0.05, zf);
  k.bb('ironBlack', -W / 2 + 0.04, 0.1, zf - 0.03, W / 2 - 0.04, 0.16, zf);
  k.bb('ironBlack', -W / 2 + 0.04, H - 0.11, zf - 0.03, W / 2 - 0.04, H - 0.05, zf);
  k.bb('glassClear', -W / 2 + 0.04, 0.16, zf - 0.018, W / 2 - 0.04, H - 0.11, zf - 0.012);
  k.box('chrome', 0.02, 0.18, 0.02, { x: W / 2 - 0.02, y: 1.1, z: zf + 0.012, r: 0.008 });
  // vent slots on top
  for (let i = 0; i < 6; i++) k.bb('rubberBlack', -W / 2 + 0.1, H, -D / 2 + 0.15 + i * 0.12, W / 2 - 0.1, H + 0.001, -D / 2 + 0.17 + i * 0.12);
  void slot;
  return k.build('serverRack', W, D, H, true);
}

// Precision air conditioner (CRAC) for the server room: floor cabinet with front grilles + display
function precisionAC(p = {}, mat) {
  const W = p.w || 0.6, D = p.d || 0.9, H = p.h || 2.0;
  const k = new Kit(mat);
  k.bb('trimWhite', -W / 2, 0.05, -D / 2, W / 2, H, D / 2, { r: 0.01 });
  k.bb('ironBlack', -W / 2 + 0.01, 0, -D / 2 + 0.01, W / 2 - 0.01, 0.05, D / 2 - 0.01);
  // supply grille at the top, return grille at the bottom
  for (const [z0, z1] of [[H - 0.45, H - 0.06], [0.12, 0.6]])
    for (let y = z0; y < z1; y += 0.035) k.bb('rubberBlack', -W / 2 + 0.05, y, D / 2, W / 2 - 0.05, y + 0.018, D / 2 + 0.006);
  // control panel
  k.bb('ironBlack', -0.12, 1.25, D / 2, 0.12, 1.43, D / 2 + 0.006, { r: 0.004 });
  k.bb('screenOn', -0.1, 1.29, D / 2 + 0.006, 0.1, 1.4, D / 2 + 0.008, { uv: false });
  k.bb('steelBrushed', W / 2 - 0.05, 0.85, D / 2, W / 2 - 0.03, 1.15, D / 2 + 0.025);
  return k.build('precisionAC', W, D, H, true);
}

export const WORK = { workbench, toolWall, labBench, shelvingUnit, serverRack, precisionAC };

export const INFO = {
  workbench: { w: 2.0, d: 0.8, h: 0.9, mount: 'floor', solid: true },
  toolWall: { w: 2.0, d: 0.12, h: 1.2, mount: 'wall', solid: false },
  labBench: { w: 2.0, d: 0.8, h: 1.65, mount: 'floor', solid: true },
  shelvingUnit: { w: 1.2, d: 0.5, h: 2.0, mount: 'floor', solid: true },
  serverRack: { w: 0.6, d: 1.0, h: 2.0, mount: 'floor', solid: true },
  precisionAC: { w: 0.6, d: 0.9, h: 2.0, mount: 'floor', solid: true },
};
