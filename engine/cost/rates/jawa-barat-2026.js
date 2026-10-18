// Unit rates: West Java (Bandung / Bogor / Bekasi area), 2026, a normal family house built by a
// small-to-medium contractor. Rupiah (IDR), excluding PPN; contractor overhead & profit included in
// the rates. Baseline = 'standard' quality; QUALITY multiplies each rate by (1 + qs × (m − 1)), so an
// item with qs 0 (earthworks, permits) costs the same at every quality and qs 1 scales fully.
// These are ESTIMATES from typical 2025–2026 market prices (contractor price lists, material shop
// prices, published per-m² building costs). Ask local contractors for real quotes.
//
// Item format (docs/SCHEMA.md "Cost estimate"):
//   { id, n: { id, en }, u: unit, q: (Q, A) => quantity, r: rate (IDR / unit), qs: quality sensitivity 0..1,
//     lv: where it is built — 'gfa' (spread over the floors by area) | 'ground' | 'upper' | 'site' | a level id,
//     reg: false = not scaled by the regional index (e.g. national tariffs) }
// Q is engine/cost/quantities.js computeQuantities(); A the assumptions (quality, region index, …).
const S = (Q, k) => Q.site[k] || 0;
const O = (Q, t, k = 'n') => (Q.openings[t] || {})[k] || 0;
const F = (Q, ...mats) => mats.reduce((s, m) => s + (Q.finishes.floor[m] || 0), 0);
const R = (Q, ...mats) => mats.reduce((s, m) => s + (Q.roofs.byMaterial[m] || 0), 0);
const pitched = (Q) => Q.roofs.sloped - (Q.roofs.byType.flat?.sloped || 0);

