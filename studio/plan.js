// 2D plan of the active house (studio/plan.html): the same data the 3D view is built from.
// Tabs: the site, then every level (top first). Rooms coloured by zone with name + area, walls from
// the 0.5 m lattice (exterior 30 cm, interior 15 cm, open-plan dashed), doors with their swing,
// sliding / folding / garage symbols, windows, stairs (treads + an arrow pointing up), the lift,
// balconies, furniture footprints, roof outlines, a 1 m grid with axis labels every 5 m (x → east,
// y → north: the coordinates the data uses), north arrow and scale bar.
//
// URL: ?level=<id|site>&furniture=0|1&grid=0|1&roofs=0|1&lang=id|en — and window.__plan
// ({ ready, levels, setLevel(id) }) for screenshot tools.
import { Z, PROJECT, INTERIOR } from '../engine/data.js';
import { LEVELS, LEVEL_ORDER, STAIRS, LIFT, GROUND } from '../engine/config.js';
import { t, tr, getLang, setLang, applyI18n, LANGS } from '../engine/i18n.js';
import { wallRuns } from '../engine/geom.js';
import { furnitureInfo } from '../engine/interior/furniture/index.js';
import { footprintParts } from '../engine/interior/footprints.js';
import { plotEdges } from '../engine/site.js';

const NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const svg = $('plan'), tip = $('tip'), stage = $('stage');
const INK = '#3a3028', THRESH = '#fbf8f2';
const WALL = { ext: 0.3, int: 0.15 };
const site = Z.site;
const FRAME = [-3, -9, site.w + 6, site.d + 12];   // [xmin, ymin, width, height], y north
const FS = Math.max(0.5, Math.min(1.1, Math.max(site.w, site.d) / 32));
const params = new URLSearchParams(location.search);
const flag = (k, d) => (params.has(k) ? params.get(k) !== '0' : d);

let level = GROUND, selected = null, vb = null;
let showFurn = flag('furniture', true), showGrid = flag('grid', true), showRoofs = flag('roofs', false);

const loc = getLang() === 'id' ? 'id-ID' : 'en-GB';
const area = r => (r[2] - r[0]) * (r[3] - r[1]);
const fmt = (n, d = 0) => Number(n).toLocaleString(loc, { maximumFractionDigits: d, minimumFractionDigits: d });
const zoneOf = it => Z.zones[it.zone] || { label: it.zone, color: '#ddd' };
const P = p => `${p[0]},${-p[1]}`;

// ---------------------------------------------------------------- svg helpers (plan coords in, y flipped)
function el(tag, attrs = {}, parent = svg) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent.appendChild(e);
  return e;
}
const rect = (r, a, p) => el('rect', { x: r[0], y: -r[3], width: r[2] - r[0], height: r[3] - r[1], ...a }, p);
const circle = (c, a, p) => el('circle', { cx: c[0], cy: -c[1], r: c[2], ...a }, p);
const line = (a, b, at, p) => el('line', { x1: a[0], y1: -a[1], x2: b[0], y2: -b[1], ...at }, p);
const poly = (pts, a, p) => el('polyline', { points: pts.map(P).join(' '), fill: 'none', ...a }, p);
function text(x, y, s, a, p) { const e = el('text', { x, y: -y, ...a }, p); e.textContent = s; return e; }

