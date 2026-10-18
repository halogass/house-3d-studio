// Walking physics in plan coordinates (x east, y north, e = elevation).
//
// Surfaces are things you can stand on: flat rects (optionally with holes) and
// slopes (ramps, stair flights). Colliders are vertical boxes (walls, glass,
// railings, furniture). A surface you cannot step onto but that is lower than
// your head (e.g. the underside of a stair flight) also blocks you.
import { STEP, BODY, RADIUS } from './config.js';

const CELL = 4;

export class Physics {
  constructor() {
    this.surfaces = [];
    this.colliders = [];
    this.globalSurfaces = [];
    this.grid = new Map();
    this.dynamic = [];
  }

  addFlat(r, h, holes) { this.surfaces.push({ r, h, holes }); }

  // Slope along axis ('x' or 'y'): height h0 at coordinate a0, h1 at a1.
  addSlope(r, axis, a0, h0, a1, h1) { this.surfaces.push({ r, slope: { axis, a0, h0, a1, h1 } }); }

  addGlobalFlat(r, h, holes) { this.globalSurfaces.push({ r, h, holes }); }

  addCollider(x0, y0, x1, y1, z0, z1) {
    this.colliders.push({
      x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1),
      z0: Math.min(z0, z1), z1: Math.max(z0, z1),
    });
  }

  build() {
    this.grid = new Map(); // rebuildable after more colliders are added
    const put = (item, kind, x0, y0, x1, y1) => {
      for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++)
        for (let j = Math.floor(y0 / CELL); j <= Math.floor(y1 / CELL); j++) {
          const k = i + ',' + j;
          if (!this.grid.has(k)) this.grid.set(k, { s: [], c: [] });
          this.grid.get(k)[kind].push(item);
        }
    };
    for (const s of this.surfaces) put(s, 's', s.r[0], s.r[1], s.r[2], s.r[3]);
    for (const c of this.colliders) put(c, 'c', c.x0 - RADIUS, c.y0 - RADIUS, c.x1 + RADIUS, c.y1 + RADIUS);
  }

  cell(x, y) { return this.grid.get(Math.floor(x / CELL) + ',' + Math.floor(y / CELL)); }

  heightAt(s, x, y) {
    const [x0, y0, x1, y1] = s.r;
    if (x < x0 - 1e-4 || x > x1 + 1e-4 || y < y0 - 1e-4 || y > y1 + 1e-4) return null;
    if (s.holes) for (const h of s.holes) if (x > h[0] && x < h[2] && y > h[1] && y < h[3]) return null;
    if (!s.slope) return s.h;
    const { axis, a0, h0, a1, h1 } = s.slope;
    const a = axis === 'x' ? x : y;
    const t = Math.min(1, Math.max(0, (a - a0) / (a1 - a0)));
    return h0 + (h1 - h0) * t;
  }

  // Highest surface you could stand on from elevation e, and whether something
  // too high to step on but lower than your head is in the way.
  probe(x, y, e) {
    let support = -Infinity, blocked = false;
    const test = (s) => {
      const h = this.heightAt(s, x, y);
      if (h === null) return;
      if (h <= e + STEP) { if (h > support) support = h; }
      else if (h < e + BODY) blocked = true;
    };
    const c = this.cell(x, y);
    if (c) c.s.forEach(test);
    this.globalSurfaces.forEach(test);
    return { support, blocked };
  }

  collides(x, y, e) {
    const c = this.cell(x, y);
    const lo = e + 0.3, hi = e + BODY;
    if (c) for (const b of c.c) {
      if (b.off || b.z1 <= lo || b.z0 >= hi) continue; // off: an open door (engine/doors.js)
      const cx = Math.max(b.x0, Math.min(x, b.x1)), cy = Math.max(b.y0, Math.min(y, b.y1));
      if ((x - cx) ** 2 + (y - cy) ** 2 < RADIUS * RADIUS) return true;
    }
    return this.dynamic.length > 0 && this.hitsDynamic(x, y, lo, hi);
  }

  // Moving oriented boxes (drivable cars, engine/drive): { x, y, yaw, hl, hw, z0, z1, off }
  // yaw = plan heading clockwise from north; hl / hw = half length / half width.
  hitsDynamic(x, y, lo, hi) {
    for (const d of this.dynamic) {
      if (d.off || d.z1 <= lo || d.z0 >= hi) continue;
      const dx = x - d.x, dy = y - d.y, s = Math.sin(d.yaw), c = Math.cos(d.yaw);
      const f = dx * s + dy * c, r = dx * c - dy * s;
      const cf = Math.max(-d.hl, Math.min(f, d.hl)), cr = Math.max(-d.hw, Math.min(r, d.hw));
      if ((f - cf) ** 2 + (r - cr) ** 2 < RADIUS * RADIUS) return true;
    }
    return false;
  }

  canStand(x, y, e) {
    if (this.collides(x, y, e)) return false;
    return !this.probe(x, y, e).blocked;
  }

  // Move player p = {x, y, e, vy, grounded} by (dx, dy) and apply gravity.
  step(p, dx, dy, dt) {
    const len = Math.hypot(dx, dy);
    const n = Math.max(1, Math.ceil(len / 0.06));
    for (let i = 0; i < n; i++) {
      const sx = dx / n, sy = dy / n;
      if (this.canStand(p.x + sx, p.y + sy, p.e)) { p.x += sx; p.y += sy; }
      else if (this.canStand(p.x + sx, p.y, p.e)) p.x += sx;
      else if (this.canStand(p.x, p.y + sy, p.e)) p.y += sy;
      // Follow stairs and ramps while grounded
      const { support } = this.probe(p.x, p.y, p.e);
      if (p.grounded && support > -Infinity && p.e - support <= 0.5) p.e = support;
    }
    const { support } = this.probe(p.x, p.y, p.e);
    if (support === -Infinity || p.e - support > 0.001) {
      if (p.grounded && support > -Infinity && p.e - support <= 0.5) { p.e = support; return; }
      p.grounded = false;
      p.vy -= 9.8 * dt;
      p.e += p.vy * dt;
      if (support > -Infinity && p.e <= support) { p.e = support; p.vy = 0; p.grounded = true; }
    } else {
      p.e = support; p.vy = 0; p.grounded = true;
    }
  }

  // Find the floor at (x, y) for a given starting elevation (teleports).
  landingAt(x, y, e) {
    const { support } = this.probe(x, y, e + 0.3);
    return support > -Infinity ? support : null;
  }
}
