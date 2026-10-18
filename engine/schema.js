// The house data contract: defaults, normalisation and friendly validation.
// docs/SCHEMA.md describes every field; this file is the executable version of it.
//
//   normalize(project, zoning, interior) → { PROJECT, Z, INTERIOR }   what the engine reads
//   validate(project, zoning, interior, { furnitureTypes }) → { errors, warnings }
//       each message: { where: 'zoning.rooms[3] (kitchen)', id: '…Bahasa Indonesia…', en: '…English…' }
//
// Pure JavaScript (no three.js, no DOM): used by the browser, the studio pages and every Node script.
//
// Plan coordinates: metres, x → east, y → north, origin = the south-west corner of the plot.
// Room rectangles r = [x0, y0, x1, y1] sit on a 0.5 m grid (walls are generated on that grid).

// ---------------------------------------------------------------- vocabularies
export const ZONES = {
  public:      { label: { id: 'Publik / tamu', en: 'Public / guests' },       color: '#e8d5ae' },
  private:     { label: { id: 'Privat keluarga', en: 'Family (private)' },     color: '#f0c49b' },
  master:      { label: { id: 'Kamar utama', en: 'Master suite' },             color: '#dc9c7e' },
  work:        { label: { id: 'Kerja', en: 'Work / study' },                   color: '#adbd92' },
  hobby:       { label: { id: 'Hobi & hiburan', en: 'Hobby & media' },         color: '#abbfce' },
  service:     { label: { id: 'Servis', en: 'Service' },                       color: '#cdc5b6' },
  circulation: { label: { id: 'Sirkulasi', en: 'Circulation' },                color: '#f4ede1' },
  utility:     { label: { id: 'Utilitas', en: 'Utility' },                     color: '#949fab' },
  garage:      { label: { id: 'Garasi / carport', en: 'Garage / carport' },    color: '#c4bfb7' },
  outdoor:     { label: { id: 'Taman & luar', en: 'Garden & outdoor' },        color: '#d6e3bf' },
  water:       { label: { id: 'Air / kolam', en: 'Water / pool' },             color: '#a6d0de' },
  energy:      { label: { id: 'Energi', en: 'Energy' },                        color: '#f0d46e' },
};

// Room use → default zone, floor material, wall finish, label (spec tab counts bedrooms / baths by use)
export const USES = {
  living:   { zone: 'private', floor: 'wood' },
  family:   { zone: 'private', floor: 'wood' },
  dining:   { zone: 'private', floor: 'wood' },
  kitchen:  { zone: 'private', floor: 'travertine' },
  bedroom:  { zone: 'private', floor: 'wood', bedroom: true },
  master:   { zone: 'master', floor: 'wood', bedroom: true },
  bath:     { zone: 'private', floor: 'tileBath', wet: true },
  wc:       { zone: 'public', floor: 'tileBath', wet: true },
  laundry:  { zone: 'service', floor: 'tileGrey', wet: true },
  study:    { zone: 'work', floor: 'woodDark' },
  foyer:    { zone: 'public', floor: 'travertine' },
  hall:     { zone: 'circulation', floor: 'travertine' },
  stair:    { zone: 'circulation', floor: 'travertine' },
  storage:  { zone: 'service', floor: 'tileGrey' },
  closet:   { zone: 'master', floor: 'wood' },
  garage:   { zone: 'garage', floor: 'concrete' },
  utility:  { zone: 'utility', floor: 'concrete' },
  guest:    { zone: 'public', floor: 'wood', bedroom: true },
  media:    { zone: 'hobby', floor: 'carpet' },
  gym:      { zone: 'hobby', floor: 'rubber' },
  prayer:   { zone: 'private', floor: 'wood' },
  other:    { zone: 'private', floor: 'travertine' },
};

export const OPENING_TYPES = {
  swing:   { door: true,  top: 2.2 },  // single hinged door
  double:  { door: true,  top: 2.4 },  // pair of hinged leaves
  sliding: { door: true,  top: 2.7 },  // glass sliding door (half fixed, half slides)
  folding: { door: true,  top: 2.7 },  // glass bi-fold door
  garage:  { door: true,  top: 2.6 },  // rolling shutter
  opening: { door: true,  top: 2.6 },  // doorway without a leaf
  window:  { door: false },            // sill 0.9 m, head 2.3 m
  glass:   { door: false },            // fixed floor-to-head glass, 0.05–2.7 m
  high:    { door: false },            // high / clerestory window, 2.4–3.2 m (privacy)
};

export const FIXTURE_TYPES = ['counter', 'island', 'partition', 'wc', 'sink', 'shower', 'tub', 'bench', 'plant', 'vine', 'stall', 'solid'];
export const ROOF_TYPES = ['hip', 'gable', 'shed', 'flat'];
export const STAIR_TYPES = ['straight', 'U'];
export const SITE_KINDS = ['lawn', 'paving', 'terrace', 'path', 'driveway', 'parking', 'carport', 'pool', 'court', 'pergola',
  'garden', 'trees', 'tree', 'wall', 'fence', 'hedge', 'gate', 'building', 'water'];
export const OUTDOOR_KINDS = ['balcony', 'roofTerrace'];
export const FEATURES = {
  doors: true, sit: true, lift: true, cars: true, multiplayer: true, spec: true, cost: true,
  bake: false, site: true, garden: true, pv: true, finishes: true, furniture: true,
};
const DIRS = ['n', 's', 'e', 'w'];

