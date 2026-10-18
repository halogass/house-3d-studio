// Photo vegetation for every garden of the site.
//
//   buildPhotoGarden(name, { trees, pots, beds, shrubs, vines, pergola, lawns, avoid, circles, seed }) → THREE.Mesh | null
//
// Everything green in one garden area — trees (spreading shade trees, olives, fruit trees,
// columnar cypresses), shrub and flower beds, climbers on walls, potted plants, the pergola's
// bougainvillea and the lawn's grass tufts — is ONE indexed mesh with ONE material shared by all the
// gardens: an alpha-tested photo atlas (public/garden/foliage.webp, 1024 px; foliage-512.webp on
// phones) holding leaf-cluster cards, shrub / flower cards, grass tufts and a tileable bark strip
// (CC0 Poly Haven plants recomposed offline; see public/garden/CREDITS.md). One draw call per garden in the main pass and one in the shadow
// pass; the GTAO normal pass skips it (cards would be opaque squares in the override material).
//
// The index buffer is ordered by level of detail, so LOD is just the draw range:
//   [core]   trunks, main limbs, the large canopy cards     — always
//   [detail] thin branches, fill cards, shrubs, climbers     — camera within DETAIL_REACH (phones less)
//   [grass]  grass tufts on the lawn                         — camera within GRASS_REACH (main pass only)
// Phones ('lite') draw every other grass tuft (the grass is stored interleaved).
// Nothing is drawn until the atlas has loaded (Node scripts never load it: no DOM there).
// Geometry is deterministic (seeded) so the full and the staged builds match.
import * as THREE from 'three';
import { rng, hash } from '../geom.js';

const DETAIL_REACH = 55, DETAIL_REACH_LITE = 38, GRASS_REACH = 24;

// Atlas regions in image pixels (2048 working size, y down) → uv rects [u0, v0, u1, v1]
const S = 2048, PAD = 6;
const reg = (x0, y0, x1, y1, pad = PAD) => [(x0 + pad) / S, 1 - (y1 - pad) / S, (x1 - pad) / S, 1 - (y0 + pad) / S];
const UV = {
  treeA: reg(0, 0, 1024, 1024), treeB: reg(1024, 0, 2048, 1024),
  shrub: reg(0, 1024, 1024, 1536), flower: reg(1024, 1024, 2048, 1536),
  grass: reg(0, 1536, 1024, 2048), bark: reg(1024, 1536, 2048, 2048, 4),
};

// ---------------------------------------------------------------- geometry writer
function writer() {
  const pos = [], nor = [], uv = [], col = [];
  const lists = { core: [], detail: [], grass: [] };
  const v = (p, n, t, c) => { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(t[0], t[1]); col.push(c[0], c[1], c[2]); return pos.length / 3 - 1; };
  return {
    lists, v,
    tri(list, a, b, c) { lists[list].push(a, b, c); },
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Uint8BufferAttribute(col.map(c => Math.max(0, Math.min(255, Math.round(c * 255)))), 3, true));
      const idx = [...lists.core, ...lists.detail, ...lists.grass];
      g.setIndex(idx);
      g.userData.ranges = { core: lists.core.length, detail: lists.core.length + lists.detail.length, all: idx.length };
      return g;
    },
  };
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const W = (x, y, z) => V3(x, z, -y); // plan (x, y, height) → three

