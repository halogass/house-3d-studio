// Material registry (names listed in docs/SCHEMA.md, "Materials").
//
//   const { M, T, getMaterial, setNightFactor, ready } = makeMaterials(renderer);
//
// - M: legacy keys used by world.js (wood, plaster, terracotta, ...). M also resolves any
//   registry name lazily (M.walnut === getMaterial('walnut')).
// - getMaterial(name): cached material for every registry name, every legacy key, and the
//   factories `paint:#rrggbb` (interior paint) / `lacquer:#rrggbb` (joinery) / `stucco:#rrggbb` (exterior render). Unknown names → neutral grey + one warning.
// - setNightFactor(n 0..1): emissive / light materials glow at night (n = 1), subtle by day.
// - ready: Promise that resolves when all photo PBR textures requested so far have loaded.
// - deferTextures (phones / tablets): photo sets are not fetched when a material is made, only
//   once want(materials) names a material that uses them, in that order, `concurrency` at a time.
//   want() with no argument queues every set requested so far.
//
// Every material renders immediately with a colour (and the old canvas texture where one
// exists); the CC0 photo maps (public/textures/<set>/) are swapped in when they arrive.
import * as THREE from 'three';
import { makeTextures, loadPBRSet } from './textures.js';
import { installBakePatch } from './render/bake.js';

// Photo PBR sets: metres covered by one tile (UVs are metres), or `rep` = fixed repeats per UV
// unit for sets mostly used on furniture primitives (0..1 UVs per face). `detail` sets have a
// neutral grey diffuse (mean sRGB 0.8) so the material colour sets the hue.
const SETS = {
  woodFloor: { size: 1.7 }, herringbone: { size: 2.4 }, woodDark: { size: 2.0 },
  walnut: { size: 1.2 }, oak: { size: 1.2 }, mahogany: { size: 0.9 }, cherry: { size: 1.0 }, teak: { size: 1.0 },
  marbleWhite: { size: 1.6 }, marbleDark: { size: 1.4 }, travertine: { size: 1.6 }, limestone: { size: 1.5 },
  plaster: { size: 2.0, detail: true }, plasterExt: { size: 2.5, detail: true },
  stone: { size: 2.0 }, roofTiles: { size: 2.5 }, grass: { size: 3.0 }, gravel: { size: 2.25 },
  concrete: { size: 2.0 }, concretePolished: { size: 4.0, aspect: 2 },
  granite: { size: 2.3 }, tileBath: { size: 1.9 }, terracottaTile: { size: 2.08 },
  asphalt: { size: 2.35 }, rubber: { size: 2.0 },
  velvet: { rep: 4, detail: true }, linen: { rep: 4, detail: true }, knit: { rep: 4, detail: true },
  leather: { rep: 2, detail: true }, boucle: { rep: 3 }, jute: { rep: 5 },
};
// Linear-space gain that maps the detail maps' mean (sRGB 0.8 → linear 0.604) back to 1.
const DETAIL_GAIN = 1 / 0.604;

