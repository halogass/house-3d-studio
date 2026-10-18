// Bathroom: toilet, vanity, roll-top tub, glass shower, towel rail.
// Local frame: origin floor/footprint centre, +Z FRONT. towelRail is a wall item (back at z = 0).
import * as THREE from 'three';
import {
  Kit, TAU, rbox, cyl, lathe, sphere, torus, tube, capsule, superLoft, frameGeom, shakerDoor, slabFront,
  knob, cupPull, turnedLeg, bunFoot, flipped, doubleSided,
} from './decor.js';

function toilet(params = {}, mat) {
  const k = new Kit(mat); const china = params.mat || 'porcelain'; const metal = params.metal || 'chrome';
  const zb = -0.34;
  // Pedestal (oval) and bowl.
  k.add(lathe([[0, 0], [0.12, 0], [0.122, 0.012], [0.1, 0.04], [0.085, 0.14], [0.095, 0.22], [0.12, 0.27], [0, 0.27]], 24), china, 0, 0, 0.0, 0, 0, 0, 1, 1, 1.45);
  k.add(lathe([[0.1, 0], [0.15, 0.05], [0.178, 0.1], [0.186, 0.13], [0.18, 0.142], [0.165, 0.145], [0.12, 0.11], [0.07, 0.05], [0.03, 0.02], [0, 0.015]], 28), china, 0, 0.25, 0.07, 0, 0, 0, 1, 1, 1.36);
  // Seat ring and closed lid (wood or white).
  const seat = params.seat || china;
  k.add(torus(0.148, 0.02, 8, 36), seat, 0, 0.405, 0.075, Math.PI / 2, 0, 0, 1, 1.38, 0.6);
  k.add(lathe([[0, 0], [0.175, 0], [0.18, 0.008], [0.172, 0.02], [0.13, 0.03], [0, 0.032]], 28), seat, 0, 0.416, 0.075, 0, 0, 0, 1, 1, 1.32);
  // Hinges.
  for (const s of [-1, 1]) k.add(cyl(0.012, 0.012, 0.03, 10), metal, s * 0.07, 0.42, -0.14, 0, 0, Math.PI / 2);
  // Close-coupled cistern + lid + lever.
  k.add(rbox(0.38, 0.33, 0.17, 0.025, 2), china, 0, 0.43 + 0.165, zb + 0.095);
  k.add(rbox(0.4, 0.03, 0.19, 0.01, 2), china, 0, 0.775, zb + 0.095);
  k.add(lathe([[0, 0], [0.018, 0], [0.018, 0.01], [0, 0.012]], 12), metal, -0.13, 0.7, zb + 0.18, Math.PI / 2, 0, 0);
  k.rod([-0.13, 0.7, zb + 0.19], [-0.07, 0.69, zb + 0.2], 0.005, metal, 6);
  k.add(rbox(0.12, 0.08, 0.1, 0.02, 1), china, 0, 0.4, zb + 0.18);
  return k.build('toilet', { w: 0.4, d: 0.68, h: 0.78, solid: true });
}

/** Vessel-style basin sitting on a counter at y, centred (x, z). */
function vesselBasin(k, x, y, z, r, china) {
  const outer = [[0, 0], [r * 0.4, 0], [r * 0.55, 0.008], [r * 0.85, 0.05], [r * 0.98, 0.1], [r, 0.12], [r * 0.97, 0.13]];
  const inner = [[r * 0.93, 0.128], [r * 0.9, 0.1], [r * 0.75, 0.05], [r * 0.45, 0.022], [r * 0.12, 0.016], [0, 0.016]];
  k.add(lathe([...outer, ...inner], 18), china, x, y, z, 0, 0, 0, 1, 1, 0.72);
  k.add(cyl(0.022, 0.022, 0.003, 14), 'brass', x, y + 0.018, z);
}