export default {
  id: 'jawa-barat-2026',
  name: { id: 'Jawa Barat 2026', en: 'West Java 2026' },
  currency: 'IDR',
  locale: 'id-ID',
  note: {
    id: 'Harga satuan perkiraan pasar Jawa Barat 2026 (Bandung/Bogor/Bekasi), kontraktor kecil–menengah, sudah termasuk overhead & keuntungan kontraktor, belum PPN.',
    en: 'Estimated 2026 West Java market unit rates (Bandung/Bogor/Bekasi), small-to-medium contractor, contractor overhead & profit included, excluding VAT (PPN).',
  },
  QUALITY: {
    standard: { label: { id: 'Standar', en: 'Standard' }, m: 1.0 },
    premium: { label: { id: 'Premium', en: 'Premium' }, m: 1.4 },
    luxury: { label: { id: 'Mewah', en: 'Luxury' }, m: 2.0 },
  },
  DEFAULTS: { quality: 'standard', region: 1.0, fee: 5, cont: 10, ppn: 11, range: 15 },
  // design & engineering fee (% of construction, A.fee) is split like this
  FEES: [
    { n: { id: 'Desain arsitektur & gambar kerja', en: 'Architectural design & working drawings' }, share: 0.6 },
    { n: { id: 'Struktur & MEP (perhitungan, gambar)', en: 'Structural & MEP engineering' }, share: 0.25 },
    { n: { id: 'Pengawasan berkala', en: 'Periodic site supervision' }, share: 0.15 },
  ],
  // permits & connections: fixed amounts (r) or per m² of GFA (perM2)
  PERMITS: [
    { n: { id: 'PBG + SLF (retribusi, gambar, konsultan perizinan)', en: 'Building permit PBG + SLF (levy, drawings, permit consultant)' }, r: 12e6, perM2: 25000 },
    { n: { id: 'Sambungan PLN 5.500 VA', en: 'Electricity connection (PLN 5,500 VA)' }, r: 9e6, reg: false },
    { n: { id: 'Sambungan air (PDAM) atau sumur bor', en: 'Water connection (PDAM) or borewell' }, r: 14e6 },
  ],
  CATEGORIES: [
    { id: 'prep', name: { id: 'Persiapan & pekerjaan tanah', en: 'Preparation & earthworks' }, items: [
      { id: 'mob', n: { id: 'Mobilisasi, bouwplank, gudang & air/listrik kerja', en: 'Mobilisation, setting-out, site store, temporary water & power' }, u: 'm²', q: Q => Q.gfa, r: 95000, qs: 0.1, lv: 'gfa' },
      { id: 'clear', n: { id: 'Pembersihan & perataan tapak', en: 'Site clearing & levelling' }, u: 'm²', q: Q => S(Q, 'area'), r: 15000, qs: 0, lv: 'site' },
      { id: 'dig', n: { id: 'Galian & urugan pondasi, urugan sirtu bawah lantai', en: 'Foundation excavation & backfill, sub-base under the ground slab' }, u: 'm²', q: Q => Q.footprint, r: 120000, qs: 0, lv: 'ground' },
      { id: 'termite', n: { id: 'Anti rayap', en: 'Termite treatment' }, u: 'm²', q: Q => Q.footprint, r: 35000, qs: 0, lv: 'ground' },
    ] },
    { id: 'structure', name: { id: 'Pondasi & struktur', en: 'Foundation & structure' }, items: [
      { id: 'found', n: { id: 'Pondasi footplat/batu kali + sloof + pelat lantai dasar', en: 'Pad / strip footings + ground beams + ground-floor slab' }, u: 'm²', q: Q => Q.footprint, r: 1150000, qs: 0.15, lv: 'ground' },
      { id: 'frame1', n: { id: 'Kolom, balok & ring balok lantai dasar', en: 'Ground-floor columns, beams & ring beams' }, u: 'm²', q: Q => Q.footprint, r: 520000, qs: 0.15, lv: 'ground' },
      { id: 'frameUp', n: { id: 'Pelat lantai, kolom & balok lantai atas (beton bertulang)', en: 'Upper floors: slab, columns & beams (reinforced concrete)' }, u: 'm²', q: Q => Q.upperArea, r: 1650000, qs: 0.15, lv: 'upper' },
      { id: 'stair', n: { id: 'Tangga beton (per lajur)', en: 'Concrete stair (per flight)' }, u: 'flight', q: Q => Q.stairs.flights, r: 14e6, qs: 0.3, lv: 'ground' },
      { id: 'balcony', n: { id: 'Pelat balkon kantilever + waterproofing', en: 'Cantilever balcony slab + waterproofing' }, u: 'm²', q: Q => Q.balconies, r: 1900000, qs: 0.2, lv: 'upper' },
      { id: 'lift', n: { id: 'Shaft lift (per pemberhentian)', en: 'Lift shaft (per stop)' }, u: 'stop', q: Q => Q.lift.stops, r: 45e6, qs: 0.1, lv: 'gfa' },
    ] },
    { id: 'walls', name: { id: 'Dinding', en: 'Walls' }, items: [
      { id: 'ext', n: { id: 'Dinding luar bata ringan + plester + aci + cat eksterior (netto bukaan)', en: 'Exterior walls: AAC block + render + skim + exterior paint (net of openings)' }, u: 'm²', q: Q => Q.walls.extArea, r: 435000, qs: 0.35, lv: 'gfa' },
      { id: 'int', n: { id: 'Dinding dalam bata ringan + plester + aci (netto bukaan)', en: 'Interior walls: AAC block + render + skim (net of openings)' }, u: 'm²', q: Q => Q.walls.intArea, r: 320000, qs: 0.25, lv: 'gfa' },
    ] },
    { id: 'roof', name: { id: 'Atap', en: 'Roof' }, items: [
      { id: 'frame', n: { id: 'Rangka atap baja ringan + reng (bidang miring)', en: 'Light-steel roof trusses + battens (sloped area)' }, u: 'm²', q: Q => pitched(Q), r: 235000, qs: 0.25, lv: 'gfa' },
      { id: 'tileDark', n: { id: 'Genteng beton/keramik abu gelap + nok + underlayment', en: 'Charcoal concrete / ceramic tiles + ridges + underlay' }, u: 'm²', q: Q => R(Q, 'roofTileDark'), r: 215000, qs: 0.6, lv: 'gfa' },
      { id: 'terracotta', n: { id: 'Genteng tanah liat/terakota + nok + underlayment', en: 'Clay / terracotta tiles + ridges + underlay' }, u: 'm²', q: Q => R(Q, 'terracotta'), r: 265000, qs: 0.6, lv: 'gfa' },
      { id: 'metal', n: { id: 'Atap metal (spandek/standing seam) + insulasi', en: 'Metal roofing (standing seam) + insulation' }, u: 'm²', q: Q => R(Q, 'roofMetal', 'roofMetalLight'), r: 185000, qs: 0.6, lv: 'gfa' },
      { id: 'flat', n: { id: 'Atap dak beton + waterproofing + screed', en: 'Flat concrete roof + waterproofing + screed' }, u: 'm²', q: Q => R(Q, 'flatSlab'), r: 1250000, qs: 0.2, lv: 'gfa' },
      { id: 'soffit', n: { id: 'Lisplang, talang & plafon overstek', en: 'Fascia, gutters & eave soffit' }, u: 'm²', q: Q => Q.roofs.soffit, r: 260000, qs: 0.4, lv: 'gfa' },
    ] },
    { id: 'openings', name: { id: 'Pintu & jendela', en: 'Doors & windows' }, items: [
      { id: 'swing', n: { id: 'Pintu panel kayu + kusen + kunci & engsel', en: 'Timber panel door + frame + lock & hinges' }, u: 'unit', q: Q => O(Q, 'swing'), r: 4200000, qs: 0.8, lv: 'gfa' },
      { id: 'double', n: { id: 'Pintu ganda (pintu utama) + kusen', en: 'Double door (front door) + frame' }, u: 'unit', q: Q => O(Q, 'double'), r: 12500000, qs: 0.9, lv: 'ground' },
      { id: 'sliding', n: { id: 'Pintu kaca geser kusen aluminium', en: 'Aluminium-framed sliding glass door' }, u: 'm²', q: Q => O(Q, 'sliding', 'area'), r: 2300000, qs: 0.8, lv: 'gfa' },
      { id: 'folding', n: { id: 'Pintu lipat kaca (bi-fold)', en: 'Bi-fold glass door' }, u: 'm²', q: Q => O(Q, 'folding', 'area'), r: 2900000, qs: 0.8, lv: 'gfa' },
      { id: 'garage', n: { id: 'Rolling door garasi', en: 'Garage rolling door' }, u: 'm²', q: Q => O(Q, 'garage', 'area'), r: 1400000, qs: 0.6, lv: 'ground' },
      { id: 'window', n: { id: 'Jendela aluminium + kaca 5 mm + kawat nyamuk', en: 'Aluminium windows + 5 mm glass + insect screen' }, u: 'm²', q: Q => O(Q, 'window', 'area'), r: 1500000, qs: 0.8, lv: 'gfa' },
      { id: 'glass', n: { id: 'Kaca mati (fixed glass)', en: 'Fixed glazing' }, u: 'm²', q: Q => O(Q, 'glass', 'area'), r: 1250000, qs: 0.8, lv: 'gfa' },
      { id: 'high', n: { id: 'Jendela atas / bovenlicht', en: 'High / clerestory windows' }, u: 'm²', q: Q => O(Q, 'high', 'area'), r: 1400000, qs: 0.8, lv: 'gfa' },
    ] },
    { id: 'finishes', name: { id: 'Finishing', en: 'Finishes' }, items: [
      { id: 'fCeramic', n: { id: 'Lantai keramik / granit tile 60×60', en: 'Ceramic / porcelain floor tiles 60×60' }, u: 'm²', q: Q => F(Q, 'tileBath', 'tileGrey'), r: 240000, qs: 0.8, lv: 'gfa' },
      { id: 'fStone', n: { id: 'Lantai granit tile motif batu / marmer lokal', en: 'Stone-look porcelain / local marble floor' }, u: 'm²', q: Q => F(Q, 'travertine', 'travertineHoned', 'marbleWhite', 'limestone', 'granite'), r: 420000, qs: 0.9, lv: 'gfa' },
      { id: 'fWood', n: { id: 'Lantai kayu engineered / SPC motif kayu', en: 'Engineered wood / wood-look SPC floor' }, u: 'm²', q: Q => F(Q, 'wood', 'woodDark', 'woodHerringbone', 'woodPlankDark', 'oak', 'walnut', 'teak'), r: 380000, qs: 1, lv: 'gfa' },
      { id: 'fOther', n: { id: 'Lantai lain (semen ekspos, epoxy, karpet, karet)', en: 'Other floors (polished concrete, epoxy, carpet, rubber)' }, u: 'm²', q: Q => F(Q, 'concrete', 'concretePolished', 'epoxy', 'carpet', 'rubber'), r: 260000, qs: 0.6, lv: 'gfa' },
      { id: 'wTile', n: { id: 'Dinding keramik kamar mandi', en: 'Bathroom wall tiles' }, u: 'm²', q: Q => Q.finishes.wallTile, r: 260000, qs: 0.8, lv: 'gfa' },
      { id: 'wPaint', n: { id: 'Cat dinding interior (plamir + 2 lapis)', en: 'Interior wall paint (filler + 2 coats)' }, u: 'm²', q: Q => Q.finishes.wallPaint, r: 48000, qs: 0.5, lv: 'gfa' },
      { id: 'ceil', n: { id: 'Plafon gypsum rangka hollow + cat + list', en: 'Gypsum ceiling on steel frame + paint + cornice' }, u: 'm²', q: Q => Q.finishes.ceiling, r: 205000, qs: 0.6, lv: 'gfa' },
    ] },
    { id: 'wet', name: { id: 'Sanitair & dapur', en: 'Sanitary & kitchen' }, items: [
      { id: 'wc', n: { id: 'Kloset duduk + jet washer', en: 'WC + hand bidet' }, u: 'unit', q: Q => Q.wet.toilets, r: 3600000, qs: 1, lv: 'gfa' },
      { id: 'basin', n: { id: 'Wastafel + kran + kabinet', en: 'Basin + tap + vanity cabinet' }, u: 'unit', q: Q => Q.wet.basins, r: 3200000, qs: 1, lv: 'gfa' },
      { id: 'shower', n: { id: 'Shower set + partisi kaca tempered', en: 'Shower set + tempered glass screen' }, u: 'unit', q: Q => Q.wet.showers, r: 7800000, qs: 1, lv: 'gfa' },
      { id: 'tub', n: { id: 'Bathtub freestanding + kran', en: 'Freestanding bathtub + mixer' }, u: 'unit', q: Q => Q.wet.tubs, r: 15000000, qs: 1, lv: 'gfa' },
      { id: 'heater', n: { id: 'Water heater (per kamar mandi)', en: 'Water heater (per bathroom)' }, u: 'unit', q: Q => Q.wet.baths + Q.wet.wcs, r: 3800000, qs: 0.6, lv: 'gfa' },
      { id: 'wp', n: { id: 'Waterproofing lantai basah + floor drain', en: 'Wet-room waterproofing + floor drains' }, u: 'room', q: Q => Q.wet.rooms, r: 2400000, qs: 0.2, lv: 'gfa' },
      { id: 'kset', n: { id: 'Kitchen set bawah (+ atas) + top granit/solid surface', en: 'Kitchen cabinets + granite / solid-surface top' }, u: 'm', q: Q => Q.kitchen.runM, r: 4600000, qs: 1, lv: 'ground' },
      { id: 'island', n: { id: 'Kitchen island', en: 'Kitchen island' }, u: 'unit', q: Q => Q.kitchen.islands, r: 13500000, qs: 1, lv: 'ground' },
      { id: 'appl', n: { id: 'Kompor tanam, hood, sink + kran dapur', en: 'Built-in hob, hood, sink + kitchen tap' }, u: 'set', q: Q => (Q.kitchen.runM > 0 ? 1 : 0), r: 14000000, qs: 1, lv: 'ground' },
    ] },
    { id: 'mep', name: { id: 'Mekanikal, elektrikal & plumbing', en: 'Mechanical, electrical & plumbing' }, items: [
      { id: 'elec', n: { id: 'Instalasi listrik (kabel, MCB, stop kontak, saklar)', en: 'Electrical installation (cabling, breakers, sockets, switches)' }, u: 'm²', q: Q => Q.gfa, r: 270000, qs: 0.6, lv: 'gfa' },
      { id: 'light', n: { id: 'Lampu downlight / LED (penerangan umum)', en: 'Downlights / LED general lighting' }, u: 'm²', q: Q => Q.gfa, r: 95000, qs: 1, lv: 'gfa' },
      { id: 'plumb', n: { id: 'Plumbing air bersih, air kotor, vent + pompa + toren', en: 'Water supply, waste & vent pipes + pump + tank' }, u: 'm²', q: Q => Q.gfa, r: 185000, qs: 0.4, lv: 'gfa' },
      { id: 'septic', n: { id: 'Septic tank biofilter + sumur resapan', en: 'Biofilter septic tank + soakaway' }, u: 'ls', q: () => 1, r: 16000000, qs: 0.2, lv: 'site' },
      { id: 'ac', n: { id: 'AC split inverter (kamar tidur & ruang keluarga) + instalasi', en: 'Inverter split AC (bedrooms & living) + installation' }, u: 'unit', q: Q => Q.rooms.bedrooms + Q.rooms.living, r: 7200000, qs: 0.7, lv: 'gfa' },
      { id: 'data', n: { id: 'Internet, CCTV dasar & bel/intercom', en: 'Data cabling, basic CCTV & doorbell / intercom' }, u: 'ls', q: () => 1, r: 9500000, qs: 0.8, lv: 'gfa' },
      { id: 'lift', n: { id: 'Home lift (per pemberhentian)', en: 'Home lift (per stop)' }, u: 'stop', q: Q => Q.lift.stops, r: 110e6, qs: 0.5, lv: 'gfa' },
      { id: 'pv', n: { id: 'Panel surya on-grid + inverter + instalasi', en: 'Rooftop solar on-grid + inverter + installation' }, u: 'kWp', q: Q => Q.pv.kwp || 0, r: 13500000, qs: 0.3, reg: false, lv: 'gfa' },
    ] },
    { id: 'site', name: { id: 'Tapak & taman', en: 'Site & garden' }, items: [
      { id: 'paving', n: { id: 'Paving / teras batu', en: 'Paving / stone patio' }, u: 'm²', q: Q => S(Q, 'paving'), r: 290000, qs: 0.7, lv: 'site' },
      { id: 'terrace', n: { id: 'Teras (deck kayu / batu alam)', en: 'Terrace (timber deck / natural stone)' }, u: 'm²', q: Q => S(Q, 'terrace'), r: 520000, qs: 0.8, lv: 'site' },
      { id: 'path', n: { id: 'Jalan setapak', en: 'Garden paths' }, u: 'm²', q: Q => S(Q, 'path'), r: 220000, qs: 0.6, lv: 'site' },
      { id: 'drive', n: { id: 'Jalan masuk / carport beton rabat + finishing', en: 'Driveway / carport slab (concrete + finish)' }, u: 'm²', q: Q => S(Q, 'driveway') + S(Q, 'carport') + S(Q, 'parking'), r: 380000, qs: 0.5, lv: 'site' },
      { id: 'carport', n: { id: 'Kanopi carport rangka baja + atap', en: 'Carport canopy: steel frame + roof' }, u: 'm²', q: Q => S(Q, 'carport'), r: 1100000, qs: 0.6, lv: 'site' },
      { id: 'pergola', n: { id: 'Pergola kayu/baja', en: 'Timber / steel pergola' }, u: 'm²', q: Q => S(Q, 'pergola'), r: 950000, qs: 0.7, lv: 'site' },
      { id: 'lawn', n: { id: 'Rumput + tanah urug + irigasi sederhana', en: 'Lawn + topsoil + simple irrigation' }, u: 'm²', q: Q => S(Q, 'lawn'), r: 55000, qs: 0.5, lv: 'site' },
      { id: 'beds', n: { id: 'Bedeng tanaman (tanaman + bibit + tepian)', en: 'Planting beds (plants + edging)' }, u: 'm²', q: Q => S(Q, 'garden'), r: 260000, qs: 0.8, lv: 'site' },
      { id: 'trees', n: { id: 'Pohon (tinggi 2–3 m) ditanam', en: 'Trees (2–3 m) planted' }, u: 'tree', q: Q => S(Q, 'trees'), r: 1600000, qs: 0.6, lv: 'site' },
      { id: 'hedge', n: { id: 'Pagar tanaman (hedge)', en: 'Hedge planting' }, u: 'm', q: Q => S(Q, 'hedges') + (Q.site.perimeter.hedge || 0), r: 260000, qs: 0.5, lv: 'site' },
      { id: 'pool', n: { id: 'Kolam renang beton + waterproofing + mosaik', en: 'Concrete pool + waterproofing + mosaic' }, u: 'm²', q: Q => Q.site.pool.area, r: 6800000, qs: 0.6, lv: 'site' },
      { id: 'poolEq', n: { id: 'Peralatan kolam (pompa, filter, lampu)', en: 'Pool equipment (pump, filter, lights)' }, u: 'set', q: Q => Q.site.pool.count, r: 42000000, qs: 0.6, lv: 'site' },
      { id: 'court', n: { id: 'Lapangan olahraga (lapisan akrilik)', en: 'Sports court (acrylic surface)' }, u: 'm²', q: Q => S(Q, 'court'), r: 480000, qs: 0.5, lv: 'site' },
      { id: 'pWall', n: { id: 'Pagar tembok keliling (±1,8 m, plester + cat)', en: 'Perimeter wall (±1.8 m, rendered + painted)' }, u: 'm', q: Q => (Q.site.perimeter.wall || 0) + S(Q, 'walls'), r: 1450000, qs: 0.4, lv: 'site' },
      { id: 'pFence', n: { id: 'Pagar besi / BRC', en: 'Steel / mesh fence' }, u: 'm', q: Q => (Q.site.perimeter.fence || 0) + S(Q, 'fences'), r: 720000, qs: 0.5, lv: 'site' },
      { id: 'gateS', n: { id: 'Gerbang geser besi (+ motor otomatis)', en: 'Sliding steel gate (+ automatic motor)' }, u: 'm', q: Q => Q.site.gates.slidingM, r: 4200000, qs: 0.6, lv: 'site' },
      { id: 'gateW', n: { id: 'Pintu pagar', en: 'Garden gate' }, u: 'unit', q: Q => Q.site.gates.swing, r: 3500000, qs: 0.6, lv: 'site' },
      { id: 'drain', n: { id: 'Saluran tapak, biopori & lampu taman', en: 'Site drainage, soakaways & garden lights' }, u: 'm²', q: Q => S(Q, 'area'), r: 32000, qs: 0.5, lv: 'site' },
    ] },
  ],
};
