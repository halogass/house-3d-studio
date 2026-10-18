// Lightmap unwrap of one bake area (engine/render/bake.js), as plain math: no three.js, no DOM, so the
// same code runs in the app's Web Worker (engine/render/bake-worker.js), on the bake page and in Node.
//
//   unwrapTriangles(P, opts) → { hash, density, pages, uv, page, charts, tris, surface }
//
// P: Float64Array(N × 9), the area's triangles in world coordinates (any order, any partition into
// meshes: the result is keyed by geometry only). opts: { page (texels), density (texels / m),
// pad (gutter texels around a chart; 1 = 2 between charts, half a texel on the phones' maps), maxPages, reserve: [w, h] texels kept free at the top-left of page 0 | null,
// version (folded into the hash) }.
// uv: Float32Array(N × 6) in page-normalised coordinates (0..1), page: Uint8Array(N) page index,
// both in P's triangle order. hash: 16 hex digits over the quantised triangles (0.5 mm).
//
// Charts grow from canonical seeds over shared edges (normals within 60° of the seed and 45° of the
// neighbour, box ≤ ~3× the chart's surface), are boxed in the rotation that fits them tightest and
// shelf-packed into square pages. Every size and position is even, so a 2 × 2 box filter (the
// phones' half-size maps) never mixes two charts. Charts smaller than ~2.5 texels both ways
// (screws, legs, thin trims) take one 2 × 2 cell and all their corners map to its centre: one
// value, no gutter. Thin charts are stretched to at least 2 texels across so they rasterise.
const Q = 2000; // vertex quantisation: 0.5 mm