// Registry definitions. Fields: c colour, r roughness (multiplies the roughness map when a set
// is loaded), m metalness, set (photo set), canvas (fallback / decor canvas texture key),
// phys (MeshPhysicalMaterial extras), glow [dayIntensity, nightIntensity] + e emissive colour,
// o opacity (→ transparent), side, noShadow, repeat override for canvas textures.
const DEFS = {
  // Woods
  walnut: { set: 'walnut', c: 0xffffff, r: 0.9 },
  mahogany: { set: 'mahogany', c: 0x9a5a48, r: 0.8 },
  oak: { set: 'oak', c: 0xd8b48c, r: 0.95 },
  oakLight: { set: 'oak', c: 0xffffff, r: 0.95 },
  teak: { set: 'teak', c: 0xe0b890, r: 0.9 },
  cherry: { set: 'cherry', c: 0xc98a68, r: 0.75 },
  woodHerringbone: { set: 'herringbone', c: 0xffffff, r: 0.9, canvas: 'wood' },
  woodPlankDark: { set: 'woodDark', c: 0xffffff, r: 0.95, canvas: 'woodDark' },

  // Fabrics
  velvetOlive: { set: 'velvet', c: 0x5f6436, r: 1, velvet: true },
  velvetBurgundy: { set: 'velvet', c: 0x64202a, r: 1, velvet: true },
  velvetEmerald: { set: 'velvet', c: 0x1f4f3c, r: 1, velvet: true },
  linenCream: { set: 'linen', c: 0xe6dac2, r: 1 },
  linenWhite: { set: 'linen', c: 0xf1eee6, r: 1 },
  boucleIvory: { set: 'boucle', c: 0xfff6ea, r: 1 },
  fabricSage: { set: 'linen', c: 0x99a487, r: 1 },
  fabricTaupe: { set: 'linen', c: 0x8b7d6d, r: 1 },
  fabricCharcoal: { set: 'linen', c: 0x3c3c3e, r: 1 },
  quiltFloral: { canvas: 'quiltFloral', c: 0xffffff, r: 0.95 },
  throwKnit: { set: 'knit', c: 0xe9dfcc, r: 1 },
  drapeCream: { set: 'linen', c: 0xece2cc, r: 1, side: THREE.DoubleSide },
  drapeBurgundy: { set: 'velvet', c: 0x5a1a22, r: 1, velvet: true, side: THREE.DoubleSide },
  sheer: { c: 0xfbf8f0, r: 0.9, o: 0.38, side: THREE.DoubleSide, noShadow: true },

  // Leather
  leatherCognac: { set: 'leather', c: 0x8c4a22, r: 0.55, phys: { clearcoat: 0.25, clearcoatRoughness: 0.5 } },
  leatherDarkBrown: { set: 'leather', c: 0x3e2418, r: 0.55, phys: { clearcoat: 0.3, clearcoatRoughness: 0.45 } },
  leatherBlack: { set: 'leather', c: 0x1a1816, r: 0.5, phys: { clearcoat: 0.3, clearcoatRoughness: 0.45 } },
  leatherOxblood: { set: 'leather', c: 0x4c151a, r: 0.55, phys: { clearcoat: 0.3, clearcoatRoughness: 0.45 } },

  // Metals
  brass: { c: 0xd9ad5b, r: 0.28, m: 1 },
  brassAged: { c: 0xa98544, r: 0.45, m: 1 },
  ironBlack: { c: 0x1e1c1a, r: 0.55, m: 0.7 },
  chrome: { c: 0xf4f4f4, r: 0.06, m: 1 },
  steelBrushed: { c: 0xb4b8bc, r: 0.32, m: 1 },
  copper: { c: 0xd08552, r: 0.3, m: 1 },

  // Stone
  marbleWhite: { set: 'marbleWhite', c: 0xffffff, r: 0.45, phys: { clearcoat: 0.4, clearcoatRoughness: 0.15 } },
  marbleGreen: { set: 'marbleDark', c: 0x7fc2a0, r: 0.4, phys: { clearcoat: 0.5, clearcoatRoughness: 0.1 } },
  travertineHoned: { set: 'travertine', c: 0xffffff, r: 0.9, canvas: 'travertine' },
  graniteBlack: { set: 'marbleDark', c: 0x8a8a8a, r: 0.35, phys: { clearcoat: 0.5, clearcoatRoughness: 0.1 } },
  concretePolished: { set: 'concretePolished', c: 0xffffff, r: 0.45, canvas: 'concrete' },

  // Joinery paints
  cabinetGreen: { lacquer: '#3f4a36' },
  cabinetCream: { lacquer: '#e6dcc8' },
  trimWhite: { lacquer: '#f2efe7' },
  trimCream: { lacquer: '#e8dfca' },

  // Rugs (Persian / trellis map once over 0..1 UVs)
  rugPersianRed: { canvas: 'rugPersianRed', c: 0xffffff, r: 1 },
  rugPersianCream: { canvas: 'rugPersianCream', c: 0xffffff, r: 1 },
  rugPersianBlue: { canvas: 'rugPersianBlue', c: 0xffffff, r: 1 },
  rugJute: { set: 'jute', c: 0xffffff, r: 1 },
  rugWoolNeutral: { set: 'knit', c: 0xd8ccb6, r: 1 },
  rugSage: { canvas: 'rugSage', c: 0xffffff, r: 1 },

  // Glass & mirror
  glassClear: { c: 0xd6e6ea, r: 0.04, o: 0.18, env: 1.5, noShadow: true, depthWrite: false },
  glassFrosted: { c: 0xf2f5f4, r: 0.45, o: 0.6, noShadow: true, depthWrite: false },
  mirror: { c: 0xa8a49c, r: 0.1, m: 0.85 }, // toned down: the env map is the sky, a bright mirror looks blue indoors
  crystal: { c: 0xf4f8ff, r: 0.02, m: 0.2, o: 0.55, e: 0xfff2dc, glow: [0, 0.35], noShadow: true, depthWrite: false },

  // Light / emissive
  lampShade: { c: 0xf2e2c4, r: 0.9, e: 0xffc98a, glow: [0.12, 1.8], side: THREE.DoubleSide, set: 'linen' },
  paperShade: { c: 0xf6efe2, r: 0.95, e: 0xffd9a8, glow: [0.15, 1.6], side: THREE.DoubleSide },
  bulbWarm: { c: 0xfff2dc, r: 0.3, e: 0xffd49a, glow: [1.5, 14], noShadow: true },
  coveLight: { c: 0xfff0dc, r: 0.5, e: 0xffcf96, glow: [0.4, 7], noShadow: true },
  candleFlame: { c: 0xffe0a0, r: 0.5, e: 0xffa648, glow: [3, 10], noShadow: true },
  screenOn: { c: 0x10141a, r: 0.15, e: 0x9cb8e0, glow: [0.6, 1.0] },
  // LED diffusers (lighting.js linearLed / panelLed / industrialPendant): lit by day too (basements,
  // windowless rooms); cool ≈ 6000 K, neutral ≈ 4000 K, warm ≈ 3000 K
  ledCool: { c: 0xf4f7ff, r: 0.4, e: 0xeef3ff, glow: [1.6, 2.2], noShadow: true },
  ledNeutral: { c: 0xfffaf2, r: 0.4, e: 0xfff3e4, glow: [1.6, 2.2], noShadow: true },
  ledWarm: { c: 0xfff4e4, r: 0.4, e: 0xffd9a8, glow: [1.4, 2], noShadow: true },
  powderWhite: { c: 0xecebe6, r: 0.45, m: 0.15 }, // powder-coated aluminium (LED housings)

  // Decor
  books: { canvas: 'books', c: 0xffffff, r: 0.8 },
  canvasArt1: { canvas: 'canvasArt1', c: 0xffffff, r: 0.6 },
  canvasArt2: { canvas: 'canvasArt2', c: 0xffffff, r: 0.6 },
  canvasArt3: { canvas: 'canvasArt3', c: 0xffffff, r: 0.6 },
  wallpaperDamask: { canvas: 'damask', c: 0xffffff, r: 0.75 },
  terracottaPot: { set: 'plaster', c: 0xb4643f, r: 0.9 },
  plantLeaf: { c: 0x4d7a33, r: 0.55, side: THREE.DoubleSide, phys: { sheen: 0.3, sheenColor: 0x9fcf70, sheenRoughness: 0.5 } },
  plantLeafDark: { c: 0x2c5428, r: 0.5, side: THREE.DoubleSide, phys: { sheen: 0.3, sheenColor: 0x6f9f50, sheenRoughness: 0.5 } },
  porcelain: { c: 0xf7f5f0, r: 0.12, phys: { clearcoat: 1, clearcoatRoughness: 0.05 } },
  feltGreen: { set: 'knit', c: 0x1f6a3a, r: 1 },
  rubberBlack: { set: 'rubber', c: 0x5a5a5a, r: 1 },
  acousticPanel: { set: 'linen', c: 0x3a2024, r: 1 },
  pegboard: { canvas: 'pegboard', c: 0xffffff, r: 0.85 },
};

