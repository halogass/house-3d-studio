// Doors that open and close: every swing / double / sliding / folding / garage door of the plan's
// openings, and the site gates (zoning `site.items` kind 'gate'): a sliding gate slides open along
// its line, a swing gate swings in. Gates with `auto: true` open by themselves when someone (or a
// car) comes near and close again when nobody is around; the others open with E / a tap like a door.
//
// All doors start CLOSED. A closed door is a physics collider (Physics.collides skips colliders
// with `off`), an open one is passable. Leaves are drawn with a few InstancedMeshes per level
// (wood panel leaf, brass hardware, steel, glass, iron frame, gate bars), so the whole system adds
// about 20 draw calls and only the doors that move touch their instance matrices.
//
// world.js leaves its static open leaves out when DOOR_MODE.dynamic is set
// (the app sets it before building; headless scripts may too, see scripts/check.mjs).
//
//   const doors = new Doors({ groups, physics, getMaterial, player });
//   doors.update(dt, player, peers)   per frame (peers: Map of multiplayer peers with .cur {x,y,e}, or null)
//   doors.pick(player, level, strict) door the player faces within reach (Interact prompt), or null
//   doors.raycast(raycaster)          door hit by a ray (tap / click), or null
//   doors.toggle(d) / open(d) / close(d)   d = door or id; broadcasts through doors.send(msg)
//   doors.openNear(x, y, radius = 3, { e, close })   opens doors (and wakes the automatic gates) near a
//                                     point, e.g. a car approaching; returns the ids it opened
//   doors.openAll(instant) / closeAll(instant)
//   doors.snapshot() / applyRemote(msg, wins) / applySnapshot(list, wins)   multiplayer (session.js)
import * as THREE from 'three';
import { DOOR_TOP, DOOR_MODE } from './geom.js';
import { LEVELS, RADIUS, BODY, GROUND } from './config.js';
import { panelDoorGeometry } from './interior/finishes.js';
import { Z as ZDATA } from './data.js';
import { t } from './i18n.js';

export { DOOR_MODE };

// Seconds for a full open / close
const TIME = { swing: 0.9, double: 1.0, sliding: 1.2, folding: 1.4, garage: 4.5, gate: 4.0, gateSwing: 2.0 };
export const MOVABLE = new Set(['swing', 'double', 'sliding', 'folding', 'garage']);
const AUTO_REACH = 4.5;    // m: an automatic gate opens for anyone (or any car) this close
const PASS = 0.6;          // swing-type doors stop blocking beyond this open fraction
const REACH = 2.0;         // m from the player to a door for the E prompt
const ease = (f) => f * f * (3 - 2 * f);

const _m = new THREE.Matrix4(), _t = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

// Leaf frame: translate to plan (px, py) at elevation z, rotate so local +X runs along plan angle th.
function frame(M, px, py, z, th) {
  _q.setFromAxisAngle(UP, th);
  _v.set(px, z, -py);
  return M.compose(_v, _q, _s);
}
// Local matrix of a box part spanning x0..x1, y0..y1 (leaf space), depth d centred at zc
function part(x0, x1, y0, y1, zc, d) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x0, y0, zc), new THREE.Quaternion(), new THREE.Vector3(x1 - x0, y1 - y0, d));
}

export class Doors {
  constructor({ groups = null, physics, getMaterial = null, player = null, Z = ZDATA }) {
    this.physics = physics;
    this.player = player;
    this.list = [];
    this.byId = new Map();
    this.byLevel = new Map();
    this.active = [];          // doors animating (or waiting for the doorway to clear)
    this.batches = new Map();  // group|kind → { geo, mat, parts: [], mesh, dirty }
    this.meshes = [];
    this.send = null;          // (msg) => void, set by the app (multiplayer)
    this.virtual = [];         // openNear() pokes for the automatic gates: { x, y, e, r, ttl }
    this._scratch = { x0: 0, y0: 0, x1: 0, y1: 0, z0: 0, z1: 0, off: false };
    this._getMaterial = getMaterial;
    this._unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0);
    // Wood panel leaf normalised to 1 × 1 (x 0..1 from the hinge, y 0..1 up), 45 mm thick
    this._panel = panelDoorGeometry(0.9, 2.1, 0.045).translate(0.45, 0, 0).scale(1 / 0.9, 1 / 2.1, 1);