// A quad card: centre c, half-axes U (width) and Vv (height), normals per vertex from fn(p), uv rect r
function card(w, list, c, U, Vv, r, normalAt, color) {
  const P = [c.clone().sub(U).sub(Vv), c.clone().add(U).sub(Vv), c.clone().add(U).add(Vv), c.clone().sub(U).add(Vv)];
  const T = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
  const ids = P.map((p, i) => w.v(p, normalAt(p), T[i], color));
  w.tri(list, ids[0], ids[1], ids[2]); w.tri(list, ids[0], ids[2], ids[3]);
}
// Tapered bark tube from a to b (three coords), radius r0 → r1, n sides; v follows the length
function tube(w, list, a, b, r0, r1, n, tone = 1) {
  const d = b.clone().sub(a), len = d.length();
  const ax = d.clone().normalize();
  const t1 = Math.abs(ax.y) < 0.95 ? V3(0, 1, 0).cross(ax).normalize() : V3(1, 0, 0).cross(ax).normalize();
  const t2 = ax.clone().cross(t1).normalize();
  const r = UV.bark, du = r[2] - r[0], dv = r[3] - r[1];
  // bark region ≈ 1 m of circumference across, 0.5 m along: v span per metre of length
  const circ = 2 * Math.PI * Math.max(r0, 0.05);
  const vSpan = Math.min(1, len / Math.max(0.35, circ * 0.5));
  const ring = (p, rad, vv) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n * Math.PI * 2;
      const nn = t1.clone().multiplyScalar(Math.cos(t)).addScaledVector(t2, Math.sin(t));
      out.push(w.v(p.clone().addScaledVector(nn, rad), nn, [r[0] + du * (i / n), r[1] + dv * vv], [0.78 * tone, 0.74 * tone, 0.7 * tone]));
    }
    return out;
  };
  const A = ring(a, r0, 0), B = ring(b, r1, vSpan);
  for (let i = 0; i < n; i++) { w.tri(list, A[i], A[i + 1], B[i + 1]); w.tri(list, A[i], B[i + 1], B[i]); }
}

// Random unit-ish frame for a card facing roughly along n
function frame(n, R, spin) {
  const t = Math.abs(n.y) < 0.9 ? V3(0, 1, 0).cross(n).normalize() : V3(1, 0, 0).cross(n).normalize();
  const b = n.clone().cross(t).normalize();
  const a = spin ?? R() * Math.PI * 2;
  return [t.clone().multiplyScalar(Math.cos(a)).addScaledVector(b, Math.sin(a)), t.clone().multiplyScalar(-Math.sin(a)).addScaledVector(b, Math.cos(a))];
}
const randDir = (R) => { const z = R() * 2 - 1, t = R() * Math.PI * 2, s = Math.sqrt(1 - z * z); return V3(s * Math.cos(t), z, s * Math.sin(t)); };