// ---------------------------------------------------------------- helpers
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isRect = (r) => Array.isArray(r) && r.length === 4 && r.every(isNum) && r[2] > r[0] && r[3] > r[1];
const onGrid = (v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-6;
const rectArea = (r) => (r[2] - r[0]) * (r[3] - r[1]);
const overlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
const fmt = (r) => `[${r.join(', ')}]`;
const text = (v) => (v == null ? '' : typeof v === 'string' ? v : (v.en ?? v.id ?? Object.values(v)[0] ?? ''));

// ---------------------------------------------------------------- normalise
export function normalize(projectRaw = {}, zoningRaw = {}, interiorRaw = {}, tr = text) {
  const project = projectRaw || {};
  const z = zoningRaw || {};
  const PROJECT = {
    name: project.name || 'house',
    title: project.title || project.name || 'House',
    language: project.language || 'id',
    location: { lat: -6.9, lon: 107.6, region: 'jawa-barat-2026', ...(project.location || {}) },
    features: { ...FEATURES, ...(project.features || {}) },
    style: { exteriorColor: '#efe9df', roof: 'terracotta', facade: 'modern', trim: '#2f2a26', ...(project.style || {}) },
    spec: {
      occupants: 4, kwhPerPersonDay: 3.5, litresPerPersonDay: 150, rainfallMm: 2200, runoff: 0.8,
      peakSunHours: 4.2, pvLosses: 0.8, panelWp: 550, ...(project.spec || {}),
    },
    cost: { region: 'jawa-barat-2026', quality: 'standard', ...(project.cost || {}) },
    start: project.start || null,
    bake: project.bake || null,
    materials: { ...(project.materials || {}) },
  };

  const levels = (z.levels || []).map(l => ({
    id: l.id, names: l.name, name: tr(l.name) || l.id, short: l.short || l.id, sub: tr(l.sub) || '',
    elev: l.elev ?? 0, h: l.h ?? 3.2,
  })).sort((a, b) => a.elev - b.elev);
  const ids = new Set(levels.map(l => l.id));

  const floors = {}, open = {}, openings = {}, fixtures = {}, outdoor = {};
  for (const l of levels) {
    floors[l.id] = (z.rooms?.[l.id] || []).map(r => {
      const use = USES[r.use] ? r.use : 'other';
      return {
        ...r, names: r.name, name: tr(r.name) || r.id, short: tr(r.short) || tr(r.name) || r.id,
        use, zone: r.zone || USES[use].zone, cam: r.cam ?? !(USES[use].wet || USES[use].bedroom), note: tr(r.note) || '',
      };
    });
    open[l.id] = (z.open?.[l.id] || []).map(p => [p[0], p[1]]);
    openings[l.id] = (z.openings?.[l.id] || []).map(o => ({ side: 1, hinge: 's', ...o }));
    fixtures[l.id] = (z.fixtures?.[l.id] || []).map(f => ({ ...f }));
    outdoor[l.id] = (z.outdoor?.[l.id] || []).map(o => ({ ...o, names: o.name, name: tr(o.name) || o.id, zone: o.zone || 'outdoor' }));
  }

  const site = { w: 20, d: 30, road: 's', ...(z.site || {}) };
  site.items = (z.site?.items || []).map(it => ({ ...it, names: it.name, name: tr(it.name) || it.id || it.kind, zone: it.zone || siteZone(it.kind) }));
  site.perimeter = { front: 'wall', sides: 'wall', back: 'wall', h: 1.8, ...(z.site?.perimeter || {}) };

  const levelTop = (id) => { const L = levels.find(l => l.id === id); return L ? L.elev + L.h : 0; };
  const roofs = (z.roofs || []).map((r, i) => {
    const base = typeof r.base === 'number' ? r.base : levelTop(r.on || r.base);
    return {
      id: r.id || `roof${i + 1}`, type: r.type || 'hip', r: r.r, base, pitch: r.pitch ?? 0.45, over: r.over ?? 0.6,
      down: r.down || 's', ridge: r.ridge || null, top: r.top, material: r.material || null, pv: r.pv ?? false,
      parapet: r.parapet ?? (r.type === 'flat' ? 0.4 : 0), thickness: r.thickness ?? 0.25, on: r.on || null,
    };
  });

  const stairs = (z.stairs || []).map((s, i) => ({
    id: s.id || `stair${i + 1}`, type: s.type || 'straight', r: s.r, up: s.up || 'n', from: s.from, to: s.to,
    first: s.first || 'right', landing: s.landing, material: s.material || null, rail: s.rail ?? true,
  }));

  const lift = z.lift && isRect(z.lift.r) ? {
    r: z.lift.r, door: z.lift.door || 'w',
    stops: (z.lift.stops || levels.map(l => l.id)).filter(s => ids.has(s)),
  } : null;

  const Z = {
    version: z.version || '1', date: z.date || '', name: PROJECT.name,
    zones: { ...ZONES, ...(z.zones || {}) },
    levels, floors, open, openings, fixtures, outdoor, site, roofs, stairs, lift,
    // legacy views the engine modules use: every site item, and the garden walls / gates among them
    ground: site.items,
    walls: site.items.filter(it => it.kind === 'wall').map(w => ({ ...w, from: w.from, to: w.to })),
    gates: site.items.filter(it => it.kind === 'gate'),
    notes: z.notes || {},
  };

  const INTERIOR = {
    version: interiorRaw?.version || '1',
    rooms: { ...(interiorRaw?.rooms || {}) },
    areas: { ...(interiorRaw?.areas || {}) },
  };
  return { PROJECT, Z, INTERIOR };
}

function siteZone(kind) {
  if (kind === 'pool' || kind === 'water') return 'water';
  if (kind === 'carport' || kind === 'driveway' || kind === 'parking') return 'garage';
  return 'outdoor';
}

// ---------------------------------------------------------------- validate
// Messages are written for non-programmers: what is wrong, where, and what to do.
export function validate(projectRaw, zoningRaw, interiorRaw, { furnitureTypes = null, furnitureInfo = null, isMaterial = null } = {}) {
  const errors = [], warnings = [];
  const E = (where, id, en) => errors.push({ where, id, en });
  const W = (where, id, en) => warnings.push({ where, id, en });

  // -------- project.json
  const p = projectRaw || {};
  if (!p.name || typeof p.name !== 'string') E('project.json', '"name" wajib diisi (nama folder proyek, mis. "rumah-saya").', '"name" is required (the project folder name, e.g. "my-house").');
  if (p.location && p.location.lat !== undefined && !(isNum(p.location.lat) && Math.abs(p.location.lat) <= 66)) E('project.json location.lat', 'Lintang harus angka antara −66 dan 66 (mis. −6.9 untuk Bandung).', 'Latitude must be a number between −66 and 66 (e.g. −6.9 for Bandung).');
  for (const k of Object.keys(p.features || {})) if (!(k in FEATURES)) W(`project.json features.${k}`, `Fitur "${k}" tidak dikenal (diabaikan). Yang tersedia: ${Object.keys(FEATURES).join(', ')}.`, `Unknown feature "${k}" (ignored). Available: ${Object.keys(FEATURES).join(', ')}.`);
  if (p.language && !['id', 'en'].includes(p.language)) W('project.json language', 'Bahasa harus "id" atau "en".', 'Language must be "id" or "en".');
  // the house's own materials (e.g. a floor texture from the owner's photo)
  const custom = p.materials && typeof p.materials === 'object' ? p.materials : {};
  if (p.materials !== undefined && (typeof p.materials !== 'object' || Array.isArray(p.materials))) E('project.json materials', '"materials" harus objek { nama: { texture, size, color } }.', '"materials" must be an object { name: { texture, size, color } }.');
  for (const [name, m] of Object.entries(custom)) {
    const w = `project.json materials.${name}`;
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) E(w, `Nama material "${name}" hanya boleh huruf dan angka, diawali huruf (mis. "terasoKamarMandi").`, `Material name "${name}" may only use letters and digits, starting with a letter (e.g. "bathTerrazzo").`);
    else if (isMaterial && isMaterial(name)) E(w, `"${name}" sudah dipakai oleh material bawaan. Pilih nama lain (mis. "${name}Ku").`, `"${name}" is already a built-in material. Choose another name (e.g. "my${name[0].toUpperCase() + name.slice(1)}").`);
    if (!m || typeof m !== 'object') { E(w, 'Harus objek, mis. { "texture": "teraso", "size": 0.6 }.', 'Must be an object, e.g. { "texture": "terrazzo", "size": 0.6 }.'); continue; }
    if (m.texture !== undefined && !/^[a-z0-9][a-z0-9-]*$/.test(m.texture)) E(w, `"texture" adalah nama folder di projects/<rumah>/textures/ (huruf kecil, angka, minus).`, `"texture" is a folder name in projects/<house>/textures/ (lowercase, digits, dashes).`);
    if (m.texture !== undefined && !(isNum(m.size) && m.size >= 0.05 && m.size <= 10)) E(w, '"size" = berapa meter yang ditutup satu gambar tekstur (0,05–10), mis. 0.6 untuk ubin 60 cm.', '"size" = how many metres one texture image covers (0.05–10), e.g. 0.6 for a 60 cm tile.');
    if (m.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(m.color)) E(w, '"color" harus #rrggbb.', '"color" must be #rrggbb.');
    if (m.rough !== undefined && !(isNum(m.rough) && m.rough >= 0 && m.rough <= 1)) E(w, '"rough" (kekasaran) harus 0–1.', '"rough" (roughness) must be 0–1.');
    if (m.texture === undefined && m.color === undefined) W(w, 'Tanpa "texture" atau "color" material ini putih polos.', 'Without "texture" or "color" this material is plain white.');
  }
  const matOk = (v) => !isMaterial || isMaterial(v) || !!custom[v];
  if (p.style?.door !== undefined && !matOk(p.style.door)) E('project.json style.door', `"${p.style.door}" bukan nama material (lihat docs/SCHEMA.md "Material names", mis. "walnut", "teak", "lacquer:#f2efe7").`, `"${p.style.door}" is not a material name (see docs/SCHEMA.md "Material names", e.g. "walnut", "teak", "lacquer:#f2efe7").`);
  if (p.style?.roof !== undefined && !matOk(p.style.roof)) E('project.json style.roof', `"${p.style.roof}" bukan material atap. Pilih: terracotta, roofTileDark, roofMetal, roofMetalLight.`, `"${p.style.roof}" is not a roof material. Pick: terracotta, roofTileDark, roofMetal, roofMetalLight.`);

  // -------- zoning.js
  const z = zoningRaw || {};
  if (!Array.isArray(z.levels) || !z.levels.length) {
    E('zoning.levels', 'Belum ada lantai. Tambahkan minimal satu, mis. { id: "L1", name: "Lantai 1", elev: 0.15, h: 3.4 }.', 'No levels yet. Add at least one, e.g. { id: "L1", name: "Ground floor", elev: 0.15, h: 3.4 }.');
    return { errors, warnings };
  }
  const levelIds = new Set();
  for (const [i, l] of z.levels.entries()) {
    const w = `zoning.levels[${i}]${l?.id ? ` (${l.id})` : ''}`;
    if (!l || typeof l.id !== 'string' || !l.id) { E(w, 'Setiap lantai butuh "id" (mis. "L1").', 'Every level needs an "id" (e.g. "L1").'); continue; }
    if (levelIds.has(l.id)) E(w, `Id lantai "${l.id}" dipakai dua kali.`, `Level id "${l.id}" is used twice.`);
    levelIds.add(l.id);
    if (!isNum(l.elev)) E(w, '"elev" (tinggi lantai jadi dari tanah, meter) harus angka, mis. 0.15.', '"elev" (finished floor height above the garden, metres) must be a number, e.g. 0.15.');
    if (!isNum(l.h) || l.h < 2.6 || l.h > 6) E(w, '"h" (tinggi lantai ke lantai) harus antara 2,6 dan 6 m (biasanya 3,2–3,6).', '"h" (floor-to-floor height) must be between 2.6 and 6 m (usually 3.2–3.6).');
  }
  const sorted = [...z.levels].filter(l => isNum(l.elev)).sort((a, b) => a.elev - b.elev);
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1], b = sorted[i];
    if (isNum(a.h) && Math.abs(a.elev + a.h - b.elev) > 0.01) W(`zoning.levels (${a.id} → ${b.id})`,
      `Lantai ${b.id} (elev ${b.elev}) tidak tepat di atas ${a.id} (elev ${a.elev} + h ${a.h} = ${(a.elev + a.h).toFixed(2)}). Biasanya elev lantai atas = elev bawah + h.`,
      `Level ${b.id} (elev ${b.elev}) does not sit right on top of ${a.id} (elev ${a.elev} + h ${a.h} = ${(a.elev + a.h).toFixed(2)}). Usually upper elev = lower elev + h.`);
  }

  const site = z.site || {};
  const siteR = [0, 0, site.w ?? 20, site.d ?? 30];
  if (!isNum(site.w) || !isNum(site.d)) W('zoning.site', 'Ukuran tapak (site.w lebar, site.d dalam, meter) belum diisi; dipakai 20 × 30 m.', 'Plot size (site.w width, site.d depth, metres) is missing; using 20 × 30 m.');

  // rooms
  const rooms = z.rooms || {};
  const allIds = new Map();   // room id → level
  const roomsOf = {};
  for (const lv of Object.keys(rooms)) {
    if (!levelIds.has(lv)) { E(`zoning.rooms.${lv}`, `Ruang-ruang ditaruh di lantai "${lv}" yang tidak ada di levels.`, `Rooms are listed under level "${lv}", which is not in levels.`); continue; }
    roomsOf[lv] = [];
    for (const [i, r] of (rooms[lv] || []).entries()) {
      const w = `zoning.rooms.${lv}[${i}]${r?.id ? ` (${r.id})` : ''}`;
      if (!r || typeof r.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(r.id)) { E(w, 'Setiap ruang butuh "id" pendek tanpa spasi (mis. "kamar1").', 'Every room needs a short "id" without spaces (e.g. "bedroom1").'); continue; }
      if (allIds.has(r.id)) E(w, `Id ruang "${r.id}" sudah dipakai (di ${allIds.get(r.id)}). Setiap id harus unik di seluruh rumah.`, `Room id "${r.id}" is already used (on ${allIds.get(r.id)}). Ids must be unique in the whole house.`);
      allIds.set(r.id, lv);
      if (!r.name) W(w, 'Ruang belum punya "name" (nama yang tampil).', 'Room has no "name" (the label people see).');
      if (r.use && !USES[r.use]) W(w, `"use": "${r.use}" tidak dikenal; pakai salah satu: ${Object.keys(USES).join(', ')}.`, `"use": "${r.use}" is unknown; use one of: ${Object.keys(USES).join(', ')}.`);
      if (!r.use) W(w, `Ruang belum punya "use" (mis. "bedroom", "bath", "kitchen"). Dipakai untuk finishing & spec.`, 'Room has no "use" (e.g. "bedroom", "bath", "kitchen"). It drives default finishes and the spec tab.');
      if (r.zone && !ZONES[r.zone] && !(z.zones || {})[r.zone]) W(w, `Zona "${r.zone}" tidak dikenal.`, `Zone "${r.zone}" is unknown.`);
      if (!isRect(r.r)) { E(w, '"r" harus [x0, y0, x1, y1] dengan x1 > x0 dan y1 > y0 (meter).', '"r" must be [x0, y0, x1, y1] with x1 > x0 and y1 > y0 (metres).'); continue; }
      if (!r.r.every(onGrid)) E(w, `Sudut ruang ${fmt(r.r)} harus kelipatan 0,5 m (dinding dibuat di grid 0,5 m). Bulatkan, mis. 3.25 → 3.0 atau 3.5.`, `Room corners ${fmt(r.r)} must be multiples of 0.5 m (walls are generated on a 0.5 m grid). Round them, e.g. 3.25 → 3.0 or 3.5.`);
      const wdt = r.r[2] - r.r[0], dep = r.r[3] - r.r[1];
      if (Math.min(wdt, dep) < 1) W(w, `Ruang sangat sempit (${wdt} × ${dep} m).`, `Room is very narrow (${wdt} × ${dep} m).`);
      if (r.r[0] < siteR[0] || r.r[1] < siteR[1] || r.r[2] > siteR[2] || r.r[3] > siteR[3]) E(w, `Ruang ${fmt(r.r)} keluar dari batas tapak ${fmt(siteR)}.`, `Room ${fmt(r.r)} lies outside the plot ${fmt(siteR)}.`);
      roomsOf[lv].push(r);
    }
    const list = roomsOf[lv];
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      if (!isRect(list[a].r) || !isRect(list[b].r)) continue;
      const ov = overlap(list[a].r, list[b].r);
      if (ov > 1e-6) E(`zoning.rooms.${lv}`, `Ruang "${list[a].id}" dan "${list[b].id}" bertumpuk (${ov.toFixed(2)} m²). Ruang di satu lantai tidak boleh tumpang tindih.`, `Rooms "${list[a].id}" and "${list[b].id}" overlap (${ov.toFixed(2)} m²). Rooms on one level must not overlap.`);
    }
  }
  for (const lv of levelIds) if (!roomsOf[lv]?.length) W(`zoning.rooms.${lv}`, `Lantai ${lv} belum punya ruang.`, `Level ${lv} has no rooms yet.`);

  // shared-edge test for open pairs and openings
  const edgeShared = (a, b) => {
    const [ax0, ay0, ax1, ay1] = a.r, [bx0, by0, bx1, by1] = b.r;
    const vx = (Math.abs(ax1 - bx0) < 1e-6 || Math.abs(bx1 - ax0) < 1e-6) && Math.min(ay1, by1) - Math.max(ay0, by0) > 1e-6;
    const hy = (Math.abs(ay1 - by0) < 1e-6 || Math.abs(by1 - ay0) < 1e-6) && Math.min(ax1, bx1) - Math.max(ax0, bx0) > 1e-6;
    return vx || hy;
  };
  for (const lv of Object.keys(z.open || {})) {
    for (const [i, pair] of (z.open[lv] || []).entries()) {
      const w = `zoning.open.${lv}[${i}]`;
      if (!Array.isArray(pair) || pair.length !== 2) { E(w, 'Pasangan open-plan ditulis ["ruangA", "ruangB"].', 'An open-plan pair is written ["roomA", "roomB"].'); continue; }
      const [a, b] = pair.map(id => (roomsOf[lv] || []).find(r => r.id === id));
      if (!a || !b) { E(w, `Ruang ${pair.filter((id, k) => ![a, b][k]).join(', ')} tidak ada di lantai ${lv}.`, `Room(s) ${pair.filter((id, k) => ![a, b][k]).join(', ')} not found on level ${lv}.`); continue; }
      if (isRect(a.r) && isRect(b.r) && !edgeShared(a, b)) E(w, `"${a.id}" dan "${b.id}" tidak bersebelahan, jadi tidak bisa open-plan.`, `"${a.id}" and "${b.id}" do not touch, so they cannot be open-plan.`);
    }
  }

  // openings: on a room edge of that level
  for (const lv of Object.keys(z.openings || {})) {
    const list = roomsOf[lv] || [];
    const seen = [];
    for (const [i, o] of (z.openings[lv] || []).entries()) {
      const w = `zoning.openings.${lv}[${i}]`;
      if (!o || !['h', 'v'].includes(o.o)) { E(w, '"o" harus "h" (dinding mendatar, sejajar sumbu x) atau "v" (dinding tegak, sejajar sumbu y).', '"o" must be "h" (horizontal wall, along x) or "v" (vertical wall, along y).'); continue; }
      if (!OPENING_TYPES[o.t]) { E(w, `Jenis bukaan "${o.t}" tidak dikenal. Pilih: ${Object.keys(OPENING_TYPES).join(', ')}.`, `Opening type "${o.t}" is unknown. Pick one of: ${Object.keys(OPENING_TYPES).join(', ')}.`); continue; }
      if (!isNum(o.x) || !isNum(o.y) || !isNum(o.w) || o.w <= 0.3) { E(w, 'Bukaan butuh x, y (angka) dan lebar w > 0,3 m.', 'An opening needs numbers x, y and a width w > 0.3 m.'); continue; }
      const fixed = o.o === 'h' ? o.y : o.x, a0 = o.o === 'h' ? o.x : o.y, a1 = a0 + o.w;
      let covered = 0;
      const sides = [];
      for (const r of list) {
        if (!isRect(r.r)) continue;
        const [x0, y0, x1, y1] = r.r;
        const on = o.o === 'h' ? (Math.abs(y0 - fixed) < 1e-6 || Math.abs(y1 - fixed) < 1e-6) : (Math.abs(x0 - fixed) < 1e-6 || Math.abs(x1 - fixed) < 1e-6);
        if (!on) continue;
        const s0 = o.o === 'h' ? x0 : y0, s1 = o.o === 'h' ? x1 : y1;
        const c = Math.min(a1, s1) - Math.max(a0, s0);
        if (c > 1e-6) { covered = Math.max(covered, c); sides.push(r.id); }
      }
      if (!sides.length) E(w, `Bukaan ${o.t} di ${o.o === 'h' ? 'y' : 'x'} = ${fixed} tidak berada di tepi ruang mana pun di ${lv}. Bukaan harus tepat di garis dinding (tepi ruang).`, `The ${o.t} at ${o.o === 'h' ? 'y' : 'x'} = ${fixed} is not on any room edge of ${lv}. Openings must sit exactly on a wall line (a room edge).`);
      else if (covered < o.w - 0.01) W(w, `Bukaan ${o.t} (${o.o === 'h' ? 'x' : 'y'} ${a0}–${a1.toFixed(2)}) sebagian keluar dari dinding ruang ${sides.join('/')}.`, `The ${o.t} (${o.o === 'h' ? 'x' : 'y'} ${a0}–${a1.toFixed(2)}) partly runs past the wall of ${sides.join('/')}.`);
      if (['swing'].includes(o.t) && o.hinge && !['s', 'e'].includes(o.hinge)) E(w, '"hinge" harus "s" (engsel di ujung awal) atau "e" (ujung akhir).', '"hinge" must be "s" (hinge at the start end) or "e" (at the end).');
      if (o.side !== undefined && o.side !== 1 && o.side !== -1) E(w, '"side" harus 1 atau -1 (arah daun pintu membuka).', '"side" must be 1 or -1 (the way the leaf swings).');
      for (const s of seen) if (s.o === o.o && Math.abs(s.f - fixed) < 1e-6 && Math.min(s.a1, a1) - Math.max(s.a0, a0) > 0.01)
        E(w, `Bukaan ini menumpuk dengan bukaan lain di garis dinding yang sama (${o.o === 'h' ? 'y' : 'x'} = ${fixed}).`, `This opening overlaps another one on the same wall line (${o.o === 'h' ? 'y' : 'x'} = ${fixed}).`);
      seen.push({ o: o.o, f: fixed, a0, a1 });
    }
  }
  // doors: every room should be reachable
  const reach = reachability(z, roomsOf);
  for (const [lv, list] of Object.entries(roomsOf)) for (const r of list) {
    if (!reach.has(r.id)) W(`zoning.rooms.${lv} (${r.id})`, `Ruang "${r.id}" tidak punya pintu/bukaan atau sambungan open-plan, jadi tidak bisa dimasuki.`, `Room "${r.id}" has no door, opening or open-plan link, so nobody can get in.`);
  }

  // fixtures
  for (const lv of Object.keys(z.fixtures || {})) for (const [i, f] of (z.fixtures[lv] || []).entries())
    if (!FIXTURE_TYPES.includes(f?.t)) W(`zoning.fixtures.${lv}[${i}]`, `Fixture "${f?.t}" tidak dikenal (diabaikan). Pilih: ${FIXTURE_TYPES.join(', ')}.`, `Fixture "${f?.t}" is unknown (ignored). Pick one of: ${FIXTURE_TYPES.join(', ')}.`);

  // stairs
  for (const [i, s] of (z.stairs || []).entries()) {
    const w = `zoning.stairs[${i}]${s?.id ? ` (${s.id})` : ''}`;
    if (!STAIR_TYPES.includes(s?.type || 'straight')) E(w, `Jenis tangga "${s.type}" tidak dikenal. Pilih: ${STAIR_TYPES.join(', ')}.`, `Stair type "${s.type}" is unknown. Pick one of: ${STAIR_TYPES.join(', ')}.`);
    if (!isRect(s?.r)) { E(w, 'Tangga butuh "r" [x0, y0, x1, y1].', 'A stair needs "r" [x0, y0, x1, y1].'); continue; }
    if (!DIRS.includes(s.up || 'n')) E(w, '"up" (arah naik anak tangga pertama) harus "n", "s", "e" atau "w".', '"up" (the direction the first flight climbs) must be "n", "s", "e" or "w".');
    const A = z.levels.find(l => l.id === s.from), B = z.levels.find(l => l.id === s.to);
    if (!A || !B) { E(w, `"from" / "to" harus id lantai yang ada (${[...levelIds].join(', ')}).`, `"from" / "to" must be existing level ids (${[...levelIds].join(', ')}).`); continue; }
    if (!(B.elev > A.elev)) { E(w, `"to" (${B.id}) harus lebih tinggi dari "from" (${A.id}).`, `"to" (${B.id}) must be higher than "from" (${A.id}).`); continue; }
    const rise = B.elev - A.elev;
    const len = ['n', 's'].includes(s.up || 'n') ? s.r[3] - s.r[1] : s.r[2] - s.r[0];
    const wid = ['n', 's'].includes(s.up || 'n') ? s.r[2] - s.r[0] : s.r[3] - s.r[1];
    const nFlights = (s.type || 'straight') === 'U' ? 2 : 1;
    const flightLen = nFlights === 2 ? len - (s.landing ?? Math.max(1.0, (wid - 0.1) / 2)) : len;
    const risers = Math.max(2, Math.round(rise / nFlights / 0.17));
    const going = flightLen / risers;
    if (nFlights === 2 && wid < 2.0) E(w, `Tangga U butuh lebar minimal 2,0 m (dua lajur + dinding tengah); sekarang ${wid.toFixed(2)} m.`, `A U stair needs at least 2.0 m width (two flights + a thin wall); now ${wid.toFixed(2)} m.`);
    if (nFlights === 1 && wid < 0.8) E(w, `Tangga terlalu sempit (${wid.toFixed(2)} m, minimal 0,8 m).`, `Stair too narrow (${wid.toFixed(2)} m, at least 0.8 m).`);
    if (going < 0.22) E(w, `Tangga terlalu curam: injakan ${(going * 100).toFixed(0)} cm per anak tangga (minimal ±25 cm). Panjangkan "r" ke arah naik.`, `Stair too steep: ${(going * 100).toFixed(0)} cm per tread (aim for ≥ 25 cm). Make "r" longer in the climbing direction.`);
    else if (going < 0.25) W(w, `Tangga agak curam (injakan ${(going * 100).toFixed(0)} cm).`, `Stair is a bit steep (${(going * 100).toFixed(0)} cm treads).`);
    const inFrom = (roomsOf[s.from] || []).some(r => isRect(r.r) && overlap(r.r, s.r) > rectArea(s.r) * 0.95);
    if (!inFrom) W(w, `Tangga ${fmt(s.r)} tidak sepenuhnya berada di dalam satu ruang lantai ${s.from}.`, `Stair ${fmt(s.r)} is not fully inside one room of ${s.from}.`);
    // the foot (just before the first step) must be on the `from` floor, the arrival on the `to` floor
    {
      const up = s.up || 'n', [x0, y0, x1, y1] = s.r;
      const P = { n: (q, t) => [x0 + t, y0 + q], s: (q, t) => [x1 - t, y1 - q], e: (q, t) => [x0 + q, y1 - t], w: (q, t) => [x1 - q, y0 + t] }[up] || ((q, t) => [x0 + t, y0 + q]);
      const U = (s.type || 'straight') === 'U', fw = (wid - 0.1) / 2, right = s.first !== 'left';
      const footT = U ? (right ? wid - fw / 2 : fw / 2) : wid / 2, topT = U ? (right ? fw / 2 : wid - fw / 2) : wid / 2;
      const foot = P(-0.5, footT), top = U ? P(-0.5, topT) : P(len + 0.5, topT);
      const inside = (lv, p) => (roomsOf[lv] || []).some(r => isRect(r.r) && p[0] > r.r[0] && p[0] < r.r[2] && p[1] > r.r[1] && p[1] < r.r[3]);
      if (!inside(s.from, foot)) E(w, `Kaki tangga (titik ${foot.map(v => v.toFixed(2)).join(', ')}) tidak berada di ruang lantai ${s.from}: orang tidak bisa mulai naik. Ubah "up"/"first" atau geser tangga.`, `The foot of the stair (point ${foot.map(v => v.toFixed(2)).join(', ')}) is not inside a room of ${s.from}: nobody can start climbing. Change "up"/"first" or move the stair.`);
      if (!inside(s.to, top)) E(w, `Ujung atas tangga (titik ${top.map(v => v.toFixed(2)).join(', ')}) tidak berada di ruang lantai ${s.to}: tangga tiba di dinding atau udara.`, `The top of the stair (point ${top.map(v => v.toFixed(2)).join(', ')}) is not inside a room of ${s.to}: the stair arrives in a wall or mid-air.`);
    }
    const inTo = (roomsOf[s.to] || []).some(r => isRect(r.r) && overlap(r.r, s.r) > 1e-6);
    if (!inTo) E(w, `Di atas tangga (lantai ${s.to}) tidak ada ruang tempat tangga tiba.`, `There is no room on ${s.to} above the stair for it to arrive in.`);
  }

  // lift
  if (z.lift) {
    const w = 'zoning.lift';
    if (!isRect(z.lift.r)) E(w, 'Lift butuh "r" [x0, y0, x1, y1] (minimal ±1,3 × 1,5 m).', 'A lift needs "r" [x0, y0, x1, y1] (at least ±1.3 × 1.5 m).');
    else {
      const [a, b] = [z.lift.r[2] - z.lift.r[0], z.lift.r[3] - z.lift.r[1]];
      if (Math.min(a, b) < 1.2) E(w, `Shaft lift terlalu kecil (${a} × ${b} m).`, `Lift shaft too small (${a} × ${b} m).`);
    }
    if (z.lift.door && !DIRS.includes(z.lift.door)) E(w, '"door" (sisi pintu lift) harus "n", "s", "e" atau "w".', '"door" (the lift door side) must be "n", "s", "e" or "w".');
    for (const s of z.lift.stops || []) if (!levelIds.has(s)) E(w, `Pemberhentian lift "${s}" bukan id lantai.`, `Lift stop "${s}" is not a level id.`);
  }

  // roofs
  for (const [i, r] of (z.roofs || []).entries()) {
    const w = `zoning.roofs[${i}]${r?.id ? ` (${r.id})` : ''}`;
    if (!ROOF_TYPES.includes(r?.type || 'hip')) E(w, `Jenis atap "${r.type}" tidak dikenal. Pilih: ${ROOF_TYPES.join(', ')}.`, `Roof type "${r.type}" is unknown. Pick one of: ${ROOF_TYPES.join(', ')}.`);
    if (!isRect(r?.r)) E(w, 'Atap butuh "r" [x0, y0, x1, y1] (bidang di bawah atap, tanpa overstek).', 'A roof needs "r" [x0, y0, x1, y1] (the area under it, without the overhang).');
    if (r && typeof r.base !== 'number' && !levelIds.has(r.on || r.base)) E(w, 'Atap butuh "on": id lantai yang ditutupinya (tepi atap = puncak dinding lantai itu) atau "base": tinggi tepi atap (m).', 'A roof needs "on": the level it covers (eaves = top of that level\'s walls) or "base": the eave height (m).');
    if (r?.pitch !== undefined && !(isNum(r.pitch) && r.pitch >= 0 && r.pitch <= 1.5)) E(w, '"pitch" (kemiringan = naik/datar, mis. 0,45 ≈ 24°) harus antara 0 dan 1,5.', '"pitch" (rise/run, e.g. 0.45 ≈ 24°) must be between 0 and 1.5.');
  }
  // every room needs something over it: the floor above or a roof
  const lvSorted = sorted.map(l => l.id);
  for (const [k, lv] of lvSorted.entries()) {
    const above = lvSorted.slice(k + 1).flatMap(id => roomsOf[id] || []);
    for (const r of roomsOf[lv] || []) {
      if (!isRect(r.r)) continue;
      const cx = (r.r[0] + r.r[2]) / 2, cy = (r.r[1] + r.r[3]) / 2;
      const inR = (q) => q && cx > q[0] - 1e-6 && cx < q[2] + 1e-6 && cy > q[1] - 1e-6 && cy < q[3] + 1e-6;
      const covered = above.some(q => inR(q.r)) || (z.roofs || []).some(q => inR(q.r)) || (z.outdoor?.[lvSorted[k + 1]] || []).some(q => inR(q.r));
      if (!covered && (lv === lvSorted[lvSorted.length - 1] || true)) {
        if (!above.some(q => inR(q.r)) && !(z.roofs || []).some(q => inR(q.r)))
          W(`zoning.rooms.${lv} (${r.id})`, `Tidak ada atap atau lantai di atas ruang "${r.id}". Tambahkan atap di "roofs".`, `Nothing covers room "${r.id}" (no roof, no floor above). Add a roof in "roofs".`);
      }
    }
  }

  // site items
  for (const [i, it] of (site.items || []).entries()) {
    const w = `zoning.site.items[${i}]${it?.id ? ` (${it.id})` : ''}`;
    if (!SITE_KINDS.includes(it?.kind)) { E(w, `Jenis elemen tapak "${it?.kind}" tidak dikenal. Pilih: ${SITE_KINDS.join(', ')}.`, `Site item kind "${it?.kind}" is unknown. Pick one of: ${SITE_KINDS.join(', ')}.`); continue; }
    const linear = ['wall', 'fence', 'hedge', 'gate'].includes(it.kind);
    if (linear) {
      if (!Array.isArray(it.from) || !Array.isArray(it.to)) E(w, `"${it.kind}" butuh "from": [x, y] dan "to": [x, y].`, `"${it.kind}" needs "from": [x, y] and "to": [x, y].`);
      else if (it.from[0] !== it.to[0] && it.from[1] !== it.to[1]) E(w, `"${it.kind}" harus lurus mendatar atau tegak (x sama atau y sama).`, `"${it.kind}" must run straight along x or y (same x or same y).`);
    } else if (it.kind === 'tree') {
      if (!Array.isArray(it.c) || it.c.length < 2) E(w, 'Pohon butuh "c": [x, y, skala].', 'A tree needs "c": [x, y, scale].');
    } else if (!isRect(it.r)) E(w, `"${it.kind}" butuh "r" [x0, y0, x1, y1].`, `"${it.kind}" needs "r" [x0, y0, x1, y1].`);
    else if (it.r[0] < -0.01 || it.r[1] < -0.01 || it.r[2] > siteR[2] + 0.01 || it.r[3] > siteR[3] + 0.01) W(w, `Elemen ${fmt(it.r)} keluar dari tapak ${fmt(siteR)}.`, `Item ${fmt(it.r)} lies outside the plot ${fmt(siteR)}.`);
  }
  for (const lv of Object.keys(z.outdoor || {})) for (const [i, o] of (z.outdoor[lv] || []).entries())
    if (!OUTDOOR_KINDS.includes(o?.kind)) E(`zoning.outdoor.${lv}[${i}]`, `Jenis "${o?.kind}" tidak dikenal. Pilih: ${OUTDOOR_KINDS.join(', ')}.`, `Kind "${o?.kind}" is unknown. Pick one of: ${OUTDOOR_KINDS.join(', ')}.`);

  // -------- interior.js
  const I = interiorRaw || {};
  const siteIds = new Set((site.items || []).map(it => it.id).filter(Boolean));
  for (const [key, entry] of Object.entries({ ...(I.rooms || {}), ...(I.areas || {}) })) {
    const w = `interior ${key}`;
    const isRoom = allIds.has(key);
    if (!isRoom && !(I.areas || {})[key]) E(w, `"${key}" bukan id ruang. Furnitur di luar ruang ditaruh di "areas" (mis. carport).`, `"${key}" is not a room id. Furniture outside rooms goes under "areas" (e.g. a carport).`);
    if ((I.areas || {})[key] && !siteIds.has(key) && !entry.level) W(w, `Area "${key}" tidak cocok dengan id elemen tapak; dianggap di permukaan tanah.`, `Area "${key}" does not match a site item id; assumed to be at garden level.`);
    for (const [j, it] of (entry.items || []).entries()) {
      const wi = `${w} items[${j}]${it?.type ? ` (${it.type})` : ''}`;
      if (!it || typeof it.type !== 'string') { E(wi, 'Setiap barang butuh "type".', 'Every item needs a "type".'); continue; }
      if (furnitureTypes && !furnitureTypes.has(it.type)) E(wi, `Jenis furnitur "${it.type}" tidak ada. Lihat daftar di docs/SCHEMA.md (Furniture catalogue).`, `Furniture type "${it.type}" does not exist. See the list in docs/SCHEMA.md (Furniture catalogue).`);
      if (!isNum(it.x) || !isNum(it.y)) E(wi, 'Barang butuh posisi "x" dan "y" (meter, koordinat denah).', 'An item needs a position "x" and "y" (metres, plan coordinates).');
      if (it.rot !== undefined && !isNum(it.rot)) E(wi, '"rot" harus angka derajat (0 = menghadap utara, 90 = timur, 180 = selatan, 270 = barat).', '"rot" must be degrees (0 = faces north, 90 = east, 180 = south, 270 = west).');
      if (isRoom && furnitureInfo && isNum(it.x) && isNum(it.y)) {
        const lv = allIds.get(key), r = (roomsOf[lv] || []).find(q => q.id === key)?.r;
        const info = furnitureInfo(it.type, it);
        if (r && info && info.mount === 'floor') {
          const pad = 0.05;
          if (it.x < r[0] - pad || it.x > r[2] + pad || it.y < r[1] - pad || it.y > r[3] + pad)
            E(wi, `Titik tengah barang (${it.x}, ${it.y}) berada di luar ruang ${key} ${fmt(r)}.`, `The item's centre (${it.x}, ${it.y}) is outside room ${key} ${fmt(r)}.`);
        }
      }
    }
  }
  return { errors, warnings };
}