    for (const [lv, ops] of Object.entries(Z.openings || {})) {
      for (const o of ops) {
        if (!MOVABLE.has(o.t) || !LEVELS[lv]) continue;
        this._add({ ...o, id: `${lv}:${o.o}${o.x},${o.y}`, lv, group: lv, fl: LEVELS[lv].elev, top: DOOR_TOP[o.t] || 2.2 });
      }
    }
    // site gates
    const site = Z.site || { w: 20, d: 30 };
    for (const [i, g] of (Z.gates || []).entries()) {
      if (!g.from || !g.to) continue;
      const h = g.from[1] === g.to[1];
      const fixed = h ? g.from[1] : g.from[0];
      const a0 = Math.min(h ? g.from[0] : g.from[1], h ? g.to[0] : g.to[1]), a1 = Math.max(h ? g.from[0] : g.from[1], h ? g.to[0] : g.to[1]);
      const id = 'gate:' + (g.id || i);
      if (g.type === 'swing') {
        // swings into the plot (towards its centre)
        const inward = h ? (fixed < site.d / 2 ? 1 : -1) : (fixed < site.w / 2 ? 1 : -1);
        this._add({ id, lv: GROUND, group: 'site', o: h ? 'h' : 'v', x: h ? a0 : fixed, y: h ? fixed : a0, w: a1 - a0, t: 'swing', side: inward, hinge: 's', fl: 0, top: g.h ?? 1.8, bars: true, auto: !!g.auto, name: g.name });
      } else this._slidingGate(id, g, h, fixed, a0, a1, site);
    }
    this._buildMeshes(groups);
    for (const d of this.list) this._pose(d);
    for (const b of this.batches.values()) if (b.mesh) { b.mesh.instanceMatrix.needsUpdate = true; b.mesh.computeBoundingSphere(); b.mesh.boundingSphere.radius += 7; }
    physics.build();
  }

  // ------------------------------------------------------------------ building
  _batch(group, kind, mat) {
    const k = group + '|' + kind + '|' + mat;
    let b = this.batches.get(k);
    if (!b) { b = { group, kind, mat, parts: [], mesh: null, owners: [] }; this.batches.set(k, b); }
    return b;
  }
  // A part of a leaf: batch + local matrix
  _part(leaf, door, group, kind, mat, local) {
    const b = this._batch(group, kind, mat);
    leaf.parts.push({ b, i: b.parts.length, local });
    b.parts.push(local);
    b.owners.push(door);
  }

  _add(o) {
    const h = o.o === 'h';
    const u = h ? [1, 0] : [0, 1], n = h ? [0, 1] : [1, 0];
    const side = o.side || 1;
    const along = h ? o.x : o.y, fixed = h ? o.y : o.x;
    const P = (a, d = 0) => [h ? a : fixed + d, h ? fixed + d : a];   // plan point at along-coord a, depth d
    const fl = o.fl, dt = fl + o.top, H = dt - fl - 0.02;
    const thU = Math.atan2(u[1], u[0]);
    const d = {
      id: o.id, t: o.t, lv: o.lv, group: o.group, o: o.o, x: o.x, y: o.y, w: o.w, fl, dt,
      f: 0, target: 0, v: 0, speed: 1 / (o.bars ? TIME.gateSwing : TIME[o.t] || 1), leaves: [], col: null, cx: 0, cy: 0, hold: false,
      auto: !!o.auto, gate: !!o.bars, name: o.name,
    };
    const w = o.w;
    const half = o.t === 'sliding' || o.t === 'folding';
    [d.cx, d.cy] = P(along + w * (half ? 0.75 : 0.5));
    // Closed collider (shrinks / lifts with the door for sliding, folding, garage)
    const c0 = half ? along + w / 2 : along, c1 = along + w;
    const [ax, ay] = P(c0, -0.06), [bx, by] = P(c1, 0.06);
    this.physics.addCollider(ax, ay, bx, by, fl, dt);
    d.col = this.physics.colliders[this.physics.colliders.length - 1];
    d.colBase = { x0: d.col.x0, y0: d.col.y0, x1: d.col.x1, y1: d.col.y1, z0: d.col.z0, z1: d.col.z1 };
    d.colAxis = h ? 'x' : 'y';

    const swingLeaf = (hingeA, dir, L, kind) => {
      const [hx, hy] = P(hingeA);
      const thC = Math.atan2(u[1] * dir, u[0] * dir);
      const thO = Math.atan2(n[1] * side, n[0] * side);
      const delta = Math.atan2(Math.sin(thO - thC), Math.cos(thO - thC));
      const leaf = { parts: [], pose: (f, M) => frame(M, hx, hy, fl + 0.01, thC + delta * ease(f)) };
      if (kind === 'bars') {
        // garden gate: frame + vertical bars
        const g = o.group;
        this._part(leaf, d, g, 'box', 'railing', part(0, L, 0.05, 0.13, 0, 0.05));
        this._part(leaf, d, g, 'box', 'railing', part(0, L, H - 0.08, H, 0, 0.05));
        this._part(leaf, d, g, 'box', 'railing', part(0, 0.05, 0.05, H, 0, 0.05));
        this._part(leaf, d, g, 'box', 'railing', part(L - 0.05, L, 0.05, H, 0, 0.05));
        for (let x = 0.15; x < L - 0.1; x += 0.12) this._part(leaf, d, g, 'box', 'railing', part(x, x + 0.025, 0.13, H - 0.08, 0, 0.025));
      } else if (kind === 'wood') {
        this._part(leaf, d, o.group, 'panel', o.mat || 'door', new THREE.Matrix4().makeScale(L, H, 1));
        // lever handles + roses on both faces
        const hz = Math.min(1.0, H * 0.46);
        for (const s of [1, -1]) {
          this._part(leaf, d, o.group, 'box', 'brassAged', part(L - 0.085, L - 0.055, hz - 0.06, hz + 0.06, s * 0.026, 0.008));
          this._part(leaf, d, o.group, 'box', 'brassAged', part(L - 0.19, L - 0.06, hz - 0.012, hz + 0.012, s * 0.045, 0.02));
        }
      }
      d.leaves.push(leaf);
    };

    // Glass panel with an iron frame: x 0..L, y 0..H in leaf space, depth 0.04
    const glassPanel = (leaf, L, Hh) => {
      const g = o.group;
      this._part(leaf, d, g, 'box', 'glass', part(0.04, L - 0.04, 0.1, Hh - 0.04, 0, 0.012));
      this._part(leaf, d, g, 'box', 'ironBlack', part(0, 0.05, 0, Hh, 0, 0.045));
      this._part(leaf, d, g, 'box', 'ironBlack', part(L - 0.05, L, 0, Hh, 0, 0.045));
      this._part(leaf, d, g, 'box', 'ironBlack', part(0.05, L - 0.05, 0, 0.12, 0, 0.045));
      this._part(leaf, d, g, 'box', 'ironBlack', part(0.05, L - 0.05, Hh - 0.05, Hh, 0, 0.045));
      const cols = Math.max(1, Math.round((L - 0.1) / 0.5)), rows = Math.max(2, Math.round((Hh - 0.17) / 0.45));
      for (let i = 1; i < cols; i++) { const x = 0.05 + (L - 0.1) * i / cols; this._part(leaf, d, g, 'box', 'ironBlack', part(x - 0.013, x + 0.013, 0.12, Hh - 0.05, 0, 0.03)); }
      for (let j = 1; j < rows; j++) { const y = 0.12 + (Hh - 0.17) * j / rows; this._part(leaf, d, g, 'box', 'ironBlack', part(0.05, L - 0.05, y - 0.013, y + 0.013, 0, 0.03)); }
      // pull handle
      this._part(leaf, d, g, 'box', 'ironBlack', part(L - 0.13, L - 0.1, 0.8, 1.25, 0.045, 0.025));
      this._part(leaf, d, g, 'box', 'ironBlack', part(L - 0.13, L - 0.1, 0.8, 1.25, -0.045, 0.025));
    };

    const leafKind = o.bars ? 'bars' : 'wood';
    if (o.t === 'swing') {
      if (o.hinge === 'e') swingLeaf(along + w - 0.04, -1, w - 0.055, leafKind);
      else swingLeaf(along + 0.04, 1, w - 0.055, leafKind);
    } else if (o.t === 'double') {
      swingLeaf(along + 0.03, 1, w / 2 - 0.035, leafKind);
      swingLeaf(along + w - 0.03, -1, w / 2 - 0.035, leafKind);
    } else if (o.t === 'sliding') {
      // world.js keeps the fixed panel over the first half; this one slides over it
      const L = w / 2 + 0.05, start = along + w / 2 - 0.05, run = w / 2 - 0.06, dep = 0.075 * side;
      const leaf = { parts: [], pose: (f, M) => { const [px, py] = P(start - run * ease(f), dep); return frame(M, px, py, fl, thU); } };
      glassPanel(leaf, L, dt - fl - 0.01);
      d.leaves.push(leaf);
      d.slide = { c1, run };
    } else if (o.t === 'folding') {
      // bi-fold over the second half: leaf A hinged at the fixed panel, B follows, its far end on the track
      const L = w / 4 - 0.01, a0 = along + w / 2 + 0.005, MAX = 1.4;
      const [qx, qy] = P(a0);
      const thN = Math.atan2(n[1] * side, n[0] * side);
      const s = Math.sign(Math.atan2(Math.sin(thN - thU), Math.cos(thN - thU)));
      const A = { parts: [], pose: (f, M) => frame(M, qx, qy, fl, thU + s * MAX * ease(f)) };
      const B = { parts: [], pose: (f, M) => {
        const ph = MAX * ease(f), ta = thU + s * ph;
        return frame(M, qx + L * Math.cos(ta), qy + L * Math.sin(ta), fl, thU - s * ph);
      } };
      glassPanel(A, L, dt - fl - 0.01); glassPanel(B, L, dt - fl - 0.01);
      d.leaves.push(A, B);
      d.slide = { c1, run: w / 2 - 2 * L * Math.cos(MAX) - 0.05 };
    } else if (o.t === 'garage') {
      // rolling shutter: 10 cm slats that rise into the drum above the opening
      const Hh = dt - fl, S = 0.1, N = Math.ceil(Hh / S);
      const [sx, sy] = P(along - 0.04, 0.04);
      for (let i = 0; i < N; i++) {
        const leaf = { parts: [], pose: (f, M) => {
          const z = fl + i * S + Hh * ease(f);
          if (z + S > dt + 0.005) return M.makeScale(0, 0, 0);
          return frame(M, sx, sy, z, thU);
        } };
        this._part(leaf, d, o.group, 'box', i === 0 ? 'steelBrushed' : 'steel', part(0, w + 0.08, 0.004, S - 0.004, 0, i === 0 ? 0.07 : 0.045));
        d.leaves.push(leaf);
      }
      if (!o.shutter) { // drum housing (shutter doors get theirs from world.js)
        const leaf = { parts: [], pose: (f, M) => frame(M, sx, sy, dt, thU) };
        this._part(leaf, d, o.group, 'box', 'steelDark', part(0, w + 0.08, 0, 0.35, 0.18, 0.4));
        d.leaves.push(leaf);
      }
      d.lift = Hh;
    }
    this.list.push(d);
    this.byId.set(d.id, d);
    if (!this.byLevel.has(d.lv)) this.byLevel.set(d.lv, []);
    this.byLevel.get(d.lv).push(d);
  }

  // Sliding gate along a plot line: a bar leaf that slides off the opening towards the side with
  // more room (g.slide: 'start' | 'end' forces it). Collider shrinks with the leaf.
  _slidingGate(id, g, h, fixed, a0, a1, site) {
    const len = a1 - a0, H = g.h ?? 1.8;
    const room0 = a0, room1 = (h ? site.w : site.d) - a1;
    const dir = g.slide === 'start' ? -1 : g.slide === 'end' ? 1 : (room1 >= room0 ? 1 : -1);
    const inward = h ? (fixed < site.d / 2 ? 1 : -1) : (fixed < site.w / 2 ? 1 : -1);
    const track = fixed + inward * 0.12;   // just inside the plot line
    const d = {
      id, t: 'gate', lv: GROUND, group: 'site', o: h ? 'h' : 'v', x: h ? a0 : track, y: h ? track : a0, w: len, fl: 0, dt: H, name: g.name,
      f: 0, target: 0, v: 0, speed: 1 / TIME.gate, leaves: [], col: null, cx: h ? (a0 + a1) / 2 : track, cy: h ? track : (a0 + a1) / 2, hold: false,
      auto: g.auto !== false, slideGate: { h, track, a0, a1, dir, len },
    };
    if (h) this.physics.addCollider(a0, track - 0.05, a1, track + 0.05, 0, H);
    else this.physics.addCollider(track - 0.05, a0, track + 0.05, a1, 0, H);
    d.col = this.physics.colliders[this.physics.colliders.length - 1];
    d.colBase = { x0: d.col.x0, y0: d.col.y0, x1: d.col.x1, y1: d.col.y1, z0: d.col.z0, z1: d.col.z1 };
    const th = h ? 0 : Math.PI / 2;
    const leaf = { parts: [], pose: (f, M) => {
      const off = dir * len * 0.96 * ease(f);
      return h ? frame(M, a0 + off, track, 0, th) : frame(M, track, a0 + off, 0, th);
    } };
    const L = len;
    for (let x = 0.05; x <= L - 0.04; x += 0.12) this._part(leaf, d, 'site', 'box', 'railing', part(x, x + 0.04, 0.1, H - 0.1, 0, 0.05));
    this._part(leaf, d, 'site', 'box', 'railing', part(0, L, H - 0.12, H, 0, 0.08));
    this._part(leaf, d, 'site', 'box', 'railing', part(0, L, 0.04, 0.14, 0, 0.08));
    d.leaves.push(leaf);
    this.list.push(d);
    this.byId.set(id, d);
    if (!this.byLevel.has(d.lv)) this.byLevel.set(d.lv, []);
    this.byLevel.get(d.lv).push(d);
    return d;
  }

  _buildMeshes(groups) {
    const mat = (name) => (this._getMaterial && this._getMaterial(name)) || new THREE.MeshStandardMaterial();
    for (const b of this.batches.values()) {
      const geo = b.kind === 'panel' ? this._panel : this._unitBox;
      const m = mat(b.mat);
      const mesh = new THREE.InstancedMesh(geo, m, b.parts.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const noShadow = m.userData?.noShadow || m.transparent;
      mesh.castShadow = !noShadow;
      mesh.receiveShadow = true;
      mesh.userData.doors = b.owners;   // instanceId → door (raycasts)
      mesh.name = 'doors:' + b.group + ':' + b.mat;
      b.mesh = mesh;
      this.meshes.push(mesh);
      if (groups && groups[b.group]) groups[b.group].add(mesh);
    }
  }

  // Write the instance matrices of a door at its current open fraction
  _pose(d) {
    for (const leaf of d.leaves) {
      leaf.pose(d.f, _m);
      for (const p of leaf.parts) {
        _t.multiplyMatrices(_m, p.local);
        p.b.mesh.setMatrixAt(p.i, _t);
        p.b.dirty = true;
      }
    }
  }

  // Collider follows the door: swing types block until PASS, sliding/folding shrink towards the
  // fixed half, the garage curtain lifts, the gates slide east. Writes into c (the door's collider
  // or a scratch box) for open fraction f.
  _collider(d, f = d.f, c = d.col) {
    const e = ease(f), b = d.colBase;
    c.x0 = b.x0; c.y0 = b.y0; c.x1 = b.x1; c.y1 = b.y1; c.z0 = b.z0; c.z1 = b.z1;
    if (d.slideGate) {
      const G = d.slideGate, k = G.len * 0.96 * e;
      const lo = G.dir > 0 ? Math.min(G.a1, G.a0 + k) : G.a0, hi = G.dir > 0 ? G.a1 : Math.max(G.a0, G.a1 - k);
      if (G.h) { c.x0 = lo; c.x1 = hi; } else { c.y0 = lo; c.y1 = hi; }
      c.off = f > 0.97;
    } else if (d.slide) {
      const k = d.slide.run * e;
      if (d.colAxis === 'x') c.x1 = Math.max(b.x0, b.x1 - k); else c.y1 = Math.max(b.y0, b.y1 - k);
      c.off = f > 0.97;
    } else if (d.lift) {
      c.z0 = b.z0 + d.lift * e;
      c.off = f > 0.97;
    } else c.off = f > PASS;
  }

  // Would the door (at open fraction f) shut onto the local player?
  _blocksPlayer(d, f) {
    const p = this.player;
    if (!p) return false;
    const c = this._scratch;
    this._collider(d, f, c);
    if (c.off) return false;
    const lo = p.e + 0.3, hi = p.e + BODY;
    if (c.z1 <= lo || c.z0 >= hi) return false;
    const cx = Math.max(c.x0, Math.min(p.x, c.x1)), cy = Math.max(c.y0, Math.min(p.y, c.y1));
    // swing leaves also sweep the doorway: keep clear of the whole opening while they close
    const r = d.slideGate || d.slide || d.lift ? RADIUS : RADIUS + 0.35;
    return (p.x - cx) ** 2 + (p.y - cy) ** 2 < r * r;
  }

  // ------------------------------------------------------------------ state changes
  _get(d) { return typeof d === 'string' ? this.byId.get(d) : d; }
  _setTarget(d, open) {
    const t = open ? 1 : 0;
    if (d.target === t) return false;
    d.target = t;
    if (!this.active.includes(d)) this.active.push(d);
    return true;
  }
  isOpen(d) { d = this._get(d); return !!d && d.target === 1; }
  // Local actions bump the door's version and go out to peers
  set(d, open) {
    d = this._get(d);
    if (!d || d.auto) return false;
    if (!this._setTarget(d, open)) return false;
    d.v++;
    try { this.send?.({ id: d.id, o: d.target, v: d.v }); } catch { /* offline */ }
    return true;
  }
  open(d) { return this.set(d, true); }
  close(d) { return this.set(d, false); }
  toggle(d) { d = this._get(d); return !!d && this.set(d, d.target !== 1); }
  label(d) {
    const open = d.target === 1;
    if (d.t === 'garage') return t(open ? 'closeGarage' : 'openGarage');
    return t(open ? 'closeDoor' : 'openDoor');
  }

  openAll(instant = false) { for (const d of this.list) this._force(d, 1, instant); }
  closeAll(instant = false) { for (const d of this.list) this._force(d, 0, instant); }
  _force(d, to, instant) {
    d.target = to;
    if (instant) { d.f = to; this._pose(d); this._collider(d); this._flush(); } else if (!this.active.includes(d)) this.active.push(d);
    if (d.auto) d.forced = true;   // gates stay as forced until the next automatic decision with someone near
  }

  // A car (or anything) arriving: open the movable doors within radius and wake the automatic gates
  openNear(x, y, radius = 3, opts = {}) {
    const ids = [];
    for (const d of this.list) {
      if (d.auto) continue;
      if (opts.e !== undefined && Math.abs(opts.e - d.fl) > 1.6) continue;
      if (Math.hypot(d.cx - x, d.cy - y) > radius + d.w / 2) continue;
      if (opts.close ? this.close(d) : this.open(d)) ids.push(d.id);
    }
    if (!opts.close) this.virtual.push({ x, y, e: opts.e ?? 0, r: Math.max(0.6, radius), ttl: 1.5 });
    return ids;
  }
  closeNear(x, y, radius = 3, opts = {}) { return this.openNear(x, y, radius, { ...opts, close: true }); }

  // ------------------------------------------------------------------ multiplayer
  // wins: the sender wins ties (same version), decided by the session from the peer ids
  applyRemote(m, wins = false) {
    const d = this.byId.get(m.id);
    if (!d || d.auto) return;
    if (m.v > d.v || (m.v === d.v && wins)) { d.v = m.v; this._setTarget(d, m.o === 1); }
  }
  snapshot() {
    const out = [];
    for (const d of this.list) if (d.v > 0 && !d.auto) out.push([d.id, d.target, d.v]);
    return out;
  }
  applySnapshot(list, wins = false) {
    for (const [id, o, v] of list || []) this.applyRemote({ id, o, v }, wins);
  }

  // ------------------------------------------------------------------ interaction
  // The door the player is facing within reach (same level). strict: only when looking at it.
  pick(p, lv, strict = false) {
    const list = this.byLevel.get(lv);
    if (!list) return null;
    const fx = Math.sin(p.yaw), fy = Math.cos(p.yaw);
    let best = null, score = Infinity;
    for (const d of list) {
      if (d.auto || Math.abs(p.e - d.fl) > 1.2) continue;
      const dx = d.cx - p.x, dy = d.cy - p.y, dist = Math.hypot(dx, dy);
      const reach = REACH + Math.min(1.5, d.w / 2 - 0.4);
      if (dist > reach) continue;
      const ahead = dist > 0.01 ? (dx * fx + dy * fy) / dist : 1;
      if (ahead < (strict ? 0.75 : 0.35) && dist > 0.7) continue;
      const sc = dist * (1.6 - ahead);
      if (sc < score) { score = sc; best = d; }
    }
    return best;
  }

  raycast(ray) {
    const vis = [];
    for (const m of this.meshes) { let o = m, v = true; while (o) { if (!o.visible) { v = false; break; } o = o.parent; } if (v) vis.push(m); }
    const hit = ray.intersectObjects(vis, false)[0];
    if (!hit || hit.instanceId === undefined) return null;
    const d = hit.object.userData.doors[hit.instanceId];
    return d && !d.auto ? d : null;
  }

  // ------------------------------------------------------------------ automatic gates
  // An automatic gate wants to be open while anyone (the player, a partner, a car's openNear poke)
  // is within AUTO_REACH of it at garden level; it never closes on someone in its track.
  _autoGates(dt, player, peers) {
    const auto = this.list.filter(d => d.auto);
    if (!auto.length) return;
    const actors = [];
    if (player) actors.push(player);
    if (peers) peers.forEach(p => { if (p.cur) actors.push(p.cur); });
    for (let i = this.virtual.length - 1; i >= 0; i--) {
      const v = this.virtual[i];
      v.ttl -= dt;
      if (v.ttl <= 0) { this.virtual.splice(i, 1); continue; }
      actors.push({ ...v, reach: v.r });
    }
    for (const d of auto) {
      let want = false, hold = false;
      for (const a of actors) {
        if (a.e !== undefined && (a.e < -0.6 || a.e > 1.6)) continue;
        const dist = Math.hypot(a.x - d.cx, a.y - d.cy) - (d.w / 2);
        if (dist < (a.reach ? a.reach + 2 : AUTO_REACH)) want = true;
        // in the leaf's track: keep it from closing
        const G = d.slideGate;
        if (G && (G.h ? Math.abs(a.y - G.track) < 0.6 && a.x > Math.min(G.a0, G.a0 + G.dir * G.len) - 0.3 && a.x < Math.max(G.a1, G.a1 + G.dir * G.len) + 0.3
          : Math.abs(a.x - G.track) < 0.6 && a.y > Math.min(G.a0, G.a0 + G.dir * G.len) - 0.3 && a.y < Math.max(G.a1, G.a1 + G.dir * G.len) + 0.3)) hold = true;
      }
      if (!want && d.forced) { d.hold = hold; continue; }   // openAll()/closeAll() until someone comes
      if (want) d.forced = false;
      const to = want ? 1 : 0;
      if (d.target !== to) { d.target = to; if (!this.active.includes(d)) this.active.push(d); }
      d.hold = hold;
    }
  }

  // ------------------------------------------------------------------ per frame
  update(dt, player = this.player, peers = null) {
    if (player) this.player = player;
    this._autoGates(dt, player, peers);
    const A = this.active;
    for (let i = A.length - 1; i >= 0; i--) {
      const d = A[i];
      let f = d.f;
      if (d.target > f) f = Math.min(d.target, f + dt * d.speed);
      else if (d.target < f) {
        const nf = Math.max(d.target, f - dt * d.speed);
        // closing: wait while someone is in the way (gate track sensor / local player in the doorway)
        if (!d.hold && !this._blocksPlayer(d, nf)) f = nf;
      }
      if (f !== d.f) { d.f = f; this._pose(d); this._collider(d); }
      if (d.f === d.target) A.splice(i, 1);
    }
    this._flush();
  }
  _flush() {
    for (const b of this.batches.values()) if (b.dirty) { b.mesh.instanceMatrix.needsUpdate = true; b.dirty = false; }
  }

  stats() {
    let tris = 0, instances = 0;
    for (const b of this.batches.values()) {
      const g = b.mesh.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * b.mesh.count;
      instances += b.mesh.count;
    }
    return { doors: this.list.length, drawCalls: this.meshes.length, instances, tris };
  }
}