// ---------------------------------------------------------------- species
// Spreading shade tree (rain tree / ketapang-like umbrella crown). x, y plan; s = old scale (2.4 = a big single shade tree)
function shadeTree(w, x, y, s, dens = 1) {
  const R = rng(hash(`photoShade|${x}|${y}`));
  const k = s / 2.4;
  const base = W(x, y, 0);
  const crown = base.clone().add(V3(0, 6.3 * k, 0)), rad = [5.0 * k, 2.1 * k, 5.0 * k];
  const outward = (p) => {
    const d = p.clone().sub(crown); d.x /= rad[0]; d.y /= rad[1]; d.z /= rad[2];
    return d.normalize().multiplyScalar(0.7).add(V3(0, 0.55, 0)).normalize();
  };
  // trunk with a root flare, slightly leaning
  const top = base.clone().add(V3(0.12 * k, 2.7 * k, -0.08 * k));
  tube(w, 'core', base.clone().add(V3(0, -0.05, 0)), base.clone().add(V3(0.02, 0.45 * k, 0)), 0.47 * k, 0.36 * k, 10, 0.95);
  tube(w, 'core', base.clone().add(V3(0.02, 0.45 * k, 0)), top, 0.36 * k, 0.29 * k, 10);
  const tips = [];
  const LIMBS = 5;
  for (let i = 0; i < LIMBS; i++) {
    const az = i / LIMBS * Math.PI * 2 + R() * 0.5, el = 0.55 + R() * 0.35, len = (3.3 + R() * 1.0) * k;
    const dir = V3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    const start = top.clone().add(V3(0, -R() * 0.4 * k, 0));
    const mid = start.clone().addScaledVector(dir, len * 0.55).add(V3(0, 0.25 * k, 0));
    const dir2 = V3(dir.x, dir.y * 0.45, dir.z).normalize();
    const end = mid.clone().addScaledVector(dir2, len * 0.45);
    tube(w, 'core', start, mid, 0.21 * k, 0.15 * k, 7);
    tube(w, 'core', mid, end, 0.15 * k, 0.09 * k, 6);
    // secondary branches fanning out under the crown
    const n2 = dens < 1 ? 2 : 3 + (R() > 0.5 ? 1 : 0);
    for (let j = 0; j < n2; j++) {
      const from = j === 0 ? end : mid.clone().lerp(end, 0.3 + R() * 0.6);
      const az2 = az + (R() - 0.5) * 1.7, el2 = 0.15 + R() * 0.45, l2 = (1.4 + R() * 1.2) * k;
      const d2 = V3(Math.cos(az2) * Math.cos(el2), Math.sin(el2), Math.sin(az2) * Math.cos(el2));
      const tip = from.clone().addScaledVector(d2, l2);
      tube(w, 'detail', from, tip, 0.075 * k, 0.03 * k, 5);
      tips.push(tip);
      // twigs
      for (let q = 0; q < 2; q++) {
        const d3 = d2.clone().add(randDir(R).multiplyScalar(0.8)).normalize();
        d3.y = Math.abs(d3.y) * 0.6 + 0.15;
        const t2 = tip.clone().addScaledVector(d3.normalize(), (0.6 + R() * 0.5) * k);
        tube(w, 'detail', tip, t2, 0.03 * k, 0.012 * k, 4);
        tips.push(t2);
      }
    }
  }
  // canopy: large cards over the crown shell (core = the far LOD), fill cards around every twig tip
  const tone = (p) => { // inner / lower leaves darker (fake self-shadowing)
    const d = p.clone().sub(crown); const h = d.y / rad[1];
    const r2 = (d.x / rad[0]) ** 2 + (d.y / rad[1]) ** 2 + (d.z / rad[2]) ** 2;
    const g = 0.55 + 0.3 * Math.min(1, Math.sqrt(r2)) + 0.15 * Math.max(-1, Math.min(1, h));
    return [0.8 * g, 0.92 * g, 0.72 * g];
  };
  const shell = (list, count, size, rMin) => {
    for (let i = 0; i < count; i++) {
      const d = randDir(R); d.y = d.y * 0.8 + 0.12;
      const rr = rMin + (1 - rMin) * Math.cbrt(R());
      const p = crown.clone().add(V3(d.x * rad[0] * rr, d.y * rad[1] * rr, d.z * rad[2] * rr));
      if (p.y < crown.y - rad[1] * 0.9) p.y = crown.y - rad[1] * 0.9;
      const n = outward(p).add(randDir(R).multiplyScalar(0.6)).normalize();
      const [U, Vv] = frame(n, R);
      const sz = size * (0.8 + R() * 0.45) * k;
      card(w, list, p, U.multiplyScalar(sz / 2), Vv.multiplyScalar(sz / 2), R() > 0.35 ? UV.treeA : UV.treeB, outward, tone(p));
    }
  };
  shell('core', Math.round(170 * dens), 1.75 / Math.sqrt(Math.max(dens, 0.5)), 0.55);
  for (const t of tips) for (let i = 0; i < (dens < 1 ? 2 : 3); i++) {
    const p = t.clone().add(randDir(R).multiplyScalar(0.55 * k));
    const n = outward(p).add(randDir(R).multiplyScalar(0.7)).normalize();
    const [U, Vv] = frame(n, R);
    const sz = (0.9 + R() * 0.5) * k;
    card(w, 'detail', p, U.multiplyScalar(sz / 2), Vv.multiplyScalar(sz / 2), R() > 0.5 ? UV.treeB : UV.treeA, outward, tone(p));
  }
  shell('detail', Math.round(110 * dens), 1.2, 0.7);
}

// Fruit tree (mango / avocado / citrus): short trunk, dense rounded dark-green crown of leaf cards
function fruitTree(w, x, y, s) {
  const R = rng(hash(`photoFruit|${x}|${y}`));
  const base = W(x, y, 0), crown = base.clone().add(V3(0, 2.6 * s, 0)), rad = [1.55 * s, 1.15 * s, 1.55 * s];
  const top = base.clone().add(V3(0.05 * s, 1.35 * s, 0.03 * s));
  tube(w, 'core', base, top, 0.17 * s, 0.12 * s, 7, 0.85);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + R() * 0.5;
    tube(w, 'detail', top, top.clone().add(V3(Math.cos(a) * 0.8 * s, 0.7 * s, Math.sin(a) * 0.8 * s)), 0.08 * s, 0.035 * s, 5, 0.85);
  }
  const outward = (p) => p.clone().sub(crown).normalize().multiplyScalar(0.7).add(V3(0, 0.5, 0)).normalize();
  for (let i = 0; i < 80; i++) {
    const d = randDir(R); d.y = d.y * 0.85 + 0.05;
    const rr = 0.5 + 0.5 * Math.cbrt(R());
    const p = crown.clone().add(V3(d.x * rad[0] * rr, d.y * rad[1] * rr, d.z * rad[2] * rr));
    const n = outward(p).add(randDir(R).multiplyScalar(0.6)).normalize();
    const [U, Vv] = frame(n, R);
    const sz = (0.95 + R() * 0.45) * s;
    const g = 0.5 + 0.38 * rr + 0.12 * Math.max(0, d.y);
    card(w, i < 42 ? 'core' : 'detail', p, U.multiplyScalar(sz / 2), Vv.multiplyScalar(sz / 2), R() > 0.4 ? UV.treeA : UV.treeB, outward, [0.66 * g, 0.84 * g, 0.6 * g]);
  }
}