function vanity(params = {}, mat) {
  const w = params.w ?? 1.6, d = params.d ?? 0.55, h = params.h ?? 0.85;
  const cab = params.cabinet || 'walnut', top = params.top || 'marbleWhite', metal = params.metal || 'brass';
  const sinks = Math.max(1, Math.min(2, params.sinks ?? (w >= 1.4 ? 2 : 1)));
  const k = new Kit(mat);
  const legH = 0.16, tT = 0.03, cy0 = legH, cy1 = h - tT, zf = d / 2 - 0.045;
  // Legs and carcass.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bunFoot(k, sx * (w / 2 - 0.05), sz * (d / 2 - 0.06), cy0 + 0.005, 0.034, cab, 10);
  k.add(rbox(w - 0.06, cy1 - cy0, d - 0.1, 0.004, 1), cab, 0, (cy0 + cy1) / 2, -0.02);
  k.add(rbox(w - 0.04, 0.03, d - 0.08, 0.006, 1), cab, 0, cy0 + 0.015, -0.01);
  // Fronts: drawer row on top, doors below; for 2 sinks a centre drawer bank.
  const fx0 = -w / 2 + 0.03, fx1 = w / 2 - 0.03, drH = 0.16;
  const banks = sinks === 2 ? [[fx0, -0.2, 'doors'], [-0.2, 0.2, 'drawers'], [0.2, fx1, 'doors']] : [[fx0, fx1, 'doors']];
  for (const [a, b, kind] of banks) {
    const cx = (a + b) / 2, bw = b - a;
    if (kind === 'drawers') {
      const n = 3, hh = (cy1 - cy0 - 0.03) / n;
      for (let i = 0; i < n; i++) {
        const y = cy0 + 0.03 + hh * (i + 0.5);
        slabFront(k, cx, y, zf, bw - 0.006, hh - 0.006, cab, 0.02);
        knob(k, cx, y, zf + 0.02, metal);
      }
      continue;
    }
    slabFront(k, cx, cy1 - drH / 2, zf, bw - 0.006, drH - 0.008, cab, 0.02);
    cupPull(k, cx, cy1 - drH / 2, zf + 0.02, metal);
    const nd = bw > 0.6 ? 2 : 1, dw = bw / nd, dh = cy1 - cy0 - 0.03 - drH;
    for (let i = 0; i < nd; i++) {
      const x = a + dw * (i + 0.5);
      shakerDoor(k, x, cy0 + 0.03 + dh / 2, zf, dw - 0.006, dh - 0.006, cab, 0.02, 0.06);
      knob(k, nd === 2 ? (i === 0 ? x + dw / 2 - 0.04 : x - dw / 2 + 0.04) : x + dw / 2 - 0.05, cy0 + 0.03 + dh * 0.75, zf + 0.02, metal);
    }
  }
  // Marble top with ogee-ish edge + backsplash.
  k.add(rbox(w, tT, d, 0.01, 2), top, 0, h - tT / 2, 0);
  k.add(rbox(w, 0.1, 0.02, 0.004, 1), top, 0, h + 0.05, -d / 2 + 0.01);
  // Basins, faucets, mirrors.
  const xs = sinks === 2 ? [-w / 4 - 0.02, w / 4 + 0.02] : [0];
  const mirrors = params.mirror !== false;
  for (const x of xs) {
    vesselBasin(k, x, h, 0.04, 0.2, params.basin || 'porcelain');
    const fz = -d / 2 + 0.07;
    k.add(lathe([[0, 0], [0.028, 0], [0.028, 0.008], [0.016, 0.016], [0.014, 0.22], [0, 0.22]], 10), metal, x, h, fz);
    k.add(tube([[x, h + 0.21, fz], [x, h + 0.3, fz + 0.02], [x, h + 0.31, fz + 0.12], [x, h + 0.25, fz + 0.18]], 0.011, 14, 6), metal);
    for (const s of [-1, 1]) {
      k.add(lathe([[0, 0], [0.022, 0], [0.014, 0.01], [0.012, 0.05], [0, 0.05]], 8), metal, x + s * 0.12, h, fz);
      k.add(sphere(0.016, 8, 6), 'porcelain', x + s * 0.12, h + 0.06, fz);
    }
    if (mirrors) {
      const mw = sinks === 2 ? Math.min(0.65, w / 2 - 0.12) : Math.min(0.8, w - 0.2), mh = 0.85, my = h + 0.62;
      k.add(frameGeom(mw, mh, 0.05, 0.035, 0.008, 1), params.frame || 'brassAged', x, my, -d / 2 + 0.002);
      k.add(new THREE.PlaneGeometry(mw - 0.09, mh - 0.09), 'mirror', x, my, -d / 2 + 0.02);
      k.add(rbox(mw - 0.02, mh - 0.02, 0.01, 0, 1), 'walnut', x, my, -d / 2 + 0.007);
    }
  }
  return k.build('vanity', { w, d, h: mirrors ? h + 0.62 + 0.425 + 0.008 : h + 0.32, solid: true }, { sinks, counter: h });
}