// Room ids reachable through doors / openings / open-plan pairs / stairs from outside
function reachability(z, roomsOf) {
  const reach = new Set();
  const adj = new Map();
  const link = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); if (!adj.has(b)) adj.set(b, new Set()); adj.get(a).add(b); adj.get(b).add(a); };
  for (const [lv, pairs] of Object.entries(z.open || {})) for (const p of pairs || []) if (Array.isArray(p)) link(p[0], p[1]);
  for (const [lv, ops] of Object.entries(z.openings || {})) {
    const list = roomsOf[lv] || [];
    for (const o of ops || []) {
      if (!o || !OPENING_TYPES[o.t]?.door) continue;
      const fixed = o.o === 'h' ? o.y : o.x, mid = (o.o === 'h' ? o.x : o.y) + o.w / 2;
      const p1 = o.o === 'h' ? [mid, fixed + 0.1] : [fixed + 0.1, mid], p2 = o.o === 'h' ? [mid, fixed - 0.1] : [fixed - 0.1, mid];
      const at = (p) => list.find(r => isRect(r.r) && p[0] > r.r[0] && p[0] < r.r[2] && p[1] > r.r[1] && p[1] < r.r[3]);
      const a = at(p1), b = at(p2);
      if (a && b) link(a.id, b.id);
      else if (a || b) link((a || b).id, '__outside');
    }
  }
  for (const s of z.stairs || []) {
    if (!isRect(s?.r)) continue;
    const c = [(s.r[0] + s.r[2]) / 2, (s.r[1] + s.r[3]) / 2];
    const at = (lv) => (roomsOf[lv] || []).find(r => isRect(r.r) && overlap(r.r, s.r) > 1e-6);
    const a = (roomsOf[s.from] || []).find(r => isRect(r.r) && c[0] > r.r[0] && c[0] < r.r[2] && c[1] > r.r[1] && c[1] < r.r[3]), b = at(s.to);
    if (a && b) link(a.id, b.id);
  }
  if (z.lift) {
    const ids = (z.lift.stops || []).map(lv => (roomsOf[lv] || []).find(r => isRect(r.r) && overlap(r.r, z.lift.r) > 1e-6 || touches(r.r, z.lift.r))).filter(Boolean).map(r => r.id);
    for (let i = 1; i < ids.length; i++) link(ids[0], ids[i]);
  }
  const queue = ['__outside'];
  while (queue.length) {
    const k = queue.pop();
    for (const n of adj.get(k) || []) if (!reach.has(n)) { reach.add(n); queue.push(n); }
  }
  return reach;
}
const touches = (a, b) => isRect(a) && isRect(b) && a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