// Italian cypress: a slim column of upright leaf cards round a hidden trunk, tapering to a point
function cypressTree(w, x, y, s) {
  const R = rng(hash(`photoCypress|${x}|${y}`));
  const base = W(x, y, 0), H = 6.6 * s;
  tube(w, 'core', base, base.clone().add(V3(0, 1.0 * s, 0)), 0.14 * s, 0.1 * s, 6, 0.8);
  const axis = (h) => base.clone().add(V3(0, h, 0));
  const radius = (h) => { const t = h / H; return (0.74 - 0.62 * t * t) * s * (t < 0.12 ? 0.75 + 2 * t : 1); };
  let i = 0;
  for (let h = 0.55 * s; h < H; h += 0.42 * s) {
    const r = radius(h), n = Math.max(3, Math.round(7 * r / s));
    for (let k = 0; k < n; k++, i++) {
      const a = k / n * Math.PI * 2 + R() * 0.8 + h;
      const out = V3(Math.cos(a), 0.15, Math.sin(a)).normalize();
      const p = axis(h).addScaledVector(out, r * (0.55 + R() * 0.3));
      const U = V3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar((0.32 + R() * 0.12) * s);
      const Vv = V3(0, (0.42 + R() * 0.12) * s, 0).addScaledVector(out, 0.08 * s);
      const g = 0.5 + 0.3 * (h / H) + R() * 0.12;
      card(w, (k % 2 === 0) ? 'core' : 'detail', p, U, Vv, R() > 0.5 ? UV.treeB : UV.shrub, () => out.clone().add(V3(0, 0.35, 0)).normalize(), [0.55 * g, 0.72 * g, 0.5 * g]);
    }
  }
}

// Small olive-like tree: two leaning stems, a rounded silvery crown of shrub-leaf cards
function oliveTree(w, x, y, s) {
  const R = rng(hash(`photoOlive|${x}|${y}`));
  const base = W(x, y, 0), crown = base.clone().add(V3(0, 2.35 * s, 0)), rad = [1.15 * s, 0.8 * s, 1.15 * s];
  const a1 = base.clone().add(V3(0.25 * s, 1.0 * s, 0.1 * s)), a2 = base.clone().add(V3(-0.28 * s, 1.1 * s, -0.12 * s));
  tube(w, 'core', base, a1, 0.15 * s, 0.1 * s, 6, 0.9); tube(w, 'core', a1, base.clone().add(V3(0.08 * s, 1.85 * s, -0.1 * s)), 0.1 * s, 0.06 * s, 5, 0.9);
  tube(w, 'core', base, a2, 0.13 * s, 0.08 * s, 6, 0.9); tube(w, 'core', a2, base.clone().add(V3(-0.5 * s, 1.9 * s, 0.1 * s)), 0.08 * s, 0.04 * s, 5, 0.9);
  const outward = (p) => p.clone().sub(crown).normalize().multiplyScalar(0.7).add(V3(0, 0.5, 0)).normalize();
  for (let i = 0; i < 70; i++) {
    const d = randDir(R), rr = 0.45 + 0.55 * Math.cbrt(R());
    const p = crown.clone().add(V3(d.x * rad[0] * rr, d.y * rad[1] * rr, d.z * rad[2] * rr));
    const n = outward(p).add(randDir(R).multiplyScalar(0.6)).normalize();
    const [U, Vv] = frame(n, R);
    const sz = (0.75 + R() * 0.35) * s;
    const g = 0.75 + 0.3 * rr;
    card(w, i < 30 ? 'core' : 'detail', p, U.multiplyScalar(sz / 2), Vv.multiplyScalar(sz / 4), UV.shrub, outward, [0.86 * g, 0.94 * g, 0.84 * g]);
  }
}