// Legacy keys (world.js). `set` upgrades them to photo PBR; `canvas` is the immediate fallback.
const LEGACY = {
  // Floors
  wood: { set: 'woodFloor', canvas: 'wood', r: 0.85 },
  woodDark: { set: 'woodDark', canvas: 'woodDark', r: 0.9 },
  travertine: { set: 'travertine', canvas: 'travertine', r: 0.7 },
  tileGrey: { canvas: 'tileGrey', r: 0.6 },
  tileBath: { set: 'tileBath', canvas: 'tileBath', r: 0.5 },
  concrete: { set: 'concrete', canvas: 'concrete', r: 1 },
  epoxy: { canvas: 'epoxy', r: 0.22 }, // garage showroom: glossy, reflects the LED lines
  carpet: { set: 'velvet', c: 0x5c2a2a, r: 1 },
  rubber: { set: 'rubber', canvas: 'rubber', r: 1 },

  // Walls & ceilings
  plaster: { set: 'plaster', c: 0xefe6d7, r: 1 },
  plasterExt: { set: 'plasterExt', c: 0xe6cba0, r: 1 },
  concreteWall: { set: 'concrete', canvas: 'concrete', c: 0xf0ece4, r: 1 },
  stone: { set: 'stone', canvas: 'stone', r: 1 },
  ceiling: { c: 0xf6f1e8, r: 1, e: 0xffd9a0, glow: [0.25, 0.08] }, // faint bounce by day; lamps light it at night
  ceilingBase: { c: 0xeeeae2, r: 1, e: 0xfff0d8, glow: [0.35, 0.3] },
  soffit: { set: 'teak', c: 0xb07a55, r: 0.9 },

  // Roofs & exterior
  terracotta: { set: 'roofTiles', canvas: 'terracotta', r: 1 },
  roofTileDark: { set: 'roofTiles', canvas: 'terracotta', c: 0x6d6a6a, r: 1 },  // grey / charcoal concrete tiles
  roofMetal: { c: 0x3a3e43, r: 0.42, m: 0.55 },                                 // standing-seam metal
  roofMetalLight: { c: 0xb9bdbf, r: 0.38, m: 0.6 },                             // zincalume / light metal
  roofDeck: { set: 'gravel', canvas: 'gravel', r: 1 },
  grass: { set: 'grass', canvas: 'grass', r: 1 },
  grassFar: { set: 'grass', canvas: 'grass', c: 0xc6d2ae, r: 1 },
  pavers: { set: 'limestone', canvas: 'pavers', r: 0.95 },
  paversWarm: { set: 'limestone', canvas: 'paversWarm', c: 0xf2d2b4, r: 0.95 },
  gravel: { set: 'gravel', canvas: 'gravel', r: 1 },
  asphalt: { set: 'asphalt', canvas: 'asphalt', r: 1 },
  soil: { canvas: 'soil', r: 1 },
  water: { canvas: 'water', c: 0x7fc4d6, r: 0.08, m: 0.1, o: 0.82, noShadow: true },
  poolTile: { canvas: 'tileBath', c: 0x9fd3e0, r: 0.3 },

  // Joinery & fixtures
  door: { set: 'walnut', c: 0xc89878, r: 0.8 },
  frame: { c: 0x2f2a26, r: 0.5, m: 0.3 },
  steel: { c: 0x8d949a, r: 0.35, m: 0.8 },
  steelDark: { c: 0x3d4146, r: 0.45, m: 0.6 },
  counter: { lacquer: '#4e5a45' },
  counterTop: { set: 'marbleWhite', r: 0.45 },
  ceramic: { c: 0xf7f7f4, r: 0.15, phys: { clearcoat: 1, clearcoatRoughness: 0.05 } },
  leather: { set: 'leather', c: 0x5b3a2c, r: 0.6 },
  fabric: { set: 'linen', c: 0xb8a58a, r: 1 },
  screen: { c: 0x111111, r: 0.2, e: 0x223344, glow: [0.25, 0.4] },
  carBody: { c: 0x2b3440, r: 0.25, m: 0.6, phys: { clearcoat: 1, clearcoatRoughness: 0.08 } },
  carGlass: { c: 0x1a1f24, r: 0.1, m: 0.3 },
  paint: { set: 'plaster', c: 0xf2f2f2, r: 0.7 },
  railing: { c: 0x2f2a26, r: 0.4, m: 0.5 },

  // Glass (no shadows)
  glass: { c: 0xbcd6e2, r: 0.05, m: 0.1, o: 0.22, depthWrite: false, noShadow: true },
  net: { c: 0x333333, r: 0.85, o: 0.18, depthWrite: false, side: THREE.DoubleSide, noShadow: true },

  // Landscape
  trunk: { c: 0x5a4330, r: 0.85 },
  leaves: { c: 0x5f7f3e, r: 1 },
  leavesLight: { c: 0x7c9a4a, r: 1 },
  crop: { c: 0x6f9a3e, r: 1 },
  sorghum: { c: 0xa48a4a, r: 1 },
  solar: { c: 0x1d2b3d, r: 0.2, m: 0.5 },
  greenhouse: { c: 0xe4f0f0, r: 0.1, o: 0.35, depthWrite: false, noShadow: true },
  // Enclosures: black stainless wire mesh (alpha grid texture) and frosted (opal) polycarbonate roofing
  wireMesh: { canvas: 'wireMesh', c: 0xffffff, r: 0.45, m: 0.6, o: 1, alphaTest: 0.04, side: THREE.DoubleSide, depthWrite: false, noShadow: true },
  polycarbonate: { c: 0xeef2f0, r: 0.45, m: 0, o: 0.72, env: 0.8, side: THREE.DoubleSide, depthWrite: false, noShadow: true },
  fire: { c: 0x333333, r: 0.85, e: 0xff7a2a, glow: [1.2, 3] },
};

