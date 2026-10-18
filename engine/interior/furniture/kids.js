// Furniture: kids rooms (kidsDesk with chair, toyChest). Local frame per docs/SCHEMA.md "Furniture".
import { Kit, seeded, PROFILE, turned, knob, panelFront, bookRow, pillow } from './bedroom.js';

function kidsDesk(p = {}, mat) {
  const W = p.w || 1.2, D = p.d || 0.6, H = p.h || 0.72;
  const BODY = p.frame || 'cabinetCream', TOP = p.top || 'oakLight', HW = p.hardware || 'brass', FAB = p.fabric || 'fabricSage';
  const k = new Kit(mat);
  const R = seeded('kidsDesk', p);
  const dz = -0.1;                       // desk sits back; the chair pulls out to the front
  k.push({ z: dz });
  k.box(TOP, W, 0.03, D, { y: H - 0.015, r: 0.01 });
  // pedestal with 3 drawers (right)
  const pw = 0.4, px = W / 2 - pw / 2 - 0.02;
  k.bb(BODY, px - pw / 2, 0.04, -D / 2 + 0.03, px + pw / 2, H - 0.03, D / 2 - 0.04);
  k.bb(BODY, px - pw / 2 - 0.01, 0, -D / 2 + 0.02, px + pw / 2 + 0.01, 0.05, D / 2 - 0.03, { r: 0.006 });
  const dh = (H - 0.1) / 3;
  for (let i = 0; i < 3; i++) {
    const y = 0.06 + dh * (i + 0.5);
    panelFront(k, BODY, px, y, D / 2 - 0.02, pw - 0.03, dh - 0.012, { inset: 0.025 });
    knob(k, px, y, D / 2 - 0.02, 0.013, HW);
  }
  // left: turned legs + apron + pencil drawer
  for (const sz of [-1, 1]) turned(k, BODY, -W / 2 + 0.05, 0, sz * (D / 2 - 0.06), H - 0.03, 0.028, PROFILE.taper, 10);
  k.bb(BODY, -W / 2 + 0.03, H - 0.11, -D / 2 + 0.04, px - pw / 2, H - 0.03, -D / 2 + 0.06);
  panelFront(k, BODY, (-W / 2 + px - pw / 2) / 2, H - 0.07, D / 2 - 0.05, px - pw / 2 + W / 2 - 0.1, 0.07, { inset: 0.015 });
  k.bb(BODY, -W / 2 + 0.03, H - 0.11, -D / 2 + 0.06, px - pw / 2, H - 0.03, D / 2 - 0.07);
  knob(k, (-W / 2 + px - pw / 2) / 2, H - 0.07, D / 2 - 0.05, 0.012, HW);
  // desk-top things: books, pencil cup, small globe
  bookRow(k, R, W / 2 - 0.3, W / 2 - 0.05, H, -D / 2 + 0.22, 0.24, 0.2, { leather: 0 });
  k.cyl('terracottaPot', 0.035, 0.032, 0.1, { x: -W / 2 + 0.15, y: H + 0.05, z: -D / 2 + 0.12, seg: 10 });
  for (let i = 0; i < 4; i++) k.cyl(i % 2 ? 'lacquer:#c0392b' : 'lacquer:#2e86c1', 0.004, 0.004, 0.16, { x: -W / 2 + 0.14 + i * 0.008, y: H + 0.1, z: -D / 2 + 0.12, rz: (i - 1.5) * 0.12, seg: 5 });
  k.sph('canvasArt2', 0.07, { x: -W / 2 + 0.32, y: H + 0.11, z: -D / 2 + 0.12, ws: 12, hs: 8 });
  k.cyl('brass', 0.035, 0.045, 0.03, { x: -W / 2 + 0.32, y: H + 0.015, z: -D / 2 + 0.12, seg: 10 });
  k.pop();
  // chair on the user side (+Z), facing the desk (−Z), pushed in slightly under the top
  const ch = 0.38, cz = D / 2 + dz + 0.06;
  k.push({ x: -0.12, z: cz, ry: Math.PI });
  const cw = 0.36;
  k.box(BODY, cw, 0.03, 0.34, { y: ch - 0.015, r: 0.008 });
  pillow(k, FAB, cw - 0.04, 0.3, 0.05, { y: ch + 0.015, rx: -Math.PI / 2, e: 0.3, ws: 10, hs: 7 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) turned(k, BODY, sx * (cw / 2 - 0.03), 0, sz * 0.14, ch - 0.03, 0.018, PROFILE.taper, 8);
  for (const sx of [-1, 1]) k.bb(BODY, sx * (cw / 2 - 0.03) - 0.014, ch, -0.17, sx * (cw / 2 - 0.03) + 0.014, ch + 0.38, -0.142, { r: 0.006 });
  k.bb(BODY, -cw / 2 + 0.02, ch + 0.26, -0.17, cw / 2 - 0.02, ch + 0.37, -0.15, { r: 0.008 });
  for (let i = 0; i < 3; i++) k.bb(BODY, -0.08 + i * 0.08 - 0.012, ch + 0.03, -0.165, -0.08 + i * 0.08 + 0.012, ch + 0.26, -0.152);
  k.pop();
  return k.build('kidsDesk', W, 0.8, 0.95, true, { deskHeight: H });
}

function toyChest(p = {}, mat) {
  const W = p.w || 0.8, D = p.d || 0.45, H = p.h || 0.5, BODY = p.frame || 'cabinetCream', HW = p.hardware || 'brass';
  const k = new Kit(mat);
  const fy = 0.05, lid = 0.04;
  k.bb(BODY, -W / 2 + 0.015, fy, -D / 2 + 0.015, W / 2 - 0.015, H - lid, D / 2 - 0.02);
  k.bb(BODY, -W / 2, fy, -D / 2, W / 2, fy + 0.05, D / 2, { r: 0.008 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) turned(k, BODY, sx * (W / 2 - 0.05), 0, sz * (D / 2 - 0.05), fy, 0.03, PROFILE.bun, 8);
  // front raised panels
  for (const s of [-1, 1]) panelFront(k, BODY, s * W / 4, (fy + 0.05 + H - lid) / 2, D / 2 - 0.0, W / 2 - 0.08, H - lid - fy - 0.1, { inset: 0.035 });
  // lid with moulded edge
  k.box(BODY, W + 0.02, lid * 0.6, D + 0.02, { y: H - lid * 0.3, r: 0.012 });
  k.box(BODY, W, lid * 0.4, D, { y: H - lid * 0.8, r: 0.006 });
  // rope handles on the sides + brass hasp
  for (const s of [-1, 1]) {
    k.torus('rugJute', 0.05, 0.009, { x: s * (W / 2 + 0.006), y: H - 0.17, ry: Math.PI / 2, rz: Math.PI, arc: Math.PI, rs: 5, ts: 10 });
    for (const z of [-0.05, 0.05]) k.cyl(HW, 0.014, 0.014, 0.01, { x: s * (W / 2 + 0.002), y: H - 0.17, z, rz: Math.PI / 2, seg: 8 });
  }
  k.box(HW, 0.04, 0.07, 0.006, { y: H - 0.06, z: D / 2 + 0.008 });
  // a ball and a block on top
  k.sph('lacquer:#c0392b', 0.06, { x: W * 0.22, y: H + 0.06, z: 0.03, ws: 12, hs: 8 });
  k.box('lacquer:#2e86c1', 0.06, 0.06, 0.06, { x: -W * 0.2, y: H + 0.03, z: -0.04, ry: 0.4, r: 0.006 });
  k.box('lacquer:#e2b13c', 0.06, 0.06, 0.06, { x: -W * 0.2 + 0.07, y: H + 0.03, z: 0.02, ry: -0.2, r: 0.006 });
  return k.build('toyChest', W, D, H, true);
}

export const KIDS = { kidsDesk, toyChest };

export const INFO = {
  kidsDesk: { w: 1.2, d: 0.8, h: 0.95, mount: 'floor', solid: true },
  toyChest: { w: 0.8, d: 0.45, h: 0.5, mount: 'floor', solid: true },
};