function wrap(str, max) {
  const lines = []; let cur = '';
  for (const w of String(str).split(' ')) {
    if (!cur) cur = w; else if ((cur + ' ' + w).length <= max) cur += ' ' + w; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
// A centred label (title + optional sub) fitted inside rect r
function label(r, title, sub, base, parent, halo = true) {
  const w = r[2] - r[0], h = r[3] - r[1];
  let fs = base, lines;
  for (let i = 0; i < 8; i++) {
    lines = wrap(title, Math.max(2, Math.floor((w * 0.9) / (fs * 0.56))));
    const tooWide = lines.some(l => l.length * fs * 0.56 > w * 0.94);
    const totalH = lines.length * fs * 1.15 + (sub ? fs * 0.95 : 0);
    if (!tooWide && totalH <= h * 0.9) break;
    fs *= 0.85;
  }
  if (fs < base * 0.35) return;
  const cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2;
  const totalH = lines.length * fs * 1.15 + (sub ? fs * 0.95 : 0);
  const tx = el('text', { class: 'lbl' + (halo ? ' halo' : ''), 'font-size': fs, 'stroke-width': fs * 0.28 }, parent);
  const y = -cy - totalH / 2 + fs * 0.9;
  lines.forEach((l, i) => { const s = el('tspan', { x: cx, y: y + i * fs * 1.15, 'font-weight': 600 }, tx); s.textContent = l; });
  if (sub) { const s = el('tspan', { x: cx, y: y + lines.length * fs * 1.15 - fs * 0.1, class: 'a', 'font-size': fs * 0.78 }, tx); s.textContent = sub; }
}

function defs() {
  const d = el('defs');
  const pat = (id, s, draw) => draw(el('pattern', { id, width: s, height: s, patternUnits: 'userSpaceOnUse' }, d), s);
  pat('paving', 0.6, (p, s) => { el('rect', { width: s, height: s, fill: '#ebe1cf' }, p); el('path', { d: `M0,0 H${s} M0,0 V${s}`, stroke: '#d9cbb2', 'stroke-width': 0.03 }, p); });
  pat('deck', 0.3, (p, s) => { el('rect', { width: s, height: s, fill: '#e3cfae' }, p); el('path', { d: `M0,0 H${s}`, stroke: '#c9ad85', 'stroke-width': 0.03 }, p); });
  pat('gravel', 0.4, (p, s) => { el('rect', { width: s, height: s, fill: '#e8e0d0' }, p); el('circle', { cx: s / 3, cy: s / 3, r: 0.04, fill: '#c8bba4' }, p); el('circle', { cx: s * 0.8, cy: s * 0.75, r: 0.03, fill: '#c8bba4' }, p); });
  pat('parking', 2.5, (p, s) => { el('rect', { width: s, height: s, fill: '#d9d4cb' }, p); el('path', { d: `M0,0 V${s}`, stroke: '#fff', 'stroke-width': 0.1 }, p); });
  pat('bed', 0.5, (p, s) => { el('rect', { width: s, height: s, fill: '#bcd59c' }, p); el('circle', { cx: s / 2, cy: s / 2, r: 0.12, fill: '#93b46e' }, p); });
  pat('void', 0.5, (p, s) => { el('rect', { width: s, height: s, fill: '#5b5047', opacity: 0.18 }, p); el('path', { d: `M0,${s} L${s},0`, stroke: INK, 'stroke-width': 0.03, opacity: 0.5 }, p); });
  const mk = el('marker', { id: 'arrowInk', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 4, markerHeight: 4, orient: 'auto' }, d);
  el('path', { d: 'M0,0 L10,5 L0,10 z', fill: INK }, mk);
}

// ---------------------------------------------------------------- site
const SITE_FILL = { lawn: '#d9e8c4', paving: 'url(#paving)', terrace: 'url(#deck)', path: 'url(#gravel)', driveway: '#dcd7ce', parking: 'url(#parking)',
  carport: '#cfcac2', pool: '#a6d0de', water: '#a6d0de', court: '#c9d8b5', pergola: 'none', garden: 'url(#bed)', trees: 'none', building: '#d8cbb8' };
function drawSite(withLabels) {
  const g = el('g', { class: 'site' });
  rect([0, 0, site.w, site.d], { fill: '#e9efd9' }, g);
  // big soft areas first, hard surfaces and water on top
  const RANK = { lawn: 0, garden: 1, trees: 2, driveway: 3, parking: 3, paving: 4, path: 5, terrace: 5, court: 5, carport: 6, pool: 7, water: 7, pergola: 8, building: 8 };
  for (const it of [...site.items].sort((a, b) => (RANK[a.kind] ?? 9) - (RANK[b.kind] ?? 9))) {
    if (it.r && SITE_FILL[it.kind] !== undefined) {
      const s = el('g', {}, g);
      rect(it.r, { fill: SITE_FILL[it.kind], stroke: it.kind === 'carport' ? '#8a8277' : 'none', 'stroke-width': 0.05, 'stroke-dasharray': it.kind === 'carport' ? '.3 .2' : 'none' }, s);
      if (it.kind === 'pool') rect(it.r, { fill: 'none', stroke: '#6fa9bd', 'stroke-width': 0.12 }, s);
      if (it.kind === 'pergola') for (let x = it.r[0]; x <= it.r[2] + 1e-6; x += 0.6) line([x, it.r[1]], [x, it.r[3]], { stroke: '#7a5236', 'stroke-width': 0.05 }, s);
      if (it.kind === 'trees') rect(it.r, { fill: 'none', stroke: '#7b9c5c', 'stroke-width': 0.05, 'stroke-dasharray': '.4 .3' }, s);
      if (it.names || it.kind === 'pool') bindTip(s, it, false);
      if (withLabels && it.names && area(it.r) > 6) label(it.r, it.name, null, FS * 0.7, g);
    } else if (it.kind === 'tree' && it.c) {
      const r = 1.6 * (it.c[2] ?? 1);
      circle([it.c[0], it.c[1], r], { fill: '#8fb36b', 'fill-opacity': 0.55, stroke: '#5e8340', 'stroke-width': 0.05 }, g);
      circle([it.c[0], it.c[1], 0.15], { fill: '#6b5440' }, g);
    } else if (['wall', 'fence', 'hedge'].includes(it.kind) && it.from) {
      const st = { wall: ['#7a5a3e', 0.25, 'none'], fence: ['#5a5a5a', 0.08, '.3 .15'], hedge: ['#6f9a4c', it.t ?? 0.7, 'none'] }[it.kind];
      line(it.from, it.to, { stroke: st[0], 'stroke-width': st[1], 'stroke-dasharray': st[2], 'stroke-linecap': 'round', opacity: it.kind === 'hedge' ? 0.7 : 1 }, g);
    } else if (it.kind === 'gate' && it.from) {
      line(it.from, it.to, { stroke: '#b5532f', 'stroke-width': 0.18, 'stroke-dasharray': '.35 .2' }, g);
    }
  }
  // scattered trees: a few circles hint the canopy
  for (const it of site.items.filter(i => i.kind === 'trees' && i.r)) {
    const sp = it.spacing ?? 4;
    for (let x = it.r[0] + sp / 2; x < it.r[2]; x += sp) for (let y = it.r[1] + sp / 2; y < it.r[3]; y += sp)
      circle([x, y, Math.min(1.7, sp * 0.4)], { fill: '#8fb36b', 'fill-opacity': 0.45, stroke: '#5e8340', 'stroke-width': 0.04 }, g);
  }
  // perimeter (minus the gates)
  const Pm = site.perimeter || {};
  const gates = site.items.filter(i => i.kind === 'gate' && i.from);
  for (const { role, seg } of plotEdges(site)) {
    const kind = Pm[role] ?? 'wall';
    if (!kind || kind === 'none') continue;
    const [[ax, ay], [bx, by]] = seg, h = ay === by;
    let spans = [[h ? ax : ay, h ? bx : by]];
    for (const gt of gates) {
      const on = h ? Math.abs(gt.from[1] - ay) < 0.3 && Math.abs(gt.to[1] - ay) < 0.3 : Math.abs(gt.from[0] - ax) < 0.3 && Math.abs(gt.to[0] - ax) < 0.3;
      if (!on) continue;
      const p = Math.min(h ? gt.from[0] : gt.from[1], h ? gt.to[0] : gt.to[1]), q = Math.max(h ? gt.from[0] : gt.from[1], h ? gt.to[0] : gt.to[1]);
      spans = spans.flatMap(([u, v]) => (q <= u || p >= v ? [[u, v]] : [[u, p - 0.15], [q + 0.15, v]].filter(([m, n]) => n - m > 0.05)));
    }
    const col = kind === 'hedge' ? '#6f9a4c' : kind === 'fence' ? '#5a5a5a' : '#7a5a3e';
    for (const [u, v] of spans) line(h ? [u, ay] : [ax, u], h ? [v, ay] : [ax, v], { stroke: col, 'stroke-width': kind === 'hedge' ? 0.6 : kind === 'fence' ? 0.08 : 0.2, 'stroke-dasharray': kind === 'fence' ? '.3 .15' : 'none' }, g);
  }
}

// ---------------------------------------------------------------- rooms, walls, openings
function drawRoom(it) {
  const g = el('g', { class: 'room' });
  rect(it.r, { fill: zoneOf(it).color }, g);
  bindTip(g, it, true);
}
function walls(rooms, openPairs) {
  const g = el('g', { class: 'nopt' });
  const runs = wallRuns(rooms, openPairs);
  // open-plan edges (wallRuns leaves them out): a dashed line on the shared edge
  for (const [a, b] of openPairs || []) {
    const A = rooms.find(r => r.id === a), B = rooms.find(r => r.id === b);
    if (!A || !B) continue;
    const [ax0, ay0, ax1, ay1] = A.r, [bx0, by0, bx1, by1] = B.r;
    for (const x of [ax0, ax1]) if (x === bx0 || x === bx1) { const y0 = Math.max(ay0, by0), y1 = Math.min(ay1, by1); if (y1 > y0) line([x, y0], [x, y1], { stroke: INK, 'stroke-width': 0.04, 'stroke-dasharray': '.25 .25', opacity: 0.6 }, g); }
    for (const y of [ay0, ay1]) if (y === by0 || y === by1) { const x0 = Math.max(ax0, bx0), x1 = Math.min(ax1, bx1); if (x1 > x0) line([x0, y], [x1, y], { stroke: INK, 'stroke-width': 0.04, 'stroke-dasharray': '.25 .25', opacity: 0.6 }, g); }
  }
  for (const cls of ['int', 'ext']) for (const r of runs.filter(q => q.cls === cls)) {
    const a = r.o === 'h' ? [r.start, r.fixed] : [r.fixed, r.start], b = r.o === 'h' ? [r.end, r.fixed] : [r.fixed, r.end];
    line(a, b, { stroke: INK, 'stroke-width': WALL[cls], 'stroke-linecap': 'square' }, g);
  }
}
function openings(list) {
  const g = el('g', { class: 'nopt' });
  const add = (p, v, s) => [p[0] + v[0] * s, p[1] + v[1] * s];
  for (const d of list) {
    const h = d.o === 'h';
    const A = [d.x, d.y], B = h ? [d.x + d.w, d.y] : [d.x, d.y + d.w];
    const along = h ? [1, 0] : [0, 1], norm = h ? [0, 1] : [1, 0];
    const m = 0.2;
    rect(h ? [d.x, d.y - m, d.x + d.w, d.y + m] : [d.x - m, d.y, d.x + m, d.y + d.w], { fill: THRESH }, g);
    const jamb = p => line(add(p, norm, -m), add(p, norm, m), { stroke: INK, 'stroke-width': 0.04 }, g);
    jamb(A); jamb(B);
    const swing = (hinge, other, width, side) => {
      const c = [(other[0] - hinge[0]) / width, (other[1] - hinge[1]) / width], n = [norm[0] * side, norm[1] * side];
      line(hinge, add(hinge, n, width), { stroke: INK, 'stroke-width': 0.05 }, g);
      const pts = [];
      for (let i = 0; i <= 16; i++) { const a = (Math.PI / 2) * (1 - i / 16); pts.push([hinge[0] + width * (Math.cos(a) * c[0] + Math.sin(a) * n[0]), hinge[1] + width * (Math.cos(a) * c[1] + Math.sin(a) * n[1])]); }
      poly(pts, { stroke: '#7a6c5f', 'stroke-width': 0.025 }, g);
    };
    switch (d.t) {
      case 'swing': swing(d.hinge === 'e' ? B : A, d.hinge === 'e' ? A : B, d.w, d.side || 1); break;
      case 'double': { const mid = add(A, along, d.w / 2); swing(A, mid, d.w / 2, d.side || 1); swing(B, mid, d.w / 2, d.side || 1); break; }
      case 'sliding': {
        const o = 0.07;
        line(add(A, norm, -o), add(add(A, along, d.w * 0.55), norm, -o), { stroke: INK, 'stroke-width': 0.05 }, g);
        line(add(add(A, along, d.w * 0.45), norm, o), add(B, norm, o), { stroke: INK, 'stroke-width': 0.05 }, g);
        break;
      }
      case 'folding': {
        const k = 6, pts = [];
        for (let i = 0; i <= k; i++) pts.push(add(add(A, along, d.w * i / k), norm, (i % 2) * d.w / k * 0.8 * (d.side || 1)));
        poly(pts, { stroke: INK, 'stroke-width': 0.04 }, g);
        break;
      }
      case 'garage': line(A, B, { stroke: INK, 'stroke-width': 0.05, 'stroke-dasharray': '.3 .2' }, g); break;
      case 'window': case 'glass': case 'high':
        for (const o of [-0.1, 0, 0.1]) line(add(A, norm, o), add(B, norm, o), { stroke: INK, 'stroke-width': o === 0 ? 0.03 : 0.025, 'stroke-dasharray': d.t === 'high' && o === 0 ? '.2 .15' : 'none' }, g);
        break;
      default: break; // 'opening': jambs only
    }
  }
}
function fixtures(list) {
  const g = el('g', { class: 'nopt' });
  const st = { stroke: INK, 'stroke-width': 0.03 };
  for (const f of list) {
    const r = f.r;
    if (f.t === 'partition' && f.from) line(f.from, f.to, { stroke: '#7a5236', 'stroke-width': 0.12, 'stroke-linecap': 'round' }, g);
    else if (f.t === 'plant' && f.c) circle(f.c, { fill: '#8fb36b', ...st }, g);
    else if (r) rect(r, { fill: f.t === 'shower' ? '#eef5f7' : f.t === 'solid' ? '#a59a8c' : '#fff', ...st }, g);
  }
}

// ---------------------------------------------------------------- stairs, lift, balconies, roofs
function stairs(lv) {
  const g = el('g', { class: 'nopt' });
  for (const S of STAIRS) {
    if (S.from === lv) {
      for (const F of S.flights) {
        rect(F.rect, { fill: '#efe7da', stroke: INK, 'stroke-width': 0.03 }, g);
        for (const st of F.steps) rect(st.rect, { fill: 'none', stroke: '#8a7a68', 'stroke-width': 0.015 }, g);
        const mid = (F.t0 + F.t1) / 2;
        line(S.frame.P(F.sStart + Math.sign(F.sEnd - F.sStart) * 0.15, mid), S.frame.P(F.sEnd - Math.sign(F.sEnd - F.sStart) * 0.2, mid), { stroke: INK, 'stroke-width': 0.05, 'marker-end': 'url(#arrowInk)' }, g);
      }
      if (S.landing) rect(S.landing.rect, { fill: '#e6dccb', stroke: INK, 'stroke-width': 0.03 }, g);
      if (S.split) rect(S.split.rect, { fill: INK }, g);
    }
    if (S.to === lv) rect(S.r, { fill: 'url(#void)', stroke: INK, 'stroke-width': 0.04 }, g);
  }
  if (LIFT && Z.lift.stops.includes(lv)) {
    const r = LIFT.r;
    rect(r, { fill: '#cfd3d6', stroke: INK, 'stroke-width': 0.06 }, g);
    line([r[0], r[1]], [r[2], r[3]], { stroke: INK, 'stroke-width': 0.03 }, g);
    line([r[0], r[3]], [r[2], r[1]], { stroke: INK, 'stroke-width': 0.03 }, g);
  }
}
function decks(lv) {
  for (const o of Z.outdoor[lv] || []) {
    if (!o.r) continue;
    const g = el('g', {});
    rect(o.r, { fill: 'url(#deck)', stroke: '#6b5a48', 'stroke-width': 0.06 }, g);
    bindTip(g, o, false);
    label(o.r, o.name, null, FS * 0.6, svg);
  }
}
function roofs() {
  const g = el('g', { class: 'nopt' });
  for (const R of Z.roofs) {
    if (!Array.isArray(R.r)) continue;
    const o = typeof R.over === 'number' ? { w: R.over, s: R.over, e: R.over, n: R.over } : { w: 0, s: 0, e: 0, n: 0, ...R.over };
    const e = [R.r[0] - o.w, R.r[1] - o.s, R.r[2] + o.e, R.r[3] + o.n];
    rect(e, { class: 'roofline' }, g);
    if (R.type === 'hip') {
      const X = e[2] - e[0], Y = e[3] - e[1];
      const [a, b] = X >= Y ? [[e[0] + Y / 2, (e[1] + e[3]) / 2], [e[2] - Y / 2, (e[1] + e[3]) / 2]] : [[(e[0] + e[2]) / 2, e[1] + X / 2], [(e[0] + e[2]) / 2, e[3] - X / 2]];
      const ln = (p, q) => line(p, q, { class: 'roofline' }, g);
      ln(a, b);
      if (X >= Y) { ln([e[0], e[1]], a); ln([e[0], e[3]], a); ln([e[2], e[1]], b); ln([e[2], e[3]], b); }
      else { ln([e[0], e[1]], a); ln([e[2], e[1]], a); ln([e[0], e[3]], b); ln([e[2], e[3]], b); }
    } else if (R.type === 'gable') {
      const alongX = R.ridge ? R.ridge === 'x' : (e[2] - e[0]) >= (e[3] - e[1]);
      if (alongX) line([e[0], (e[1] + e[3]) / 2], [e[2], (e[1] + e[3]) / 2], { class: 'roofline' }, g);
      else line([(e[0] + e[2]) / 2, e[1]], [(e[0] + e[2]) / 2, e[3]], { class: 'roofline' }, g);
    }
  }
}

// ---------------------------------------------------------------- furniture footprints
function furniture(lv) {
  if (!showFurn) return;
  const g = el('g', { class: 'nopt' });
  const soft = el('g', {}, g), solid = el('g', {}, g), ceil = el('g', {}, g);
  const groundLevel = lv === GROUND;
  const entries = [];
  for (const r of Z.floors[lv] || []) if (INTERIOR.rooms[r.id]) entries.push(INTERIOR.rooms[r.id]);
  for (const [id, a] of Object.entries(INTERIOR.areas || {})) {
    const deck = (Z.outdoor[lv] || []).some(o => o.id === id);
    if (deck || (a.level ? a.level === lv : groundLevel)) entries.push(a);
  }
  for (const entry of entries) for (const it of entry.items || []) {
    const info = furnitureInfo(it.type, { ...it, y: it.z });
    if (!info || typeof it.x !== 'number') continue;
    const { w, d, mount } = info;
    if (mount === 'ceiling' || ['tableLamp', 'bankersLamp'].includes(it.type) || (it.type === 'diningTable' && it.round)) {
      circle([it.x, it.y, w / 2], { class: mount === 'ceiling' || it.type !== 'diningTable' ? 'furn-ceil' : 'furn' }, mount === 'ceiling' ? ceil : solid);
      continue;
    }
    const a = (it.rot || 0) * Math.PI / 180;
    const f = [Math.sin(a), Math.cos(a)], u = [Math.cos(a), -Math.sin(a)];
    const c = mount === 'wall' ? [it.x + f[0] * d / 2, it.y + f[1] * d / 2] : [it.x, it.y];
    const parts = mount !== 'wall' && footprintParts(it.type, it, w, d);
    const cls = !info.solid && mount === 'floor' ? 'furn-soft' : mount === 'wall' ? 'furn-wall' : 'furn';
    const toPlan = (x, z) => [it.x - u[0] * x + f[0] * z, it.y - u[1] * x + f[1] * z];
    if (parts) for (const [x0, z0, x1, z1] of parts) el('polygon', { points: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => P(toPlan(x, z))).join(' '), class: cls }, solid);
    else {
      const pt = (su, sf) => [c[0] + u[0] * w / 2 * su + f[0] * d / 2 * sf, c[1] + u[1] * w / 2 * su + f[1] * d / 2 * sf];
      el('polygon', { points: [pt(-1, -1), pt(1, -1), pt(1, 1), pt(-1, 1)].map(P).join(' '), class: cls }, cls === 'furn-soft' ? soft : solid);
      if (cls === 'furn' && w > 0.3 && d > 0.3) line(pt(-0.8, 1), pt(0.8, 1), { class: 'furn-front' }, solid);
    }
  }
}

// ---------------------------------------------------------------- tooltip & selection
let dragMoved = false;
function bindTip(g, it, isRoom) {
  g.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') showTip(e, it, isRoom); });
  g.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') moveTip(e); });
  g.addEventListener('pointerleave', hideTip);
  g.addEventListener('click', () => { if (!dragMoved) select(it, isRoom); });
}
function sizeLine(it, isRoom) {
  if (!it.r) return '';
  const w = it.r[2] - it.r[0], d = it.r[3] - it.r[1];
  return `${fmt(w, 1)} × ${fmt(d, 1)} m · <b>${fmt(area(it.r), 1)} m²</b>${isRoom ? '' : ' ' + t('outdoorArea')}<br><span style="opacity:.75">[${it.r.join(', ')}]</span>`;
}
function showTip(e, it, isRoom) { tip.innerHTML = `<b>${it.name}</b><br>${sizeLine(it, isRoom)}<br><span style="opacity:.75">${tr(zoneOf(it).label)}</span>`; tip.style.display = 'block'; moveTip(e); }
function moveTip(e) {
  const b = stage.getBoundingClientRect();
  let x = e.clientX - b.left + 14; const y = e.clientY - b.top + 14;
  if (x + 270 > b.width) x -= 290;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
function hideTip() { tip.style.display = 'none'; }
function select(it, isRoom) {
  selected = it;
  let h = `<div class="nm">${it.name}${it.id ? ` <span class="muted">(${it.id})</span>` : ''}</div><div>${sizeLine(it, isRoom)}</div><div class="muted">${tr(zoneOf(it).label)}</div>`;
  if (it.note) h += `<div style="margin-top:6px">${it.note}</div>`;
  const fr = isRoom ? INTERIOR.rooms[it.id] : INTERIOR.areas?.[it.id];
  if (fr && fr.items && fr.items.length) {
    const n = {};
    fr.items.forEach(x => { n[x.type] = (n[x.type] || 0) + 1; });
    h += `<div class="furnlist"><b>${t('items')}:</b> ${Object.entries(n).map(([k, c]) => (c > 1 ? `${k} ×${c}` : k)).join(', ')}</div>`;
  }
  $('detail').innerHTML = h;
  drawSelection();
}
function drawSelection() {
  svg.querySelectorAll('.selbox').forEach(n => n.remove());
  if (selected && selected.r) rect(selected.r, { class: 'selbox' });
}

// ---------------------------------------------------------------- grid, compass, scale, labels
function grid() {
  const g = el('g', { class: 'nopt' });
  const [x0, y0, w, h] = FRAME;
  if (showGrid) {
    for (let x = Math.ceil(x0); x <= x0 + w; x++) line([x, y0], [x, y0 + h], { class: x % 5 === 0 ? 'gridm' : 'gridl' }, g);
    for (let y = Math.ceil(y0); y <= y0 + h; y++) line([x0, y], [x0 + w, y], { class: y % 5 === 0 ? 'gridm' : 'gridl' }, g);
  }
  // axis labels every 5 m along the plot's south and west edges
  for (let x = 0; x <= site.w + 1e-6; x += 5) text(x, -1.2 * FS - 0.4, 'x ' + x, { class: 'axis', 'font-size': FS * 0.55, 'text-anchor': 'middle' }, g);
  for (let y = 0; y <= site.d + 1e-6; y += 5) text(-0.4, y - FS * 0.2, 'y ' + y, { class: 'axis', 'font-size': FS * 0.55, 'text-anchor': 'end' }, g);
}
function compass() {
  const g = el('g', { class: 'nopt' });
  const nx = FRAME[0] + FRAME[2] - FS * 1.6, ny = FRAME[1] + FRAME[3] - FS * 2.4;
  el('path', { d: `M${nx},${-(ny + FS * 1.4)} L${nx + FS * 0.6},${-(ny - FS * 0.5)} L${nx},${-(ny - FS * 0.1)} L${nx - FS * 0.6},${-(ny - FS * 0.5)} Z`, fill: INK }, g);
  text(nx, ny - FS * 1.6, getLang() === 'id' ? 'U' : 'N', { class: 'lbl', 'font-size': FS * 0.8, 'font-weight': 700 }, g);
  const L = site.w > 30 ? 10 : 5, x = FRAME[0] + FS, y = FRAME[1] + FS * 1.2;
  line([x, y], [x + L, y], { stroke: INK, 'stroke-width': FS * 0.08 }, g);
  for (const xx of [x, x + L]) line([xx, y - FS * 0.25], [xx, y + FS * 0.25], { stroke: INK, 'stroke-width': FS * 0.08 }, g);
  text(x + L / 2, y + FS * 0.45, L + ' m', { class: 'lbl', 'font-size': FS * 0.55 }, g);
}
function roomLabels() {
  svg.querySelector('#labels')?.remove();
  if (level === 'site') return;
  const k = Math.min(1, Math.max(0.35, Math.pow(vb.w / FRAME[2], 0.75)));
  const g = el('g', { class: 'nopt', id: 'labels' });
  for (const it of (Z.floors[level] || []).filter(r => !r.noLabel)) label(it.r, it.short || it.name, fmt(area(it.r), 1) + ' m²', FS * 0.8 * k, g);
}
let labelTimer = null;
const relabelSoon = () => { clearTimeout(labelTimer); labelTimer = setTimeout(roomLabels, 120); };

// ---------------------------------------------------------------- draw
function draw() {
  svg.innerHTML = '';
  defs();
  if (!vb) vb = { x: FRAME[0], y: -(FRAME[1] + FRAME[3]), w: FRAME[2], h: FRAME[3] };
  svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  rect([FRAME[0] - 200, FRAME[1] - 200, FRAME[0] + FRAME[2] + 200, FRAME[1] + FRAME[3] + 200], { fill: '#f6f1e7' });
  // the road
  const R = { s: [FRAME[0] - 5, -7, FRAME[0] + FRAME[2] + 5, -0.4], n: [FRAME[0] - 5, site.d + 0.4, FRAME[0] + FRAME[2] + 5, site.d + 7], w: [-7, FRAME[1] - 5, -0.4, FRAME[1] + FRAME[3] + 5], e: [site.w + 0.4, FRAME[1] - 5, site.w + 7, FRAME[1] + FRAME[3] + 5] }[site.road];
  if (R) { rect(R, { fill: '#cfc8bc' }); label(R, t('roadLabel'), null, FS * 0.7, svg, false); }
  grid();
  const isSite = level === 'site', ground = Z.floors[GROUND] || [];
  if (isSite || level === GROUND) drawSite(isSite);
  else {
    rect([0, 0, site.w, site.d], { fill: 'none', stroke: '#c7baa7', 'stroke-width': 0.08, 'stroke-dasharray': '.6 .4' });
    const below = LEVEL_ORDER[LEVEL_ORDER.indexOf(level) - 1];
    for (const it of Z.floors[below] || []) rect(it.r, { fill: '#efe5d6' });
    for (const it of ground) rect(it.r, { class: 'ghost' });
  }
  if (isSite) {
    ground.forEach(drawRoom);
    walls(ground, Z.open[GROUND]);
    roofs();
  } else {
    decks(level);
    (Z.floors[level] || []).forEach(drawRoom);
    fixtures(Z.fixtures[level] || []);
    stairs(level);
    walls(Z.floors[level] || [], Z.open[level] || []);
    openings(Z.openings[level] || []);
    furniture(level);
    if (showRoofs) roofs();
    roomLabels();
  }
  rect([0, 0, site.w, site.d], { fill: 'none', stroke: '#6b5a48', 'stroke-width': 0.08, 'stroke-dasharray': '.5 .3', class: 'nopt' });
  compass();
  drawSelection();
}

// ---------------------------------------------------------------- sidebar
function sidebar() {
  $('lvT').textContent = level === 'site' ? t('siteTab') : LEVELS[level].name;
  const rows = [...LEVEL_ORDER].reverse().map(k => {
    const a = (Z.floors[k] || []).reduce((s, r) => s + area(r.r), 0);
    return [k, a];
  });
  const total = rows.reduce((s, [, a]) => s + a, 0);
  $('areas').innerHTML = rows.map(([k, a]) => `<tr class="${k === level ? 'cur' : ''}"><td>${LEVELS[k].name}</td><td class="n">${fmt(a, 1)} m²</td></tr>`).join('')
    + `<tr class="sum"><td>${t('total')}</td><td class="n">${fmt(total, 1)} m²</td></tr>`
    + `<tr><td>${t('siteTab')}</td><td class="n">${fmt(site.w, 1)} × ${fmt(site.d, 1)} m = ${fmt(site.w * site.d)} m²</td></tr>`;
  $('meta').textContent = [PROJECT.location.city, `${fmt(site.w, 1)} × ${fmt(site.d, 1)} m`].filter(Boolean).join(' · ');
  const used = new Set();
  const collect = (arr) => arr && arr.forEach(i => used.add(i.zone));
  if (level === 'site' || level === GROUND) { collect(Z.floors[GROUND]); collect(site.items); } else { collect(Z.floors[level]); collect(Z.outdoor[level]); }
  $('legend').innerHTML = [...used].filter(k => Z.zones[k]).map(k => `<span><i style="background:${Z.zones[k].color}"></i>${tr(Z.zones[k].label)}</span>`).join('');
  const notes = Z.notes[level] || (level === 'site' ? Z.notes.site : null) || [];
  $('notes').innerHTML = notes.map(n => `<li>${tr(n)}</li>`).join('');
  $('notesH').style.display = $('notes').style.display = notes.length ? '' : 'none';
}
function symbols() {
  const s = (svgInner, key) => `<span><svg viewBox="0 0 26 16">${svgInner}</svg>${t(key)}</span>`;
  $('symbols').innerHTML = [
    s('<line x1="2" y1="14" x2="24" y2="14" stroke="#3a3028" stroke-width="2.5"/><line x1="6" y1="14" x2="6" y2="2" stroke="#3a3028" stroke-width="1"/><path d="M6 2 A12 12 0 0 1 18 14" fill="none" stroke="#7a6c5f" stroke-width=".8"/>', 'lgDoor'),
    s('<line x1="2" y1="8" x2="14" y2="8" stroke="#3a3028" stroke-width="1.4"/><line x1="11" y1="10" x2="24" y2="10" stroke="#3a3028" stroke-width="1.4"/>', 'lgSliding'),
    s('<line x1="2" y1="6" x2="24" y2="6" stroke="#3a3028" stroke-width=".8"/><line x1="2" y1="8" x2="24" y2="8" stroke="#3a3028" stroke-width=".8"/><line x1="2" y1="10" x2="24" y2="10" stroke="#3a3028" stroke-width=".8"/>', 'lgWindow'),
    s('<line x1="2" y1="6" x2="24" y2="6" stroke="#3a3028" stroke-width=".8"/><line x1="2" y1="8" x2="24" y2="8" stroke="#3a3028" stroke-width=".8" stroke-dasharray="2 1.5"/><line x1="2" y1="10" x2="24" y2="10" stroke="#3a3028" stroke-width=".8"/>', 'lgHigh'),
    s('<line x1="2" y1="8" x2="24" y2="8" stroke="#3a3028" stroke-width="1" stroke-dasharray="1 1"/>', 'lgOpen'),
    s('<rect x="3" y="3" width="20" height="10" fill="#efe7da" stroke="#3a3028" stroke-width=".6"/><line x1="6" y1="8" x2="20" y2="8" stroke="#3a3028" stroke-width="1"/><path d="M18 5 L22 8 L18 11 z" fill="#3a3028"/>', 'lgStair'),
    s('<rect x="7" y="2" width="12" height="12" fill="#cfd3d6" stroke="#3a3028" stroke-width=".8"/><line x1="7" y1="2" x2="19" y2="14" stroke="#3a3028" stroke-width=".6"/><line x1="7" y1="14" x2="19" y2="2" stroke="#3a3028" stroke-width=".6"/>', 'lgLift'),
    s('<rect x="2" y="3" width="22" height="10" fill="none" stroke="#9c5a3c" stroke-width="1" stroke-dasharray="3 2"/>', 'lgRoof'),
  ].join('');
}

// ---------------------------------------------------------------- tabs & level
const tabs = $('tabs');
const order = ['site', ...[...LEVEL_ORDER].reverse()];
for (const id of order) {
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = id === 'site' ? t('siteTab') : LEVELS[id].name;
  b.dataset.id = id;
  b.onclick = () => setLevel(id);
  tabs.appendChild(b);
}
function setLevel(id) {
  if (!order.includes(id)) return false;
  level = id;
  selected = null;
  $('detail').innerHTML = `<span class="muted">${t('clickRoom')}</span>`;
  tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
  hideTip();
  draw(); sidebar();
  try { localStorage.setItem('h3s-plan-level', id); } catch (e) { /* storage blocked */ }
  return true;
}

// ---------------------------------------------------------------- zoom & pan
const pointers = new Map();
let startPinch = null;
function svgPoint(cx, cy) { const p = svg.createSVGPoint(); p.x = cx; p.y = cy; return p.matrixTransform(svg.getScreenCTM().inverse()); }
function zoomAt(px, py, f) {
  const nw = Math.min(FRAME[2] * 1.5, Math.max(2, vb.w * f));
  f = nw / vb.w;
  vb = { x: px - (px - vb.x) * f, y: py - (py - vb.y) * f, w: vb.w * f, h: vb.h * f };
  svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  relabelSoon();
}
svg.addEventListener('wheel', e => { e.preventDefault(); const p = svgPoint(e.clientX, e.clientY); zoomAt(p.x, p.y, Math.exp(e.deltaY * 0.0015)); }, { passive: false });
svg.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragMoved = false;
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; startPinch = Math.hypot(a.x - b.x, a.y - b.y); }
});
svg.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId), cur = { x: e.clientX, y: e.clientY };
  pointers.set(e.pointerId, cur);
  if (pointers.size === 1) {
    const dx = cur.x - prev.x, dy = cur.y - prev.y;
    if (!dragMoved && Math.hypot(dx, dy) < 3) return;
    dragMoved = true; svg.classList.add('dragging');
    const scale = 1 / svg.getScreenCTM().a;
    vb.x -= dx * scale; vb.y -= dy * scale;
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    hideTip();
  } else if (pointers.size === 2 && startPinch) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    const mid = svgPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
    zoomAt(mid.x, mid.y, startPinch / d); startPinch = d; dragMoved = true;
  }
});
const endPointer = e => { pointers.delete(e.pointerId); if (pointers.size < 2) startPinch = null; if (!pointers.size) svg.classList.remove('dragging'); };
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', endPointer);
svg.addEventListener('dblclick', () => { vb = null; draw(); });
const centerZoom = f => zoomAt(vb.x + vb.w / 2, vb.y + vb.h / 2, f);
$('zin').onclick = () => centerZoom(0.75);
$('zout').onclick = () => centerZoom(1 / 0.75);
$('zreset').onclick = () => { vb = null; draw(); };

// ---------------------------------------------------------------- start
applyI18n(document);
document.title = tr(PROJECT.title) + ' · ' + t('planTitle');
$('title').textContent = tr(PROJECT.title) + ' · ' + t('planTitle');
const langSel = $('lang');
for (const l of LANGS) langSel.add(new Option(l === 'id' ? 'Bahasa Indonesia' : 'English', l));
langSel.value = getLang();
langSel.onchange = () => { setLang(langSel.value); location.reload(); };
for (const [id, key, set] of [['furnToggle', 'furniture', v => { showFurn = v; }], ['gridToggle', 'grid', v => { showGrid = v; }], ['roofToggle', 'roofs', v => { showRoofs = v; }]]) {
  const box = $(id);
  box.checked = { furniture: showFurn, grid: showGrid, roofs: showRoofs }[key];
  box.onchange = (e) => { set(e.target.checked); draw(); };
}
symbols();
let start = params.get('level');
if (!order.includes(start)) { try { start = localStorage.getItem('h3s-plan-level'); } catch (e) { start = null; } }
setLevel(order.includes(start) ? start : GROUND);
window.__plan = { ready: true, levels: order, setLevel, get level() { return level; } };
