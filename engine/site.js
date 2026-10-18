// The plot: ground, road, perimeter walls, and every site item of zoning.js `site.items`
// (data-driven, all optional): lawn, paving / terrace, path, driveway, parking, carport, pool,
// court, pergola, garden beds, trees, walls, fences, hedges, gates, small buildings, ponds.
//
//   siteHoles(Z, STAIRS, LIFT, LIFT_STOPS) → { id: rect }   plan rects without garden ground
//   buildSiteShell({ Z, add, solid, physics, holes, roofMat, extWall, fancy }) → { trees }
// The photo vegetation (shrubs, hedges, grass tufts, tree crowns), lanterns and lights are added by
// engine/exterior.js; the moving gate leaves by engine/doors.js.
import * as THREE from 'three';
import { GROUND, isBasement } from './config.js';
import { subtract, box, plane, hipRoof, rng, hash } from './geom.js';

export const ROAD_W = 7;
const KIND_MAT = { paving: 'pavers', terrace: 'paversWarm', path: 'gravel', driveway: 'concrete', parking: 'asphalt', court: 'concretePolished' };

export function siteHoles(Z, STAIRS, LIFT, LIFT_STOPS) {
  const out = {};
  for (const it of Z.site.items) if ((it.kind === 'pool' || it.kind === 'water') && Array.isArray(it.r)) out[it.id || 'pool' + Object.keys(out).length] = it.r;
  for (const s of STAIRS) if (s.to === GROUND && isBasement(s.from)) out['stair:' + s.id] = s.r;
  if (LIFT && LIFT_STOPS.some(isBasement)) out.lift = LIFT.r;
  return out;
}

// The plot edges, named by the road side: front (on the road), back, and the two sides
export function plotEdges(site) {
  const { w, d } = site;
  const E = { s: [[0, 0], [w, 0]], n: [[0, d], [w, d]], w: [[0, 0], [0, d]], e: [[w, 0], [w, d]] };
  const opp = { s: 'n', n: 's', e: 'w', w: 'e' }[site.road] || 'n';
  const sides = ['n', 's', 'e', 'w'].filter(k => k !== site.road && k !== opp);
  return [{ key: site.road, role: 'front', seg: E[site.road] }, { key: opp, role: 'back', seg: E[opp] }, ...sides.map(k => ({ key: k, role: 'sides', seg: E[k] }))];
}