export function unwrapTriangles(P, { page: PAGE = 2048, density = 24, pad = 1, maxPages = 8, reserve = null, version = 3 } = {}) {
  const N = P.length / 9;
  // 1. quantised corners, and each triangle's corners in sorted order (canonical, order-free)
  const QI = new Int32Array(N * 9);
  for (let i = 0; i < N * 9; i++) QI[i] = Math.round(P[i] * Q);
  const VS = new Int32Array(N * 9);
  const lessV = (a, b) => QI[a] - QI[b] || QI[a + 1] - QI[b + 1] || QI[a + 2] - QI[b + 2];
  for (let t = 0; t < N; t++) {
    let a = t * 9, b = a + 3, c = a + 6, s;
    if (lessV(a, b) > 0) { s = a; a = b; b = s; }
    if (lessV(b, c) > 0) { s = b; b = c; c = s; }
    if (lessV(a, b) > 0) { s = a; a = b; b = s; }
    const o = t * 9;
    VS[o] = QI[a]; VS[o + 1] = QI[a + 1]; VS[o + 2] = QI[a + 2];
    VS[o + 3] = QI[b]; VS[o + 4] = QI[b + 1]; VS[o + 5] = QI[b + 2];
    VS[o + 6] = QI[c]; VS[o + 7] = QI[c + 1]; VS[o + 8] = QI[c + 2];
  }
  // 2. normals, areas, sort keys
  const NRM = new Float64Array(N * 3), AREA = new Float64Array(N), key = new Float64Array(N * 4);
  for (let t = 0; t < N; t++) {
    const o = t * 9;
    const ux = P[o + 3] - P[o], uy = P[o + 4] - P[o + 1], uz = P[o + 5] - P[o + 2];
    const wx = P[o + 6] - P[o], wy = P[o + 7] - P[o + 1], wz = P[o + 8] - P[o + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz);
    AREA[t] = l / 2;
    if (l > 1e-12) { nx /= l; ny /= l; nz /= l; } else { nx = 0; ny = 1; nz = 0; }
    NRM[t * 3] = nx; NRM[t * 3 + 1] = ny; NRM[t * 3 + 2] = nz;
    key[t * 4] = QI[o] + QI[o + 3] + QI[o + 6];
    key[t * 4 + 1] = QI[o + 1] + QI[o + 4] + QI[o + 7];
    key[t * 4 + 2] = QI[o + 2] + QI[o + 5] + QI[o + 8];
    key[t * 4 + 3] = Math.round(nx * 1000) * 4000000 + Math.round(ny * 1000) * 2000 + Math.round(nz * 1000);
  }
  const order = new Uint32Array(N);
  for (let i = 0; i < N; i++) order[i] = i;
  order.sort((a, b) => {
    for (let k = 0; k < 4; k++) { const d = key[a * 4 + k] - key[b * 4 + k]; if (d) return d; }
    for (let k = 0; k < 9; k++) { const d = VS[a * 9 + k] - VS[b * 9 + k]; if (d) return d; }
    return 0;
  });
  const rank = new Uint32Array(N);
  for (let r = 0; r < N; r++) rank[order[r]] = r;
  let h1 = 0x811c9dc5 ^ version, h2 = 0x01000193 ^ N;
  for (let r = 0; r < N; r++) {
    const o = order[r] * 9;
    for (let k = 0; k < 9; k++) { const c = VS[o + k]; h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ (c + 0x9e3779b9), 2246822519); }
  }
  const hash = (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');

  // 3. vertex ids (open addressing on the quantised triples)
  let cap = 1; while (cap < N * 6) cap <<= 1;
  const table = new Int32Array(cap).fill(-1), vx = new Int32Array(N * 9), vid = new Int32Array(N * 3);
  let nv = 0;
  for (let c = 0; c < N * 3; c++) {
    const a = QI[c * 3], b = QI[c * 3 + 1], d = QI[c * 3 + 2];
    const h = Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(d, 83492791);
    let slot = (h ^ (h >>> 13)) & (cap - 1);
    for (;;) {
      const u = table[slot];
      if (u < 0) { table[slot] = nv; vx[nv * 3] = a; vx[nv * 3 + 1] = b; vx[nv * 3 + 2] = d; vid[c] = nv++; break; }
      if (vx[u * 3] === a && vx[u * 3 + 1] === b && vx[u * 3 + 2] === d) { vid[c] = u; break; }
      slot = (slot + 1) & (cap - 1);
    }
  }
  // 4. edge adjacency: edges (sorted vertex-id pairs) in a hash table, triangles per edge as linked lists
  let ecap = 1; while (ecap < N * 6) ecap <<= 1;
  const etab = new Int32Array(ecap).fill(-1), eA = new Int32Array(N * 3), eB = new Int32Array(N * 3), eHead = new Int32Array(N * 3), eCount = new Uint8Array(N * 3);
  const hNext = new Int32Array(N * 3), hTri = new Uint32Array(N * 3);
  let ne = 0;
  for (let t = 0; t < N; t++) for (let k = 0; k < 3; k++) {
    let a = vid[t * 3 + k], b = vid[t * 3 + (k + 1) % 3];
    if (a === b) continue;
    if (a > b) { const s = a; a = b; b = s; }
    const h = Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca77);
    let slot = (h ^ (h >>> 15)) & (ecap - 1), e;
    for (;;) {
      e = etab[slot];
      if (e < 0) { e = ne++; etab[slot] = e; eA[e] = a; eB[e] = b; eHead[e] = -1; break; }
      if (eA[e] === a && eB[e] === b) break;
      slot = (slot + 1) & (ecap - 1);
    }
    const hi = t * 3 + k;
    hTri[hi] = t; hNext[hi] = eHead[e]; eHead[e] = hi;
    if (eCount[e] < 255) eCount[e]++;
  }
  const nbCount = new Uint32Array(N);
  for (let e = 0; e < ne; e++) {
    const n = eCount[e];
    if (n < 2 || n > 6) continue;
    for (let p = eHead[e]; p >= 0; p = hNext[p]) nbCount[hTri[p]] += n - 1;
  }
  const nbStart = new Uint32Array(N + 1);
  for (let t = 0; t < N; t++) nbStart[t + 1] = nbStart[t] + nbCount[t];
  const nb = new Uint32Array(nbStart[N]), fill = nbStart.slice(0, N);
  for (let e = 0; e < ne; e++) {
    const n = eCount[e];
    if (n < 2 || n > 6) continue;
    for (let p = eHead[e]; p >= 0; p = hNext[p]) for (let q = eHead[e]; q >= 0; q = hNext[q]) {
      if (p === q || hTri[p] === hTri[q]) continue;
      nb[fill[hTri[p]]++] = hTri[q];
    }
  }
  for (let t = 0; t < N; t++) {
    const s = nbStart[t], e = fill[t];
    if (e - s > 1) nb.subarray(s, e).sort((a, b) => rank[a] - rank[b]);
  }

  // 5. charts by region growing from canonical seeds
  const COS_SEED = Math.cos(60 * Math.PI / 180), COS_NB = Math.cos(45 * Math.PI / 180);
  const basis = (nx, ny, nz) => {
    let U;
    if (Math.abs(ny) < 0.9) { const l = Math.hypot(nz, nx) || 1; U = [nz / l, 0, -nx / l]; }
    else { U = [1 - nx * nx, -nx * ny, -nx * nz]; const l = Math.hypot(U[0], U[1], U[2]) || 1; U = [U[0] / l, U[1] / l, U[2] / l]; }
    return [U, [ny * U[2] - nz * U[1], nz * U[0] - nx * U[2], nx * U[1] - ny * U[0]]];
  };
  const chartOf = new Int32Array(N).fill(-1);
  const charts = [];
  const queue = new Uint32Array(N);
  const triList = new Uint32Array(N); // charts' triangles, contiguous
  let tl = 0;
  for (let r = 0; r < N; r++) {
    const seed = order[r];
    if (chartOf[seed] >= 0) continue;
    const c = charts.length, sx = NRM[seed * 3], sy = NRM[seed * 3 + 1], sz = NRM[seed * 3 + 2];
    const [U, V] = basis(sx, sy, sz);
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    const grow = (t, b) => {
      for (let k = 0; k < 3; k++) {
        const o = t * 9 + k * 3;
        const u = P[o] * U[0] + P[o + 1] * U[1] + P[o + 2] * U[2], v = P[o] * V[0] + P[o + 1] * V[1] + P[o + 2] * V[2];
        if (u < b[0]) b[0] = u; if (u > b[2]) b[2] = u; if (v < b[1]) b[1] = v; if (v > b[3]) b[3] = v;
      }
    };
    grow(seed, box);
    let surf = AREA[seed];
    const start = tl;
    let qh = 0, qt = 0;
    queue[qt++] = seed; chartOf[seed] = c;
    const nbx = [0, 0, 0, 0];
    while (qh < qt) {
      const t = queue[qh++];
      triList[tl++] = t;
      for (let i = nbStart[t]; i < fill[t]; i++) {
        const u = nb[i];
        if (chartOf[u] >= 0 || AREA[u] < 1e-12) continue;
        const ds = NRM[u * 3] * sx + NRM[u * 3 + 1] * sy + NRM[u * 3 + 2] * sz;
        const dn = NRM[u * 3] * NRM[t * 3] + NRM[u * 3 + 1] * NRM[t * 3 + 1] + NRM[u * 3 + 2] * NRM[t * 3 + 2];
        if (ds < COS_SEED || dn < COS_NB) continue;
        nbx[0] = box[0]; nbx[1] = box[1]; nbx[2] = box[2]; nbx[3] = box[3];
        grow(u, nbx);
        if ((nbx[2] - nbx[0]) * (nbx[3] - nbx[1]) > 3 * (surf + AREA[u]) + 0.02) continue;
        box[0] = nbx[0]; box[1] = nbx[1]; box[2] = nbx[2]; box[3] = nbx[3];
        surf += AREA[u];
        chartOf[u] = c; queue[qt++] = u;
      }
    }
    charts.push({ seed, start, end: tl, U, V, box, surf });
  }
  // 6. tightest rotation: the growth basis, or aligned with one of the seed's edges
  for (const ch of charts) {
    const o = ch.seed * 9;
    let best = (ch.box[2] - ch.box[0]) * (ch.box[3] - ch.box[1]), pick = null;
    for (let k = 0; k < 3; k++) {
      const a = o + k * 3, b = o + ((k + 1) % 3) * 3;
      const ex = P[b] - P[a], ey = P[b + 1] - P[a + 1], ez = P[b + 2] - P[a + 2];
      const eu = ex * ch.U[0] + ey * ch.U[1] + ez * ch.U[2], ev = ex * ch.V[0] + ey * ch.V[1] + ez * ch.V[2];
      const l = Math.hypot(eu, ev);
      if (l < 1e-9) continue;
      const c = eu / l, s = ev / l;
      const U2 = [ch.U[0] * c + ch.V[0] * s, ch.U[1] * c + ch.V[1] * s, ch.U[2] * c + ch.V[2] * s];
      const V2 = [-ch.U[0] * s + ch.V[0] * c, -ch.U[1] * s + ch.V[1] * c, -ch.U[2] * s + ch.V[2] * c];
      const b2 = [Infinity, Infinity, -Infinity, -Infinity];
      for (let i = ch.start; i < ch.end; i++) {
        const t = triList[i];
        for (let q = 0; q < 3; q++) {
          const p = t * 9 + q * 3;
          const u = P[p] * U2[0] + P[p + 1] * U2[1] + P[p + 2] * U2[2], v = P[p] * V2[0] + P[p + 1] * V2[1] + P[p + 2] * V2[2];
          if (u < b2[0]) b2[0] = u; if (u > b2[2]) b2[2] = u; if (v < b2[1]) b2[1] = v; if (v > b2[3]) b2[3] = v;
        }
      }
      const ar = (b2[2] - b2[0]) * (b2[3] - b2[1]);
      if (ar < best * 0.97) { best = ar; pick = [U2, V2, b2]; }
    }
    if (pick) { ch.U = pick[0]; ch.V = pick[1]; ch.box = pick[2]; }
    // landscape cells pack tighter on shelves
    if (ch.box[3] - ch.box[1] > ch.box[2] - ch.box[0]) { const U = ch.U; ch.U = ch.V; ch.V = [-U[0], -U[1], -U[2]]; ch.box = [ch.box[1], -ch.box[2], ch.box[3], -ch.box[0]]; } // a 90° turn (a mirror would flip the winding)
  }

  // 7. cells + shelf packing into pages, shrinking the density until they fit
  const even = (x) => 2 * Math.ceil(x / 2);
  const resH = reserve ? even(reserve[1]) : 0;
  let D = density, cells = null, pages = 0;
  for (let tries = 0; tries < 40; tries++, D *= 0.93) {
    cells = charts.map((ch, i) => {
      const ex = (ch.box[2] - ch.box[0]) * D, ey = (ch.box[3] - ch.box[1]) * D;
      if (ex < 2.5 && ey < 2.5) return { i, tiny: true, w: 2, h: 2 };
      const cu = Math.max(ex, 2), cv = Math.max(ey, 2);
      return { i, tiny: false, cu, cv, su: ex > 1e-9 ? cu / ex : 0, sv: ey > 1e-9 ? cv / ey : 0, w: Math.min(PAGE, even(Math.ceil(cu) + 2 * pad)), h: Math.min(PAGE, even(Math.ceil(cv) + 2 * pad)) };
    });
    const sorted = cells.slice().sort((a, b) => b.h - a.h || b.w - a.w || rank[charts[a.i].seed] - rank[charts[b.i].seed]);
    let pg = 0, x = 0, y = resH, rowH = 0;
    for (const s of sorted) {
      if (x + s.w > PAGE) { y += rowH; x = 0; rowH = 0; }
      if (y + s.h > PAGE) { pg++; x = 0; y = 0; rowH = 0; }
      s.pg = pg; s.x = x; s.y = y;
      x += s.w; rowH = Math.max(rowH, s.h);
    }
    pages = pg + 1;
    if (pages <= maxPages) break;
  }
  // 8. per-triangle uvs (page-normalised) and page index
  const uv = new Float32Array(N * 6), pageOf = new Uint8Array(N);
  for (const s of cells) {
    const ch = charts[s.i], { U, V, box } = ch;
    for (let i = ch.start; i < ch.end; i++) {
      const t = triList[i];
      pageOf[t] = s.pg;
      for (let k = 0; k < 3; k++) {
        let px, py;
        if (s.tiny) { px = s.x + 1; py = s.y + 1; }
        else {
          const o = t * 9 + k * 3;
          const u = P[o] * U[0] + P[o + 1] * U[1] + P[o + 2] * U[2], v = P[o] * V[0] + P[o + 1] * V[1] + P[o + 2] * V[2];
          px = s.x + pad + (s.su ? (u - box[0]) * D * s.su : s.cu / 2);
          py = s.y + pad + (s.sv ? (v - box[1]) * D * s.sv : s.cv / 2);
        }
        uv[t * 6 + k * 2] = px / PAGE;
        uv[t * 6 + k * 2 + 1] = py / PAGE;
      }
    }
  }
  // degenerate triangles never grown into a chart got one of their own (a tiny cell): fine
  let surface = 0; for (let t = 0; t < N; t++) surface += AREA[t];
  const use = { tiny: 0, cells: 0, content: 0 };
  for (const s of cells) { if (s.tiny) use.tiny += 4; else { use.cells += s.w * s.h; use.content += s.cu * s.cv; } }
  return { hash, density: +D.toFixed(4), pages, uv, page: pageOf, charts: charts.length, tiny: cells.filter(c => c.tiny).length, tris: N, surface: Math.round(surface), use };
}