// A shrub clump: three crossed vertical cards (shrub or flowering), bottom on the ground
function clump(w, list, x, y, z, wdt, hgt, R, uv = UV.shrub, tint = [1, 1, 1]) {
  const c = W(x, y, z + hgt / 2), ctr = W(x, y, z + hgt * 0.35);
  const outward = (p) => p.clone().sub(ctr).normalize().multiplyScalar(0.6).add(V3(0, 0.6, 0)).normalize();
  const a0 = R() * Math.PI;
  for (let i = 0; i < 3; i++) {
    const a = a0 + i * Math.PI / 3;
    const U = V3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(wdt / 2), Vv = V3(0, hgt / 2, 0);
    const g = 0.85 + R() * 0.2;
    card(w, list, c, U, Vv, uv, outward, [tint[0] * g, tint[1] * g, tint[2] * g]);
  }
}

// Flat climber cards on a wall face. from/to plan points along the wall, n = plan normal into the garden
function climber(w, from, to, n, hMin, hMax, R) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const ux = (to[0] - from[0]) / len, uy = (to[1] - from[1]) / len;
  const N = V3(n[0], 0, -n[1]);
  const norm = () => N.clone().multiplyScalar(0.8).add(V3(0, 0.6, 0)).normalize();
  for (let d = 0.3; d < len - 0.2; d += 0.55) {
    const top = hMin + (hMax - hMin) * (0.5 + 0.5 * Math.sin((from[0] + from[1] + d) * 0.7));
    for (let z = 0.5; z < top; z += 0.42) {
      if (R() > 0.85) continue;
      const off = 0.06 + R() * 0.08;
      const p = W(from[0] + ux * d + n[0] * off + (R() - 0.5) * 0.15 * ux, from[1] + uy * d + n[1] * off, z + (R() - 0.5) * 0.15);
      const tilt = (R() - 0.5) * 0.6;
      const U = V3(ux, 0, -uy).multiplyScalar(0.45).addScaledVector(N, tilt * 0.3);
      const Vv = V3(0, 0.22, 0).addScaledVector(N, 0.08);
      const g = 0.8 + R() * 0.25;
      card(w, 'detail', p, U, Vv, R() > 0.45 ? UV.flower : UV.shrub, norm, [g, g, g]);
    }
  }
}

