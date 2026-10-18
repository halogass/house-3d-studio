// Walkability check: builds the house headlessly (same colliders as the app) and walks
//   · through every door in both directions (closed doors must block, open ones let you pass),
//   · in through every gate from the street (automatic gates open by themselves),
//   · up and down every stair, and checks the balustrade at the top holds,
//   · into every room from a door (a room nobody can reach is reported).
//   npm run check [-- --project <name>]
// Exit code 1 with a list of problems (bilingual summary) if anything fails.
import { buildHeadless } from './lib/headless.mjs';

const { P, built, Z, config } = await buildHeadless({ dynamicDoors: true });
const { LEVELS, STAIRS, GROUND } = config;
const { Doors } = await import('../engine/doors.js');
if (built.interior.problems.length) console.log('Interior problems:\n  - ' + built.interior.problems.join('\n  - '));

const DOORS = ['swing', 'double', 'opening', 'sliding', 'folding', 'garage'];
const fails = [];
let total = 0;

function walk(p, dx, dy, secs, tick) {
  const n = Math.round(secs * 60);
  for (let i = 0; i < n; i++) { P.step(p, dx / 60, dy / 60, 1 / 60); if (tick) tick(p); }
}
// Walk to a plan point at 1.4 m/s (gives up after `max` seconds)
function walkTo(p, x, y, max = 20, tick) {
  for (let i = 0; i < max * 60; i++) {
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d < 0.05) return true;
    const s = Math.min(1.4 / 60, d);
    P.step(p, dx / d * s, dy / d * s, 1 / 60);
    if (tick) tick(p);
  }
  return Math.hypot(x - p.x, y - p.y) < 0.15;
}
const at = (x, y, e) => { const z = P.landingAt(x, y, e); return z === null ? null : { x, y, e: z, vy: 0, grounded: true }; };
const f2 = (v) => v.toFixed(2);

// ---- closed doors block; then all open for the walks below
const doors = new Doors({ groups: built.groups, physics: P, getMaterial: () => built.groups.site.children[0]?.material });
let closedOk = 0;
for (const d of doors.list) {
  if (d.auto) continue;
  const [nx, ny] = d.o === 'h' ? [0, 1] : [1, 0];
  const sx = d.cx - nx * 0.8, sy = d.cy - ny * 0.8;
  const p = at(sx, sy, d.fl);
  if (!p) continue;
  walk(p, nx * 1.6, ny * 1.6, 1);
  if (Math.hypot(p.x - (d.cx + nx * 0.8), p.y - (d.cy + ny * 0.8)) < 0.5) fails.push(`door ${d.id} (${d.t}) is closed but can be walked through / pintu tertutup tapi bisa dilewati`);
  else closedOk++;
}

// ---- gates from the street: an automatic gate opens for a walker and closes again behind
const site = Z.site;
let gatesOk = 0;
for (const g of doors.list.filter(d => d.slideGate || d.auto)) {
  doors.closeAll(true);
  const G = g.slideGate, h = g.o === 'h';
  const inward = G ? Math.sign(G.track - (h ? (G.h ? g.y : g.x) : g.x)) || 1 : 1;
  const fixed = h ? g.cy : g.cx;
  const dir = h ? (fixed < site.d / 2 ? 1 : -1) : (fixed < site.w / 2 ? 1 : -1);   // into the plot
  const out = h ? [g.cx, fixed - dir * 4] : [fixed - dir * 4, g.cy], inn = h ? [g.cx, fixed + dir * 3] : [fixed + dir * 3, g.cy];
  const p = at(out[0], out[1], 0);
  if (!p) { fails.push(`gate ${g.id}: no ground in front of it`); continue; }
  const tick = (q) => doors.update(1 / 60, q, null);
  walkTo(p, inn[0], inn[1], 20, tick);
  if (Math.hypot(p.x - inn[0], p.y - inn[1]) > 0.3) fails.push(`gate ${g.id}: stuck at (${f2(p.x)}, ${f2(p.y)}) walking in / tertahan di gerbang`);
  else gatesOk++;
  const far = { x: site.w / 2, y: site.d - 1, e: 0 };
  for (let i = 0; i < 900; i++) doors.update(1 / 60, far, null);
  if (g.f > 0.01) fails.push(`gate ${g.id}: does not close by itself / tidak menutup sendiri`);
  void inward;
}
doors.openAll(true);