function bathtubFreestanding(params = {}, mat) {
  const w = params.w ?? 1.7, d = params.d ?? 0.8;
  const outerMat = params.outer || 'lacquer:#2f3a34', china = params.mat || 'porcelain', metal = params.metal || 'brass';
  const k = new Kit(mat);
  const rimO = 0.105, b0 = d / 2 - rimO, a0 = w / 2 - rimO, yF = 0.13;
  const outer = [[-b0 + 0.001, yF + 0.005], [-b0 * 0.5, yF], [-0.03, yF + 0.005], [0, yF + 0.025], [0.03, 0.25], [0.06, 0.38], [0.08, 0.5], [0.09, 0.56],
    [0.1, 0.585], [0.105, 0.6], [0.098, 0.613], [0.082, 0.617]];
  const inner = [[0.082, 0.617], [0.068, 0.605], [0.06, 0.585], [0.05, 0.53], [0.03, 0.42], [0.0, 0.31], [-0.04, 0.23], [-0.09, 0.195], [-b0 * 0.5, 0.185], [-b0 + 0.001, 0.185]];
  k.add(superLoft(outer, a0, b0, 2.7, 56), outerMat);
  k.add(superLoft(inner, a0, b0, 2.7, 56), china);
  // Claw-and-ball feet.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const fx = sx * (a0 - 0.12), fz = sz * (b0 - 0.06);
    k.add(sphere(0.032, 12, 8), metal, fx + sx * 0.03, 0.032, fz + sz * 0.02);
    k.add(tube([[fx + sx * 0.03, 0.05, fz + sz * 0.02], [fx + sx * 0.02, 0.09, fz + sz * 0.01], [fx, yF + 0.02, fz]], 0.024, 8, 8), metal);
    for (let t = -1; t <= 1; t++) {
      const a = Math.atan2(sz, sx) + t * 0.7;
      const cx = fx + sx * 0.03, cz = fz + sz * 0.02;
      k.add(tube([[cx + Math.cos(a) * 0.012, 0.06, cz + Math.sin(a) * 0.012], [cx + Math.cos(a) * 0.036, 0.04, cz + Math.sin(a) * 0.036], [cx + Math.cos(a) * 0.04, 0.012, cz + Math.sin(a) * 0.04]], 0.007, 6, 5), metal);
    }
    k.add(lathe([[0, 0], [0.04, 0], [0.045, 0.01], [0, 0.012]], 14), metal, fx, yF + 0.012, fz);
  }
  // Rim-mounted telephone mixer at the −X end.
  const fx = -(a0 + 0.075), fy = 0.617;
  for (const s of [-1, 1]) {
    k.add(lathe([[0, 0], [0.02, 0], [0.014, 0.01], [0.012, 0.09], [0, 0.09]], 10), metal, fx, fy, s * 0.08);
    k.add(sphere(0.02, 10, 8), 'porcelain', fx, fy + 0.11, s * 0.08);
    k.rod([fx, fy + 0.09, s * 0.08], [fx, fy + 0.1, s * 0.08], 0.008, metal, 8);
  }
  k.rod([fx, fy + 0.08, -0.08], [fx, fy + 0.08, 0.08], 0.012, metal, 10);
  k.add(tube([[fx, fy + 0.08, 0], [fx + 0.06, fy + 0.13, 0], [fx + 0.14, fy + 0.1, 0], [fx + 0.16, fy + 0.05, 0]], 0.011, 14, 8), metal);
  // Telephone hand shower on its cradle.
  k.rod([fx, fy + 0.08, 0.02], [fx, fy + 0.15, 0.02], 0.006, metal, 6);
  k.rod([fx, fy + 0.17, -0.07], [fx, fy + 0.17, 0.09], 0.01, metal, 10);
  for (const s of [-1, 1]) k.add(lathe([[0, 0], [0.018, 0.005], [0.02, 0.02], [0, 0.03]], 12), metal, fx, fy + 0.155, s * 0.08 + 0.01);
  return k.build('bathtubFreestanding', { w, d, h: 0.62, solid: true });
}