// ---------------------------------------------------------------- one garden
// trees: [{ x, y, s, species: shade | olive | fruit | cypress, dens }]; pots: [{ x, y, plant, s }];
// beds: [[x0, y0, x1, y1, kind?]] (kind 'lav' = flowering); shrubs: [{ x, y, w, h, z?, flower? }];
// vines: [{ from, to, n, hMin, hMax }]; pergola: r; lawns: [[x0, y0, x1, y1]] grass tufts;
// avoid: rects / circles kept free of grass
export function buildPhotoGarden(name, { trees = [], pots = [], beds = [], shrubs = [], vines = [], pergola = null, lawns = [], avoid = [], circles = [], seed = name, grassSeed = name + 'Grass' } = {}) {
  const w = writer();
  for (const t of trees) {
    if (t.species === 'olive') oliveTree(w, t.x, t.y, t.s || 1);
    else if (t.species === 'fruit') fruitTree(w, t.x, t.y, t.s || 1);
    else if (t.species === 'cypress') cypressTree(w, t.x, t.y, t.s || 1);
    else shadeTree(w, t.x, t.y, t.s || 2.4, t.dens || 1);
  }
  const R = rng(hash(seed));
  for (const [x0, y0, x1, y1, kind] of beds)
    for (let y = y0 + 0.3; y < y1 - 0.1; y += 0.48) for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.5)
      clump(w, 'detail', x + (R() - 0.5) * 0.1, y + (R() - 0.5) * 0.1, 0.02, 0.75 + R() * 0.2, (kind === 'lav' ? 0.5 : 0.55) + R() * 0.2, R,
        kind === 'lav' && R() > 0.3 ? UV.flower : UV.shrub, kind === 'lav' ? [0.95, 0.9, 1.05] : [0.85, 0.95, 0.88]);
  for (const sh of shrubs) clump(w, 'detail', sh.x, sh.y, sh.z || 0.02, sh.w, sh.h, R, sh.flower ? UV.flower : UV.shrub, sh.tint || [0.8, 0.92, 0.8]);
  for (const v of vines) climber(w, v.from, v.to, v.n, v.hMin, v.hMax, R);
  for (const p of pots) {
    const s = p.s || 1;
    if (p.plant === 'lemon') {
      const c = W(p.x, p.y, 1.45 * s);
      const out = (q) => q.clone().sub(c).normalize().multiplyScalar(0.7).add(V3(0, 0.5, 0)).normalize();
      for (let i = 0; i < 16; i++) {
        const d = randDir(R), q = c.clone().addScaledVector(d, 0.3 * s * (0.6 + R() * 0.4));
        const [U, Vv] = frame(d.clone().add(V3(0, 0.3, 0)).normalize(), R);
        card(w, 'detail', q, U.multiplyScalar(0.3 * s), Vv.multiplyScalar(0.3 * s), UV.treeA, out, [0.9, 1, 0.85]);
      }
    } else if (p.plant === 'topiary') {
      const c = W(p.x, p.y, 0.88 * s);
      const out = (q) => q.clone().sub(c).normalize();
      for (let i = 0; i < 14; i++) {
        const d = randDir(R), q = c.clone().addScaledVector(d, 0.2 * s);
        const [U, Vv] = frame(d, R);
        card(w, 'detail', q, U.multiplyScalar(0.22 * s), Vv.multiplyScalar(0.22 * s), UV.shrub, out, [0.6, 0.78, 0.6]);
      }
    } else {
      for (let k = 0; k < 4; k++) clump(w, 'detail', p.x, p.y, (0.55 + k * 0.42) * s, (0.52 - k * 0.08) * s, 0.55 * s, R, UV.shrub, [0.7, 0.85, 0.7]);
    }
  }
  if (pergola) {
    // bougainvillea over the lattice and down the open (north) posts
    const r = pergola, H = 2.8;
    const up = () => V3(0, 1, 0);
    for (let x = r[0] + 0.3; x < r[2] - 0.1; x += 0.6) for (let y = r[1] + 0.3; y < r[3]; y += 0.6) {
      if (R() > 0.55) continue;
      const p = W(x + (R() - 0.5) * 0.3, y + (R() - 0.5) * 0.3, H + 0.5 + R() * 0.1);
      const a = R() * Math.PI;
      const U = V3(Math.cos(a), (R() - 0.5) * 0.3, Math.sin(a)).multiplyScalar(0.5);
      const Vv = V3(-Math.sin(a), (R() - 0.5) * 0.3, Math.cos(a)).multiplyScalar(0.28);
      card(w, 'detail', p, U, Vv, R() > 0.3 ? UV.flower : UV.shrub, up, [1, 1, 1]);
    }
    const n = Math.max(1, Math.round((r[2] - r[0]) / 3));
    for (let i = 0; i <= n; i++) {
      const px = r[0] + (r[2] - r[0]) * i / n;
      clump(w, 'detail', px, r[3], 0.1, 0.55, 1.2, R, UV.flower);
      clump(w, 'detail', px, r[3], 1.25, 0.5, 1.2, R, UV.flower);
      clump(w, 'detail', px, r[3], 2.35, 0.65, 0.8, R, UV.flower);
    }
  }
  // lawn: grass tufts (three cards in a star each) on a jittered grid, clear of paving and furniture
  const blocked = (x, y) => avoid.some(a => x > a[0] && x < a[2] && y > a[1] && y < a[3]) || circles.some(([cx, cy, cr]) => Math.hypot(x - cx, y - cy) < cr);
  const G = rng(hash(grassSeed)), tufts = [];
  const STEP = 0.62;
  for (const L of lawns)
    for (let y = L[1] + 0.4; y < L[3] - 0.3; y += STEP) for (let x = L[0] + 0.4; x < L[2] - 0.4; x += STEP) {
      const tx = x + (G() - 0.5) * STEP * 0.8, ty = y + (G() - 0.5) * STEP * 0.8;
      const a = G() * Math.PI, sz = 0.36 + G() * 0.22, hh = sz * (0.45 + G() * 0.12);
      if (!blocked(tx, ty)) tufts.push([tx, ty, a, sz, hh, 0.95 + G() * 0.2]);
    }
  // interleave: even tufts first, then odd (phones draw only the first half)
  const order = [...tufts.filter((_, i) => i % 2 === 0), ...tufts.filter((_, i) => i % 2 === 1)];
  const half = order.length - tufts.filter((_, i) => i % 2 === 1).length;
  const up = () => V3(0, 1, 0);
  for (const [tx, ty, a, sz, hh, g] of order) for (const da of [0, Math.PI / 3, 2 * Math.PI / 3]) {
    const U = V3(Math.cos(a + da), 0, Math.sin(a + da)).multiplyScalar(sz / 2);
    card(w, 'grass', W(tx, ty, hh / 2 - 0.01), U, V3(0, hh / 2, 0), UV.grass, up, [0.95 * g, 1.0 * g, 0.85 * g]);
  }
  if (!w.lists.core.length && !w.lists.detail.length && !w.lists.grass.length) return null;
  const geo = w.build();
  geo.userData.ranges.grassHalf = geo.userData.ranges.detail + half * 18; // 3 cards × 2 triangles per tuft
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return gardenMesh(geo, name);
}