// ---- every door, both directions
for (const [lv, list] of Object.entries(Z.openings)) {
  for (const o of list) {
    if (!DOORS.includes(o.t)) continue;
    total++;
    // Sliding/folding glass parks over the first half: test the open half
    const frac = o.t === 'sliding' || o.t === 'folding' ? 0.75 : 0.5;
    const cx = o.o === 'h' ? o.x + o.w * frac : o.x;
    const cy = o.o === 'h' ? o.y : o.y + o.w * frac;
    const [nx, ny] = o.o === 'h' ? [0, 1] : [1, 0];
    for (const s of [1, -1]) {
      const sx = cx - nx * 0.8 * s, sy = cy - ny * 0.8 * s;
      const e = P.landingAt(sx, sy, LEVELS[lv].elev);
      if (e === null) { fails.push(`${lv} ${o.t} @(${o.x}, ${o.y}): no floor on one side / tidak ada lantai di satu sisi`); continue; }
      const p = { x: sx, y: sy, e, vy: 0, grounded: true };
      walk(p, nx * 1.6 * s, ny * 1.6 * s, 1);
      const tx = cx + nx * 0.8 * s, ty = cy + ny * 0.8 * s;
      if (Math.hypot(p.x - tx, p.y - ty) > 0.15)
        fails.push(`${lv} ${o.t} @(${o.x}, ${o.y}) dir ${s > 0 ? '+' : '-'}: stuck at (${f2(p.x)}, ${f2(p.y)}) — something blocks the doorway / ada yang menghalangi`);
    }
  }
}

// ---- stairs: up and down, and the balustrade at the top
let stairsOk = 0;
for (const S of STAIRS) {
  const F = S.frame;
  const mid = (a) => (a.t0 + a.t1) / 2;
  const route = S.type === 'U'
    ? [F.P(-0.5, mid(S.flights[0])), F.P(S.landing.s0 + (S.landing.s1 - S.landing.s0) / 2, mid(S.flights[0])), F.P(S.landing.s0 + (S.landing.s1 - S.landing.s0) / 2, mid(S.flights[1])), F.P(-0.7, mid(S.flights[1]))]
    : [F.P(-0.5, F.W / 2), F.P(F.L + 0.7, F.W / 2)];
  const p = at(route[0][0], route[0][1], S.A);
  if (!p || Math.abs(p.e - S.A) > 0.05) { fails.push(`stair ${S.id}: no floor at its foot (${f2(route[0][0])}, ${f2(route[0][1])}) / tidak ada lantai di kaki tangga`); continue; }
  let ok = true;
  for (const [x, y] of route.slice(1)) ok = walkTo(p, x, y, 15) && ok;
  if (!ok || Math.abs(p.e - S.B) > 0.05) { fails.push(`stair ${S.id} up: stopped at (${f2(p.x)}, ${f2(p.y)}, e ${f2(p.e)}), expected e ${S.B} / tangga naik tertahan`); continue; }
  for (const [x, y] of route.slice(0, -1).reverse()) ok = walkTo(p, x, y, 15) && ok;
  if (!ok || Math.abs(p.e - S.A) > 0.05) { fails.push(`stair ${S.id} down: stopped at (${f2(p.x)}, ${f2(p.y)}, e ${f2(p.e)}), expected e ${S.A} / tangga turun tertahan`); continue; }
  // from the top, walk at every balustrade: the walker must stay on the upper floor
  const { voidEdges } = await import('../engine/stairs.js');
  for (const [x0, y0, x1, y1] of voidEdges(S, Z)) {
    const h = y0 === y1, m = h ? [(x0 + x1) / 2, y0] : [x0, (y0 + y1) / 2];
    const c = [(S.r[0] + S.r[2]) / 2, (S.r[1] + S.r[3]) / 2];
    const out = h ? [m[0], m[1] + Math.sign(m[1] - c[1]) * 0.6] : [m[0] + Math.sign(m[0] - c[0]) * 0.6, m[1]];
    const q = at(out[0], out[1], S.B);
    if (!q || Math.abs(q.e - S.B) > 0.05) continue; // no floor beside this edge (a wall)
    walkTo(q, (m[0] + c[0]) / 2, (m[1] + c[1]) / 2, 4);
    if (Math.abs(q.e - S.B) > 0.05) fails.push(`stair ${S.id}: the balustrade at (${f2(m[0])}, ${f2(m[1])}) lets a walker fall into the stairwell / pagar tangga bisa ditembus`);
  }
  stairsOk++;
}

