// Stairs from the data (zoning.js `stairs`): one plan per stair, shared by the world (treads, walk
// surfaces, colliders), the finishes (handrails, balustrades) and the checks.
//
// Data:  { id, type: 'straight' | 'U', r: [x0, y0, x1, y1], up: 'n'|'s'|'e'|'w', from: 'L1', to: 'L2',
//          first: 'right' | 'left' (U: the half the first flight is on, looking up it), landing (U, m) }
//   straight: one flight over the whole rect, climbing in direction `up`, from `from`'s floor at the
//             start edge to `to`'s floor at the far edge.
//   U:        the first flight climbs in direction `up` on one half to a landing at the far end, the
//             second climbs back on the other half and arrives on `to` beside where it started.
// The rect is cut out of the `to` floor (and of the `from` ceiling); the void's edges get a
// balustrade except where the stair arrives and where a wall already closes them.
//
// Local frame of a stair: s = distance along `up` from the start edge (0 … L), t = distance across
// from the left edge looking up (0 … W).
import { wallRuns } from './geom.js';

const RISER = 0.17;          // target riser height
export const RAIL_H = 0.9;   // handrail height above the tread nose line
export const GAP = 0.1;      // U: thin wall between the flights

export function stairFrame(r, up) {
  const [x0, y0, x1, y1] = r;
  const ns = up === 'n' || up === 's';
  const L = ns ? y1 - y0 : x1 - x0, W = ns ? x1 - x0 : y1 - y0;
  const P = {
    n: (s, t) => [x0 + t, y0 + s],
    s: (s, t) => [x1 - t, y1 - s],
    e: (s, t) => [x0 + s, y1 - t],
    w: (s, t) => [x1 - s, y0 + t],
  }[up] || ((s, t) => [x0 + t, y0 + s]);
  const R = (s0, s1, t0, t1) => {
    const a = P(s0, t0), b = P(s1, t1);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  };
  const axis = ns ? 'y' : 'x';
  const coord = (s) => (ns ? P(s, 0)[1] : P(s, 0)[0]);
  return { L, W, P, R, axis, coord };
}

// One flight: from (sStart, hStart) to (sEnd, hEnd) across t0..t1
function flight(F, sStart, sEnd, t0, t1, hStart, hEnd) {
  const n = Math.max(2, Math.round(Math.abs(hEnd - hStart) / RISER));
  const steps = [];
  for (let i = 0; i < n; i++) {
    const sa = sStart + (sEnd - sStart) * i / n, sb = sStart + (sEnd - sStart) * (i + 1) / n;
    steps.push({ rect: F.R(Math.min(sa, sb), Math.max(sa, sb), t0, t1), top: hStart + (hEnd - hStart) * (i + 1) / n });
  }
  return {
    rect: F.R(Math.min(sStart, sEnd), Math.max(sStart, sEnd), t0, t1),
    // walk surface: physics.addSlope(rect, axis, a0, h0, a1, h1)
    slope: [F.axis, F.coord(sStart), hStart, F.coord(sEnd), hEnd],
    sStart, sEnd, t0, t1, hStart, hEnd, n, riser: (hEnd - hStart) / n, going: Math.abs(sEnd - sStart) / n, steps,
  };
}