export function buildSiteShell({ Z, add, solid, physics, holes, roofMat = 'terracotta', extWall = 'plasterExt', fancy = false }) {
  const site = Z.site, W = site.w, D = site.d;
  const items = site.items;
  const trees = [];
  const ground = Z.floors[GROUND] || [];
  const houseRects = ground.map(r => r.r);

  // ------------------------------------------------ ground, surroundings, road
  {
    const shape = new THREE.Shape([[0, 0], [W, 0], [W, D], [0, D]].map(p => new THREE.Vector2(...p)));
    for (const h of holes)
      shape.holes.push(new THREE.Path([[h[0], h[1]], [h[0], h[3]], [h[2], h[3]], [h[2], h[1]]].map(p => new THREE.Vector2(...p))));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    add('ground', 'grass', g);
    const M = 250;
    const outer = new THREE.Shape([[-M, -M], [W + M, -M], [W + M, D + M], [-M, D + M]].map(p => new THREE.Vector2(...p)));
    outer.holes.push(new THREE.Path([[0, 0], [0, D], [W, D], [W, 0]].map(p => new THREE.Vector2(...p))));
    const og = new THREE.ShapeGeometry(outer);
    og.rotateX(-Math.PI / 2);
    og.translate(0, -0.02, 0);
    add('ground', 'grassFar', og);
    const road = { s: [-M, -ROAD_W, W + M, 0], n: [-M, D, W + M, D + ROAD_W], w: [-ROAD_W, -M, 0, D + M], e: [W, -M, W + ROAD_W, D + M] }[site.road] || [-M, -ROAD_W, W + M, 0];
    add('ground', 'asphalt', plane(road, 0.01));
    physics.addGlobalFlat([-M, -M, W + M, D + M], 0, holes);
  }

  // Flat outdoor surfaces (each a hair above the last so overlaps don't flicker)
  let lift = 0;
  const flat = (r, mat) => {
    lift += 0.0012;
    for (const p of subtract(r, holes)) add('site', mat, plane(p, 0.01 + lift));
  };
  const line = (from, to, t, z0, z1, mat, collide = true) => {
    const [ax, ay] = from, [bx, by] = to;
    if (ax === bx) solid('site', mat, ax - t / 2, Math.min(ay, by), ax + t / 2, Math.max(ay, by), z0, z1, collide);
    else solid('site', mat, Math.min(ax, bx), ay - t / 2, Math.max(ax, bx), ay + t / 2, z0, z1, collide);
  };
  const onHouseEdge = (x, y) => houseRects.some(r => (Math.abs(x - r[0]) < 0.35 || Math.abs(x - r[2]) < 0.35) && y >= r[1] - 0.35 && y <= r[3] + 0.35
    || (Math.abs(y - r[1]) < 0.35 || Math.abs(y - r[3]) < 0.35) && x >= r[0] - 0.35 && x <= r[2] + 0.35);

  for (const it of items) {
    const r = it.r;
    switch (it.kind) {
      case 'lawn': break; // grass everywhere already; the exterior adds tufts
      case 'paving': case 'terrace': case 'path': case 'driveway':
        flat(r, it.material || KIND_MAT[it.kind]);
        break;
      case 'parking': {
        flat(r, it.material || 'asphalt');
        const along = r[2] - r[0] >= r[3] - r[1];
        const len = along ? r[2] - r[0] : r[3] - r[1];
        const bay = it.bay || 2.5, n = Math.max(1, Math.round(len / bay));
        for (let i = 0; i <= n; i++) {
          const a = (along ? r[0] : r[1]) + len * i / n;
          if (along) add('site', 'paint', box(a - 0.05, r[1] + 0.2, a + 0.05, r[3] - 0.2, 0.01, 0.034));
          else add('site', 'paint', box(r[0] + 0.2, a - 0.05, r[2] - 0.2, a + 0.05, 0.01, 0.034));
        }
        break;
      }
      case 'carport': {
        flat(r, it.material || 'concrete');
        const H = it.h ?? 2.6, p = 0.075;
        // posts at the corners not against the house (there the roof beam sits on the wall)
        for (const [x, y] of [[r[0] + p, r[1] + p], [r[2] - p, r[1] + p], [r[0] + p, r[3] - p], [r[2] - p, r[3] - p]]) {
          if (onHouseEdge(x, y)) continue;
          solid('site', 'steelDark', x - p, y - p, x + p, y + p, 0, H);
        }
        if (it.roof === 'hip') add('site', roofMat, hipRoof(r, H + 0.2, 0.35, 0.3));
        else {
          add('site', 'steelDark', box(r[0] - 0.05, r[1] - 0.05, r[2] + 0.05, r[3] + 0.05, H, H + 0.2));            // edge beam / fascia
          add('site', it.roofMaterial || 'roofMetal', plane([r[0] - 0.05, r[1] - 0.05, r[2] + 0.05, r[3] + 0.05], H + 0.205));
          add('site', 'soffit', plane([r[0] - 0.05, r[1] - 0.05, r[2] + 0.05, r[3] + 0.05], H - 0.005, false));
        }
        break;
      }
      case 'pool': {
        const D0 = -(it.depth ?? 1.4);
        add('site', 'poolTile', plane(r, D0));
        add('site', 'poolTile', box(r[0], r[1], r[0] + 0.1, r[3], D0, 0));
        add('site', 'poolTile', box(r[2] - 0.1, r[1], r[2], r[3], D0, 0));
        add('site', 'poolTile', box(r[0], r[1], r[2], r[1] + 0.1, D0, 0));
        add('site', 'poolTile', box(r[0], r[3] - 0.1, r[2], r[3], D0, 0));
        add('site', 'water', plane(r, -0.15));
        const c = 0.35;   // coping
        add('site', 'pavers', box(r[0] - c, r[1] - c, r[2] + c, r[1], 0, 0.06));
        add('site', 'pavers', box(r[0] - c, r[3], r[2] + c, r[3] + c, 0, 0.06));
        add('site', 'pavers', box(r[0] - c, r[1], r[0], r[3], 0, 0.06));
        add('site', 'pavers', box(r[2], r[1], r[2] + c, r[3], 0, 0.06));
        // nobody falls in: the water's edge stops a walker
        physics.addCollider(r[0], r[1], r[2], r[1] + 0.05, D0 - 0.1, 0.6);
        physics.addCollider(r[0], r[3] - 0.05, r[2], r[3], D0 - 0.1, 0.6);
        physics.addCollider(r[0], r[1], r[0] + 0.05, r[3], D0 - 0.1, 0.6);
        physics.addCollider(r[2] - 0.05, r[1], r[2], r[3], D0 - 0.1, 0.6);
        break;
      }
      case 'water': {   // shallow decorative pond
        add('site', 'stone', box(r[0], r[1], r[2], r[3], -0.5, -0.45));
        add('site', 'water', plane(r, -0.08));
        add('site', 'stone', box(r[0] - 0.25, r[1] - 0.25, r[2] + 0.25, r[1], 0, 0.3));
        add('site', 'stone', box(r[0] - 0.25, r[3], r[2] + 0.25, r[3] + 0.25, 0, 0.3));
        add('site', 'stone', box(r[0] - 0.25, r[1], r[0], r[3], 0, 0.3));
        add('site', 'stone', box(r[2], r[1], r[2] + 0.25, r[3], 0, 0.3));
        physics.addCollider(r[0], r[1], r[2], r[3], -0.6, 0.3);
        break;
      }
      case 'court': {
        flat(r, it.material || KIND_MAT.court);
        const t = 0.05, z = 0.04;
        add('site', 'paint', box(r[0] + 0.3, r[1] + 0.3, r[2] - 0.3, r[1] + 0.3 + t, z, z + 0.004));
        add('site', 'paint', box(r[0] + 0.3, r[3] - 0.3 - t, r[2] - 0.3, r[3] - 0.3, z, z + 0.004));
        add('site', 'paint', box(r[0] + 0.3, r[1] + 0.3, r[0] + 0.3 + t, r[3] - 0.3, z, z + 0.004));
        add('site', 'paint', box(r[2] - 0.3 - t, r[1] + 0.3, r[2] - 0.3, r[3] - 0.3, z, z + 0.004));
        const my = (r[1] + r[3]) / 2;
        add('site', 'paint', box(r[0] + 0.3, my - t / 2, r[2] - 0.3, my + t / 2, z, z + 0.004));
        break;
      }
      case 'pergola': {
        const H = it.h ?? 2.8;
        const nx = Math.max(1, Math.round((r[2] - r[0]) / 3));
        for (let i = 0; i <= nx; i++) {
          const x = r[0] + 0.1 + (r[2] - r[0] - 0.2) * i / nx;
          for (const y of [r[1] + 0.1, r[3] - 0.1]) {
            if (onHouseEdge(x, y)) continue;
            solid('site', 'woodDark', x - 0.09, y - 0.09, x + 0.09, y + 0.09, 0, H);
          }
        }
        // no overhang where the pergola meets the house
        const oS = onHouseEdge((r[0] + r[2]) / 2, r[1]) ? 0 : 0.25, oN = onHouseEdge((r[0] + r[2]) / 2, r[3]) ? 0 : 0.25;
        const oW = onHouseEdge(r[0], (r[1] + r[3]) / 2) ? 0 : 0.2, oE = onHouseEdge(r[2], (r[1] + r[3]) / 2) ? 0 : 0.2;
        add('site', 'woodDark', box(r[0] - oW, r[1], r[2] + oE, r[1] + 0.2, H, H + 0.25));
        add('site', 'woodDark', box(r[0] - oW, r[3] - 0.2, r[2] + oE, r[3], H, H + 0.25));
        for (let x = r[0] + 0.1; x <= r[2] - 0.05; x += 0.6) add('site', 'woodDark', box(x - 0.04, r[1] - oS, x + 0.04, r[3] + oN, H + 0.25, H + 0.45));
        break;
      }
      case 'garden': {
        // a raised planting bed: soil + low edging (the exterior plants it)
        add('site', 'soil', plane([r[0] + 0.06, r[1] + 0.06, r[2] - 0.06, r[3] - 0.06], 0.06));
        add('site', 'stone', box(r[0], r[1], r[2], r[1] + 0.06, 0, 0.12));
        add('site', 'stone', box(r[0], r[3] - 0.06, r[2], r[3], 0, 0.12));
        add('site', 'stone', box(r[0], r[1] + 0.06, r[0] + 0.06, r[3] - 0.06, 0, 0.12));
        add('site', 'stone', box(r[2] - 0.06, r[1] + 0.06, r[2], r[3] - 0.06, 0, 0.12));
        physics.addCollider(r[0], r[1], r[2], r[3], 0, 0.6);
        break;
      }
      case 'trees': scatterTrees(it); break;
      case 'tree': trees.push({ x: it.c[0], y: it.c[1], s: it.c[2] ?? 1, species: it.species || 'shade' }); break;
      case 'wall': line(it.from, it.to, it.t ?? 0.2, 0, it.h ?? 1.8, it.material || extWall); break;
      case 'fence': fence(it.from, it.to, it.h ?? 1.6); break;
      case 'hedge': {
        const t = it.t ?? 0.7, H = it.h ?? 1.4;
        line(it.from, it.to, t, 0, H, 'leaves', true);
        break;
      }
      case 'gate': {
        // posts at both ends; the leaf is engine/doors.js (closed at start, opens for walkers and cars)
        for (const p of [it.from, it.to]) solid('site', it.type === 'sliding' ? 'steelDark' : extWall, p[0] - 0.15, p[1] - 0.15, p[0] + 0.15, p[1] + 0.15, 0, (it.h ?? 1.8) + 0.2);
        break;
      }
      case 'building': {
        const H = it.h ?? 2.8;
        solid('site', extWall, r[0], r[1], r[2], r[3], 0, H);
        add('site', it.roofMaterial || roofMat, hipRoof(r, H, 0.4, 0.4));
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------ perimeter: wall / fence / hedge per side, gaps at gates
  const P = site.perimeter || {};
  const gates = items.filter(it => it.kind === 'gate');
  for (const { role, seg } of plotEdges(site)) {
    const kind = P[role] ?? 'wall';
    if (!kind || kind === 'none') continue;
    const H = role === 'front' ? (P.frontH ?? P.h ?? 1.8) : (P.h ?? 1.8);
    const [[ax, ay], [bx, by]] = seg;
    const h = ay === by;
    let spans = [[h ? ax : ay, h ? bx : by]];
    for (const g of gates) {
      const on = h ? Math.abs(g.from[1] - ay) < 0.3 && Math.abs(g.to[1] - ay) < 0.3 : Math.abs(g.from[0] - ax) < 0.3 && Math.abs(g.to[0] - ax) < 0.3;
      if (!on) continue;
      const p = Math.min(h ? g.from[0] : g.from[1], h ? g.to[0] : g.to[1]), q = Math.max(h ? g.from[0] : g.from[1], h ? g.to[0] : g.to[1]);
      spans = spans.flatMap(([u, v]) => (q <= u || p >= v ? [[u, v]] : [[u, p - 0.15], [q + 0.15, v]].filter(([m, n]) => n - m > 0.05)));
    }
    // walls sit just inside the plot line
    const at = h ? (ay === 0 ? 0.1 : ay - 0.1) : (ax === 0 ? 0.1 : ax - 0.1);
    for (const [u, v] of spans) {
      const from = h ? [u, at] : [at, u], to = h ? [v, at] : [at, v];
      if (kind === 'fence') fence(from, to, H);
      else if (kind === 'hedge') line(from, to, 0.7, 0, H, 'leaves', true);
      else line(from, to, 0.2, 0, H, P.material || extWall);
    }
  }

  function fence(from, to, H) {
    const [x0, y0] = from, [x1, y1] = to;
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let s = 0; s <= len + 1e-6; s += Math.min(2.5, len)) {
      const x = x0 + (x1 - x0) * s / len, y = y0 + (y1 - y0) * s / len;
      add('site', 'railing', box(x - 0.04, y - 0.04, x + 0.04, y + 0.04, 0, H));
    }
    const r = x0 === x1 ? [x0 - 0.02, Math.min(y0, y1), x0 + 0.02, Math.max(y0, y1)] : [Math.min(x0, x1), y0 - 0.02, Math.max(x0, x1), y0 + 0.02];
    solid('site', 'net', r[0], r[1], r[2], r[3], 0, H);
    add('site', 'railing', box(r[0] - 0.01, r[1] - 0.01, r[2] + 0.01, r[3] + 0.01, H - 0.05, H));
  }

  function scatterTrees(it) {
    const spacing = it.spacing ?? 4, sMin = it.scale?.[0] ?? 0.85, sMax = it.scale?.[1] ?? 1.25;
    const rand = rng(hash(it.id || 'trees'));
    const m = 1.2 * sMax;
    const r = [it.r[0] + m, it.r[1] + m, it.r[2] - m, it.r[3] - m];
    if (r[2] <= r[0]) { r[0] = r[2] = (it.r[0] + it.r[2]) / 2; }
    if (r[3] <= r[1]) { r[1] = r[3] = (it.r[1] + it.r[3]) / 2; }
    const avoid = [...houseRects, ...items.filter(o => ['path', 'driveway', 'building', 'carport', 'pool', 'paving', 'terrace', 'court', 'parking'].includes(o.kind) && o.r).map(o => o.r)];
    for (let x = r[0]; x <= r[2] + 1e-6; x += spacing)
      for (let y = r[1]; y <= r[3] + 1e-6; y += spacing) {
        const tx = Math.min(r[2], Math.max(r[0], x + (rand() - 0.5) * spacing * 0.5));
        const ty = Math.min(r[3], Math.max(r[1], y + (rand() - 0.5) * spacing * 0.5));
        if (holes.some(h => tx > h[0] - 1 && tx < h[2] + 1 && ty > h[1] - 1 && ty < h[3] + 1)) continue;
        if (avoid.some(h => tx > h[0] - 1.2 && tx < h[2] + 1.2 && ty > h[1] - 1.2 && ty < h[3] + 1.2)) continue;
        trees.push({ x: tx, y: ty, s: sMin + rand() * (sMax - sMin), species: it.species || 'shade' });
      }
  }

  return { trees };
}

// Everything the visitor can stand on outside the house at grade (for "where am I" labels)
export function siteItemAt(Z, x, y) {
  const inR = (r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  const list = Z.site.items.filter(o => o.r && inR(o.r))
    .sort((a, b) => (a.r[2] - a.r[0]) * (a.r[3] - a.r[1]) - (b.r[2] - b.r[0]) * (b.r[3] - b.r[1]));
  return list[0] || null;
}