// ---- every room can be reached: flood fill over the walkable surfaces from the garden
{
  const reached = new Set();
  const G = 0.25;
  const seen = new Set();
  const key = (x, y, e) => `${Math.round(x / G)},${Math.round(y / G)},${Math.round(e * 4)}`;
  const queue = [];
  const start = at(site.w / 2, -2, 0) || at(1, 1, 0);
  if (start) queue.push(start);
  const roomAt = (x, y, e) => {
    for (const [lv, rooms] of Object.entries(Z.floors)) {
      if (Math.abs(e - LEVELS[lv].elev) > 0.6) continue;
      const r = rooms.find(q => x > q.r[0] && x < q.r[2] && y > q.r[1] && y < q.r[3]);
      if (r) return r.id;
    }
    return null;
  };
  const W0 = -3, W1 = site.w + 3, D0 = -3, D1 = site.d + 3;
  let steps = 0;
  while (queue.length && steps < 400000) {
    const p = queue.pop(); steps++;
    const k = key(p.x, p.y, p.e);
    if (seen.has(k)) continue;
    seen.add(k);
    const r = roomAt(p.x, p.y, p.e);
    if (r) reached.add(r);
    for (const [dx, dy] of [[G, 0], [-G, 0], [0, G], [0, -G]]) {
      const q = { ...p, vy: 0, grounded: true };
      const tx = p.x + dx, ty = p.y + dy;
      if (tx < W0 || tx > W1 || ty < D0 || ty > D1) continue;
      for (let i = 0; i < 6; i++) P.step(q, dx / 6, dy / 6, 1 / 60);
      if (Math.hypot(q.x - tx, q.y - ty) < 0.05 && !seen.has(key(q.x, q.y, q.e))) queue.push({ x: tx, y: ty, e: q.e, vy: 0, grounded: true });
    }
  }
  for (const [lv, rooms] of Object.entries(Z.floors)) for (const r of rooms)
    if (!reached.has(r.id)) fails.push(`${lv} ${r.id}: cannot be reached on foot from the street / ruang ini tidak bisa dicapai dengan berjalan`);
}

const rooms = Object.values(Z.floors).flat().length;
if (fails.length) {
  console.log(`✗ ${fails.length} problem(s) / masalah (${total} doors, ${STAIRS.length} stairs, ${rooms} rooms tested):`);
  for (const f of fails) console.log('  - ' + f);
  process.exit(1);
}
console.log(`✓ All ${total} doors passable both ways, ${closedOk} closed doors block, ${gatesOk} gate(s) open for walkers, ${stairsOk} stair(s) up & down, all ${rooms} rooms reachable.`);
console.log(`✓ Semua ${total} pintu bisa dilewati dua arah, ${stairsOk} tangga naik-turun, ${rooms} ruang bisa dicapai.`);