// Emissive materials registered for the night factor: [material, day, night].
const glowing = [];
let nightFactor = 0;
export function setNightFactor(n) {
  nightFactor = Math.max(0, Math.min(1, n));
  for (const [mat, d, nn] of glowing) mat.emissiveIntensity = d + (nn - d) * nightFactor;
}
export function getNightFactor() { return nightFactor; }

export function makeMaterials(renderer, { pbr = true, lite = false, deferTextures = false, concurrency = 3 } = {}) {
  const T = makeTextures(renderer);
  const aniso = Math.min(lite ? 4 : 16, renderer.capabilities.getMaxAnisotropy());
  T.pbr = {};
  const pending = [];

  // 1 px stand-ins that look exactly like no map: white colour / roughness, flat normal
  const px = {};
  const placeholder = (kind = 'map') => {
    if (!px[kind]) {
      const t = new THREE.DataTexture(new Uint8Array(kind === 'normal' ? [128, 128, 255, 255] : [255, 255, 255, 255]), 1, 1);
      t.colorSpace = kind === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.needsUpdate = true;
      px[kind] = t;
    }
    return px[kind];
  };

  // One shared promise per photo set.
  const setPromises = {};
  const queued = new Map();   // deferred sets: name → start()
  let active = 0;
  const pump = () => {
    while (active < concurrency && queued.size) {
      const [name, start] = queued.entries().next().value;
      if (!start) { queued.delete(name); continue; }
      queued.delete(name);
      active++;
      start().finally(() => { active--; pump(); });
    }
  };
  function photoSet(name) {
    if (!pbr) return null;
    if (!setPromises[name]) {
      const s = SETS[name];
      const rep = s.rep ? [s.rep, s.rep] : [1 / (s.size * (s.aspect || 1)), 1 / s.size];
      const load = () => loadPBRSet(name, rep, aniso, lite).then((t) => (T.pbr[name] = t)).catch((e) => {
        console.warn(`[materials] texture set "${name}" failed to load; keeping fallback`, e?.message || e);
        return null;
      });
      if (deferTextures) {
        let go;
        setPromises[name] = new Promise((resolve) => { go = () => { const p = load(); p.then(resolve); return p; }; });
        waiting.set(name, go);
      } else setPromises[name] = load();
      pending.push(setPromises[name]);
    }
    return setPromises[name];
  }
  const waiting = new Map();  // deferred sets nobody has asked for yet
  const setOf = new WeakMap(); // material → its photo set
  function want(list) {
    if (!deferTextures) return;
    const names = list ? [...list].map(m => setOf.get(m)).filter(Boolean) : [...waiting.keys()];
    for (const n of names) if (waiting.has(n)) { queued.set(n, waiting.get(n)); waiting.delete(n); }
    pump();
  }

  function build(def, label) {
    if (def.lacquer) return lacquer(def.lacquer);
    const physical = def.phys || def.velvet;
    const mat = physical ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
    mat.name = label;
    mat.color.set(def.c ?? 0xffffff);
    mat.roughness = def.r ?? 0.85;
    mat.metalness = def.m ?? 0;
    if (def.side) mat.side = def.side;
    if (def.o !== undefined) { mat.transparent = true; mat.opacity = def.o; }
    if (def.depthWrite === false) mat.depthWrite = false;
    if (def.alphaTest) mat.alphaTest = def.alphaTest;
    if (def.env) mat.envMapIntensity = def.env;
    if (def.phys) for (const [k, v] of Object.entries(def.phys)) {
      if (mat[k] && mat[k].isColor) mat[k].set(v); else mat[k] = v;
    }
    if (def.velvet) {
      mat.sheen = 1;
      mat.sheenRoughness = 0.35;
      mat.sheenColor.set(def.c).lerp(new THREE.Color(0xffffff), 0.35);
    }
    if (def.e !== undefined) {
      mat.emissive.set(def.e);
      const [d, n] = def.glow || [1, 1];
      mat.emissiveIntensity = d + (n - d) * nightFactor;
      glowing.push([mat, d, n]);
      mat.userData.glow = { day: d, night: n };
    }
    if (def.noShadow) mat.userData.noShadow = true;
    if (def.canvas) mat.map = T[def.canvas];
    const setName = def.set;
    if (setName && pbr) setOf.set(mat, setName);
    if (setName) {
      const detail = SETS[setName].detail;
      const baseColor = mat.color.clone();
      if (detail && !def.canvas) mat.userData.detailColor = baseColor;
      // 1 px stand-in maps look exactly like no maps, and when the photos arrive only the textures
      // are swapped, so no shader is rebuilt mid-walk (lite sets have no normal / roughness maps)
      if (pbr) {
        if (!mat.map) mat.map = placeholder('map');
        if (!lite) { mat.normalMap = placeholder('normal'); mat.roughnessMap = placeholder('rough'); }
      }
      photoSet(setName)?.then((t) => {
        if (!t) return;
        const rebuild = !mat.map !== !t.map || !mat.normalMap !== !t.normalMap || !mat.roughnessMap !== !t.roughnessMap;
        mat.map = t.map;
        mat.normalMap = t.normalMap;
        mat.roughnessMap = t.roughnessMap;
        if (detail) mat.color.copy(baseColor).multiplyScalar(DETAIL_GAIN);
        if (def.velvet) mat.normalScale.set(0.6, 0.6);
        if (rebuild) mat.needsUpdate = true;
      });
    }
    // baked lighting (engine/render/bake.js): same program everywhere, used only where a bake applies;
    // the ceilings' emissive "bounce" is replaced by the bake there
    installBakePatch(mat, { fakeGlow: label === 'ceiling' || label === 'ceilingBase' });
    return mat;
  }

  // ---------------------------------------------------------------- factories
  function paint(hex) {
    return build({ set: 'plaster', c: new THREE.Color(hex).getHex(), r: 0.92 }, 'paint:' + hex);
  }
  function stucco(hex) { // exterior render tinted to a colour (style.exteriorColor)
    return build({ set: 'plasterExt', c: new THREE.Color(hex).getHex(), r: 1 }, 'stucco:' + hex);
  }
  function lacquer(hex) {
    const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex), roughness: 0.38, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.3 });
    mat.name = 'lacquer:' + hex;
    return installBakePatch(mat);
  }

  // ---------------------------------------------------------------- legacy M (eager)
  const base = {};
  for (const [k, def] of Object.entries(LEGACY)) base[k] = build(def, k);

  const cache = new Map();
  const warned = new Set();
  let grey = null;
  function getMaterial(name) {
    if (typeof name !== 'string') name = String(name);
    if (base[name]) return base[name];
    let m = cache.get(name);
    if (m) return m;
    const f = /^(paint|lacquer|stucco):(#?[0-9a-fA-F]{6})$/.exec(name);
    if (f) {
      const hex = '#' + f[2].replace('#', '').toLowerCase();
      const key = f[1] + ':' + hex;
      m = cache.get(key) || (f[1] === 'paint' ? paint(hex) : f[1] === 'stucco' ? stucco(hex) : lacquer(hex));
      cache.set(key, m);
    } else if (DEFS[name]) {
      m = build(DEFS[name], name);
    } else {
      if (!warned.has(name)) { warned.add(name); console.warn(`[materials] unknown material "${name}" → neutral grey`); }
      grey ??= Object.assign(new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.8 }), { name: 'unknown' });
      return grey;
    }
    cache.set(name, m);
    return m;
  }

  // M: legacy keys as own properties; registry/factory names resolve lazily.
  const isKnown = (k) => typeof k === 'string' && (k in DEFS || /^(paint|lacquer|stucco):#?[0-9a-fA-F]{6}$/.test(k));
  const M = new Proxy(base, {
    get(target, key, recv) {
      if (key in target) return Reflect.get(target, key, recv);
      return isKnown(key) ? getMaterial(key) : undefined;
    },
    has(target, key) { return key in target || isKnown(key); },
  });

  const ready = () => Promise.all(pending);
  return { M, T, getMaterial, setNightFactor, ready, want, names: [...Object.keys(LEGACY), ...Object.keys(DEFS)] };
}

export const MATERIAL_NAMES = [...Object.keys(DEFS)];
// The flags getMaterial(name) gives a material, without making it (Node tests, e.g. the bake-area
// selection in scripts/test-bake.mjs must pick exactly the triangles the app picks):
// { known, transparent, alphaTest, noShadow } (unknown names → the app's unpatched grey: known false)
export function materialInfo(name) {
  name = String(name);
  const f = /^(paint|lacquer|stucco):(#?[0-9a-fA-F]{6})$/.exec(name);
  const def = LEGACY[name] || (f ? {} : DEFS[name]);
  if (!def) return { known: false, transparent: false, alphaTest: 0, noShadow: false };
  return { known: true, transparent: def.o !== undefined, alphaTest: def.alphaTest || 0, noShadow: !!def.noShadow, emissive: def.e !== undefined };
}