// ---------------------------------------------------------------- material + draw-range LOD
let shared = null;
function gardenMaterial() {
  if (shared) return shared;
  const px = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  px.colorSpace = THREE.SRGBColorSpace; px.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ map: px, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, roughness: 0.78, metalness: 0 });
  m.name = 'gardenFoliage';
  // the vertex normals already point out of the crown: do not flip them on back faces
  // (the chunk is still an #include when onBeforeCompile runs: swap in an edited copy)
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;'));
  };
  m.customProgramCacheKey = () => 'gardenFoliage2';
  m.userData.state = { loaded: false, loading: false };
  shared = m;
  return m;
}
function loadAtlas(renderer, m) {
  const st = m.userData.state;
  if (st.loading || typeof document === 'undefined') return;
  st.loading = true;
  const lite = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  st.lite = lite;
  const base = (import.meta.env?.BASE_URL ?? '/') + 'garden/';
  new THREE.TextureLoader().load(base + (lite ? 'foliage-512.webp' : 'foliage.webp'), (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(lite ? 2 : 8, renderer.capabilities.getMaxAnisotropy());
    m.map = t; st.loaded = true; // same map slot as the placeholder: no shader rebuild
  }, undefined, (e) => console.warn('[garden] atlas failed to load; the gardens keep no photo plants', e?.message || e));
}
const _c = new THREE.Vector3();
function rangeFor(geo, camera, shadow, lite) {
  const r = geo.userData.ranges, b = geo.boundingBox;
  camera.getWorldPosition(_c);
  const dx = Math.max(b.min.x - _c.x, 0, _c.x - b.max.x), dz = Math.max(b.min.z - _c.z, 0, _c.z - b.max.z);
  const d = Math.hypot(dx, dz);
  if (d > (lite ? DETAIL_REACH_LITE : DETAIL_REACH)) return r.core;
  if (shadow || d > GRASS_REACH) return r.detail;
  return lite ? r.grassHalf : r.all;
}
function gardenMesh(geo, name = 'garden') {
  const m = gardenMaterial();
  const mesh = new THREE.Mesh(geo, m);
  mesh.name = name;
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.group = 'site';
  geo.drawRange.count = -1; // nothing until the atlas is in
  mesh.onBeforeRender = (renderer, scene, camera, g, material) => {
    const st = m.userData.state;
    if (!st.loading) loadAtlas(renderer, m);
    // override materials (the GTAO normal pass) would draw the cards as opaque squares: skip
    g.drawRange.count = st.loaded && material === m ? rangeFor(g, camera, false, st.lite) : -1;
  };
  mesh.onBeforeShadow = (renderer, object, camera, shadowCamera, g) => {
    g.drawRange.count = m.userData.state.loaded ? rangeFor(g, camera, true, m.userData.state.lite) : -1;
  };
  return mesh;
}
