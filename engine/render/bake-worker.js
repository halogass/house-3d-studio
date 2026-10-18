// Web Worker for the lightmap unwrap (engine/render/bake.js createBakeRuntime): the chart growth,
// canonical sort and packing of an area's triangles run here, off the main thread.
//   in:  { seq, P: Float64Array(N × 9), opts }      out: { seq, ...unwrapTriangles(P, opts) }
import { unwrapTriangles } from './bake-unwrap.js';

self.onmessage = (e) => {
  const { seq, P, opts } = e.data;
  const r = unwrapTriangles(P, opts);
  self.postMessage({ seq, ...r }, [r.uv.buffer, r.page.buffer]);
};