function showerGlass(params = {}, mat) {
  const w = params.w ?? 1.2, d = params.d ?? 0.9, h = params.h ?? 2.1;
  const sides = params.sides || ['front', 'left'];
  const metal = params.metal || 'brass'; const k = new Kit(mat);
  const gH = 2.0, gy = 0.03, t = 0.01, fr = 0.016;
  // Shower tray with linear drain.
  k.add(rbox(w, 0.03, d, 0.006, 1), params.tray || 'marbleWhite', 0, 0.015, 0);
  k.add(rbox(w - 0.2, 0.004, 0.05, 0.001, 1), 'steelBrushed', 0, 0.031, -d / 2 + 0.08);
  const panel = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0); const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const ry = Math.atan2(-(z1 - z0), x1 - x0);
    k.at(cx, 0, cz, ry, () => {
      k.add(rbox(len - 0.01, gH, t, 0.002, 1), 'glassClear', 0, gy + gH / 2, 0);
      k.add(rbox(len, fr, fr * 1.6, 0.002, 1), metal, 0, gy + fr / 2, 0);
      k.add(rbox(len, fr, fr * 1.6, 0.002, 1), metal, 0, gy + gH - fr / 2, 0);
      for (const s of [-1, 1]) k.add(rbox(fr, gH, fr * 1.6, 0.002, 1), metal, s * (len / 2 - fr / 2), gy + gH / 2, 0);
    });
  };
  const hasL = sides.includes('left'), hasR = sides.includes('right');
  const zF = d / 2 - fr, xL = -w / 2 + fr, xR = w / 2 - fr;
  if (hasL) panel(xL, -d / 2, xL, zF);
  if (hasR) panel(xR, -d / 2, xR, zF);
  if (sides.includes('back')) panel(-w / 2, -d / 2 + fr, w / 2, -d / 2 + fr);
  if (sides.includes('front')) {
    const open = Math.min(0.62, w * 0.5);
    const openRight = hasL && !hasR;
    if (openRight) panel(-w / 2, zF, w / 2 - open, zF); else panel(-w / 2 + open, zF, w / 2, zF);
    // Support bar from the panel's free end to the back wall.
    const xe = openRight ? w / 2 - open : -w / 2 + open;
    k.rod([xe, gy + gH - 0.01, zF], [xe, gy + gH - 0.01, -d / 2], 0.009, metal, 8);
    k.add(cyl(0.02, 0.02, 0.01, 12), metal, xe, gy + gH - 0.01, -d / 2 + 0.005, Math.PI / 2, 0, 0);
  }
  // Rain head on a wall arm, mixer valve, slide-bar hand shower.
  const zw = -d / 2;
  k.add(cyl(0.03, 0.03, 0.012, 14), metal, 0, h - 0.02, zw + 0.006, Math.PI / 2, 0, 0);
  k.add(tube([[0, h - 0.02, zw + 0.01], [0, h - 0.02, zw + 0.2], [0, h - 0.06, zw + Math.min(0.38, d / 2)]], 0.012, 12, 8), metal);
  const rz = zw + Math.min(0.38, d / 2);
  k.add(lathe([[0, 0], [0.15, 0], [0.155, 0.008], [0.15, 0.015], [0.03, 0.022], [0.02, 0.03], [0, 0.03]], 40), metal, 0, h - 0.11, rz);
  k.add(cyl(0.14, 0.14, 0.002, 40), 'steelBrushed', 0, h - 0.111, rz);
  const vx = hasR && !hasL ? -w / 2 + 0.3 : w / 2 - 0.3;
  k.add(lathe([[0, 0], [0.085, 0], [0.085, 0.006], [0.07, 0.014], [0.03, 0.02], [0, 0.022]], 28), metal, vx, 1.1, zw, Math.PI / 2, 0, 0);
  k.rod([vx, 1.1, zw + 0.02], [vx, 1.1, zw + 0.06], 0.012, metal, 10);
  k.rod([vx, 1.1, zw + 0.06], [vx + 0.09, 1.1, zw + 0.07], 0.007, metal, 8);
  k.rod([vx, 1.25, zw + 0.03], [vx, 1.85, zw + 0.03], 0.011, metal, 10);
  for (const y of [1.25, 1.85]) k.rod([vx, y, zw], [vx, y, zw + 0.03], 0.009, metal, 8);
  k.add(cyl(0.02, 0.016, 0.2, 12), metal, vx, 1.62, zw + 0.06, 0.2, 0, 0);
  k.add(lathe([[0, 0], [0.035, 0], [0.04, 0.01], [0.012, 0.03], [0, 0.03]], 16), metal, vx, 1.72, zw + 0.08, Math.PI / 2 + 0.6, 0, 0);
  k.add(tube([[vx, 1.53, zw + 0.06], [vx + 0.05, 1.3, zw + 0.1], [vx + 0.02, 1.15, zw + 0.08], [vx, 1.1, zw + 0.06]], 0.006, 16, 5), 'chrome');
  return k.build('showerGlass', { w, d, h, solid: false }, { sides });
}