export function planStairs(list = [], LEVELS) {
  const out = [];
  for (const s of list) {
    const A = LEVELS[s.from]?.elev, B = LEVELS[s.to]?.elev;
    if (A === undefined || B === undefined || !(B > A) || !Array.isArray(s.r)) continue;
    const F = stairFrame(s.r, s.up);
    const plan = { id: s.id, type: s.type, r: s.r, up: s.up, from: s.from, to: s.to, A, B, frame: F, flights: [], landing: null, split: null, material: s.material, rail: s.rail };
    if (s.type === 'U') {
      const fw = (F.W - GAP) / 2;
      const land = Math.min(F.L * 0.45, s.landing ?? Math.max(1.0, fw));
      const Lf = F.L - land, mid = (A + B) / 2;
      const right = s.first !== 'left';
      const t1a = right ? F.W - fw : 0, t1b = right ? F.W : fw;          // first flight
      const t2a = right ? 0 : F.W - fw, t2b = right ? fw : F.W;          // second flight
      plan.flights.push(flight(F, 0, Lf, t1a, t1b, A, mid));
      plan.flights.push(flight(F, Lf, 0, t2a, t2b, mid, B));
      plan.landing = { rect: F.R(Lf, F.L, 0, F.W), z: mid, s0: Lf, s1: F.L };
      const ta = right ? fw : F.W - fw - GAP;
      plan.split = { rect: F.R(0, Lf, ta, ta + GAP), z0: A, z1: B + 1.0, t0: ta, t1: ta + GAP };
      // where the walker steps off on the upper floor: the s = 0 edge of the second flight
      plan.arrival = { s: 0, t0: t2a, t1: t2b };
      plan.start = { s: 0, t0: t1a, t1: t1b };
    } else {
      plan.flights.push(flight(F, 0, F.L, 0, F.W, A, B));
      plan.arrival = { s: F.L, t0: 0, t1: F.W };
      plan.start = { s: 0, t0: 0, t1: F.W };
    }
    // centre of the bottom step and of the top arrival, a little outside the stair (checks, teleports)
    const mid = (a) => (a.t0 + a.t1) / 2;
    plan.bottomPoint = F.P(plan.start.s - 0.6, mid(plan.start));
    plan.topPoint = F.P(plan.arrival.s + (plan.arrival.s === 0 ? -0.6 : 0.6), mid(plan.arrival));
    out.push(plan);
  }
  return out;
}

// The void edges on the upper floor that need a balustrade: the rect's four edges minus the arrival
// and minus what a wall of `to` already closes. Returns [[x0, y0, x1, y1] segments (axis-aligned)].
export function voidEdges(plan, Z) {
  const [x0, y0, x1, y1] = plan.r, F = plan.frame;
  const a = plan.arrival;
  const arrA = F.P(a.s, a.t0), arrB = F.P(a.s, a.t1);
  const runs = wallRuns(Z.floors[plan.to] || [], Z.open[plan.to] || []);
  const edges = [[x0, y0, x1, y0], [x1, y0, x1, y1], [x0, y1, x1, y1], [x0, y0, x0, y1]];
  const out = [];
  for (const [ax, ay, bx, by] of edges) {
    const h = ay === by;
    const fixed = h ? ay : ax, lo = h ? ax : ay, hi = h ? bx : by;
    let spans = [[lo, hi]];
    const cut = (p, q) => { spans = spans.flatMap(([u, v]) => (q <= u || p >= v ? [[u, v]] : [[u, p], [q, v]].filter(([m, n]) => n - m > 0.05))); };
    // arrival
    const onArr = h ? Math.abs(arrA[1] - fixed) < 1e-6 && Math.abs(arrB[1] - fixed) < 1e-6 : Math.abs(arrA[0] - fixed) < 1e-6 && Math.abs(arrB[0] - fixed) < 1e-6;
    if (onArr) { const p = h ? Math.min(arrA[0], arrB[0]) : Math.min(arrA[1], arrB[1]), q = h ? Math.max(arrA[0], arrB[0]) : Math.max(arrA[1], arrB[1]); cut(p, q); }
    // walls of the upper floor within 0.2 m, parallel
    for (const run of runs) {
      if ((run.o === 'h') !== h || Math.abs(run.fixed - fixed) > 0.2) continue;
      cut(run.start, run.end);
    }
    for (const [u, v] of spans) out.push(h ? [u, fixed, v, fixed] : [fixed, u, fixed, v]);
  }
  return out;
}

// Is the flight side at local t (0 = left edge, W = right edge) against a wall of the lower floor
// (or the U split wall)? Used to choose a wall handrail or a free-standing balustrade.
export function sideOnWall(plan, Z, t) {
  const F = plan.frame;
  if (plan.split && (Math.abs(t - plan.split.t0) < 1e-6 || Math.abs(t - plan.split.t1) < 1e-6)) return true;
  const [ax, ay] = F.P(0, t), [bx, by] = F.P(F.L, t);
  const h = Math.abs(ay - by) < 1e-6, fixed = h ? ay : ax;
  const lo = h ? Math.min(ax, bx) : Math.min(ay, by), hi = h ? Math.max(ax, bx) : Math.max(ay, by);
  const runs = wallRuns(Z.floors[plan.from] || [], Z.open[plan.from] || []);
  let cover = 0;
  for (const run of runs) {
    if ((run.o === 'h') !== h || Math.abs(run.fixed - fixed) > 0.2) continue;
    cover += Math.max(0, Math.min(hi, run.end) - Math.max(lo, run.start));
  }
  return cover > (hi - lo) * 0.6;
}