function towelRail(params = {}, mat) {
  const w = params.w ?? 0.6, h = params.h ?? 1.2, y0 = params.y ?? 0.35;
  const metal = params.metal || 'brass'; const k = new Kit(mat);
  const z = 0.065, xs = w / 2 - 0.02, r = 0.014;
  for (const s of [-1, 1]) {
    k.add(lathe([[0, 0], [r * 0.6, 0], [r, 0.01], [r, h - 0.02], [r * 0.7, h - 0.003], [0, h]], 12), metal, s * xs, y0, z);
    for (const y of [y0 + 0.12, y0 + h - 0.12]) {
      k.rod([s * xs, y, 0], [s * xs, y, z], 0.008, metal, 8);
      k.add(lathe([[0, 0], [0.025, 0], [0.025, 0.006], [0.012, 0.012], [0, 0.012]], 14), metal, s * xs, y, 0, Math.PI / 2, 0, 0);
    }
  }
  const n = 8;
  for (let i = 0; i < n; i++) {
    const y = y0 + 0.08 + i * (h - 0.16) / (n - 1);
    k.rod([-xs, y, z], [xs, y, z], 0.009, metal, 8);
  }
  // Folded towel over the second bar from the top.
  const by = y0 + 0.08 + (n - 2) * (h - 0.16) / (n - 1);
  const tw = w * 0.7, towel = params.towel || 'linenWhite';
  k.add(capsule(0.018, tw - 0.036, 3, 10), towel, 0, by + 0.012, z, 0, 0, Math.PI / 2);
  k.add(rbox(tw, 0.42, 0.014, 0.006, 1), towel, 0, by - 0.2, z + 0.025, -0.03, 0, 0);
  k.add(rbox(tw, 0.36, 0.014, 0.006, 1), towel, 0, by - 0.17, z - 0.025, 0.03, 0, 0);
  return k.build('towelRail', { w, d: 0.1, h, solid: false, mount: 'wall' });
}

export const BATH = { toilet, vanity, bathtubFreestanding, showerGlass, towelRail };
export const INFO = {
  toilet: { w: 0.4, d: 0.68, h: 0.78, mount: 'floor', solid: true },
  vanity: { w: 1.6, d: 0.55, h: 0.85, mount: 'floor', solid: true },
  bathtubFreestanding: { w: 1.7, d: 0.8, h: 0.6, mount: 'floor', solid: true },
  showerGlass: { w: 1.2, d: 0.9, h: 2.1, mount: 'floor', solid: false },
  towelRail: { w: 0.6, d: 0.1, h: 1.2, mount: 'wall', solid: false },
};
void TAU; void flipped;
