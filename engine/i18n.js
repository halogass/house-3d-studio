// Bilingual UI (Bahasa Indonesia + English).
//
//   t('key', { n: 3 })   UI string in the current language ({n} placeholders filled in)
//   tr(value)            a data string: either plain text or { id: '…', en: '…' }
//   getLang() / setLang('id' | 'en')
//
// Language, first match wins: ?lang=… in the URL, the visitor's last choice (localStorage),
// project.json "language", the browser language, English. Node scripts: H3S_LANG or English.
import project from '@project/project.json';

export const LANGS = ['id', 'en'];
const hasWindow = typeof window !== 'undefined' && typeof document !== 'undefined';

function detect() {
  const ok = (l) => (LANGS.includes(l) ? l : null);
  if (hasWindow) {
    try { const q = ok(new URLSearchParams(location.search).get('lang')); if (q) return q; } catch (e) { /* no location */ }
    try { const s = ok(localStorage.getItem('h3s-lang')); if (s) return s; } catch (e) { /* storage blocked */ }
  } else if (typeof process !== 'undefined' && ok(process.env?.H3S_LANG)) return process.env.H3S_LANG;
  if (ok(project?.language)) return project.language;
  if (hasWindow && /^id|^ms/i.test(navigator.language || '')) return 'id';
  return 'en';
}

let lang = detect();
export const getLang = () => lang;
export function setLang(l) {
  if (!LANGS.includes(l)) return;
  lang = l;
  try { localStorage.setItem('h3s-lang', l); } catch (e) { /* storage blocked */ }
}

export function tr(v) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  return v[lang] ?? v.en ?? v.id ?? Object.values(v)[0] ?? '';
}

export function t(key, vars) {
  let s = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}

// Fill [data-i18n="key"] (text) and [data-i18n-title="key"] / [data-i18n-ph="key"] in a DOM tree
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  if (hasWindow) document.documentElement.lang = lang;
}

// ---------------------------------------------------------------- strings
const STRINGS = {
  en: {
    loading: 'Building the house…',
    loadingHint: 'On a phone or tablet this can take 20–40 seconds.',
    loadFail: 'The house could not be loaded',
    reload: 'Reload',
    openPlan: 'Open 2D plan ↗',
    openCost: 'Construction cost estimate ↗',
    walk: 'Walk', dollhouse: 'Dollhouse', all: 'All',
    options: '☰ Options', tabControls: 'Controls', tabSpec: 'House spec',
    goTo: 'Go to', pickPlace: 'Pick a place…', time: 'Time', month: 'Month (sun position)', quality: 'Graphics quality',
    qUltra: 'Ultra (full HD)', qHigh: 'High (shadows)', qLow: 'Light (phones)',
    language: 'Language',
    explore: 'Explore together', yourName: 'Your name', avatarColor: 'Avatar colour', createRoom: 'Create room',
    roomCode: 'Room code', join: 'Join', copyLink: 'Copy link', copied: 'Copied ✓', voiceOn: '🎙 Turn on voice', mute: '🎙 Mute', unmute: '🔇 Unmute',
    follow: 'Follow (F)', ping: 'Mark (Q)', leaveRoom: 'Leave room', together: 'With: {names}',
    localMode: 'Test mode: only tabs in this browser (no realtime server configured).',
    micFail: 'Microphone unavailable: {msg}',
    gpu: 'GPU', gpuAuto: 'Quality adapts to the device GPU automatically; pick one to lock it.',
    gpuWarn: 'The browser is rendering without the GPU (hardware acceleration is off), so this will be very slow. Turn it on in <b>Chrome → Settings → System → "Use graphics acceleration"</b> (Edge: "Use hardware acceleration"), then reload.',
    builtFrom: 'This model is generated from the plan data of project <b>{name}</b>.',
    clickToWalk: 'Click to start walking',
    clickHint: 'WASD / arrow keys to walk, mouse to look, Shift to run.<br>Click the minimap to teleport.',
    helpTouch: 'Drag your left thumb to walk, drag on the right to look around. Get close to a chair or bed, then tap Sit / Lie down; tap a door (or the Open door button) to open it.',
    helpDesk: 'Click to start. WASD / arrows = walk, Shift = run, mouse = look, E = sit / press button / open-close door (or click the door), R = lie down, M = dollhouse, Esc = release mouse.',
    loadingPct: 'Loading… {p}%',
    resolution: 'resolution {p}%',
    fps: '{n} FPS',
    stand: 'Stand up', exit: 'Get out', sit: 'Sit', lie: 'Lie down', press: 'Press',
    openDoor: 'Open door', closeDoor: 'Close door', openGarage: 'Open garage door', closeGarage: 'Close garage door',
    liftCall: 'Call lift (E)', liftPress: 'Lift · press 1–{n}', liftTo: 'To floor {lv}', liftCallBtn: 'Call lift', liftOpen: 'Open doors', liftClose: 'Close doors',
    driver: 'Drive', passenger: 'Passenger', kmh: 'km/h', driveHintDesk: 'W/S gas · brake/reverse · A/D steer · Space handbrake · mouse = orbit camera · E get out', driveHintTouch: 'left thumb = steer', gas: 'Gas', brake: 'Brake /<br>Reverse',
    street: 'Street', site: 'Site', frontGate: 'Front gate', garden: 'Garden',
    north: 'N ↑',
    ctxLost: 'The device ran out of graphics memory. Close other tabs/apps, choose the "Light" quality, then reload.',
    noWebgl: 'This browser is blocking 3D graphics for the site (usually after the GPU ran out of memory). Close the browser completely and open it again; if it still fails, restart the device.',
    bootFetch: 'Could not download the app files', bootRetry: 'retrying…', bootErr: 'An error occurred while building: {msg}. Close other tabs and reload.',
    bootSlow: 'The app has not started after 40 seconds', bootNet: 'Check the connection, then reload.',
    dataError: 'The house data has a problem',
    // spec tab
    specArea: 'Floor area', specRooms: 'Rooms', specEnergy: 'Energy', specWater: 'Water', specNote: 'Figures are computed from the 3D model with the assumptions in project.json (spec). Estimates only.',
    specGfa: 'Total floor area', specLevel: '{name}', specLevelRow: '±{a} m² · {n} rooms · ceiling {h} m', specSite: 'Site', specBuilt: 'Built-up / site coverage',
    specBedrooms: 'Bedrooms', specBaths: 'Bathrooms / WCs', specSeats: 'Seats & beds (furniture)', specDoors: 'Doors / windows',
    specPv: 'Rooftop solar (PV)', specPvVal: '{n} panels · {kwp} kWp', specPvYield: 'Solar yield (estimate)', specUse: 'Household use (assumption)', specCover: 'Solar covers',
    specRoof: 'Roof catchment area', specRain: 'Rainwater harvest (estimate)', specDemand: 'Water demand (assumption)', specRainCover: 'Rainwater covers',
    specPerDay: '{v} per day', specPerYear: '{v} per year', specAssume: 'Assumptions',
    yes: 'yes', no: 'no',
    // studio: 2D plan + cost estimate
    planTitle: '2D plan', open3d: '3D walk-through ↗', siteTab: 'Site', floorArea: 'Floor area', selected: 'Selected room',
    clickRoom: 'Click / tap a room for details.', legend: 'Legend', showFurniture: 'Show furniture', showGrid: 'Grid & coordinates',
    showRoofs: 'Roof outlines', planHint: 'Scroll / pinch to zoom, drag to pan. Grid 1 m, labels every 5 m: x → east, y → north.',
    lgDoor: 'Door & swing', lgSliding: 'Sliding door', lgWindow: 'Window / glass', lgHigh: 'High window', lgOpen: 'Open plan (no wall)',
    lgStair: 'Stair (arrow = up)', lgLift: 'Lift', lgRoof: 'Roof edge', outdoorArea: '(outdoor)', total: 'Total', items: 'Furniture',
    roadLabel: 'ROAD', perimeterLbl: 'Plot', notes: 'Notes',
    costTitle: 'Construction cost estimate', estimateBadge: 'ESTIMATE',
    costDisclaimer: 'This is a rough <b>estimate</b> from the plan and typical unit rates of the selected region, not a quote. Real prices vary with the contractor, the market, the soil, the details and the timing. Ask at least three local contractors for a priced bill of quantities before deciding anything.',
    costTotal: 'Estimated total', costRange: 'Likely range', costPerM2: 'per m² floor area', costConstruction: 'Construction',
    costFees: 'Design & engineering', costPermits: 'Permits & connections', costCont: 'Contingency', costPpn: 'VAT (PPN)',
    costByCat: 'By category', costByLevel: 'By floor', costDrivers: 'Biggest cost items', costItem: 'Item', costQty: 'Qty', costUnit: 'Unit',
    costRate: 'Rate', costAmount: 'Amount', costAssumptions: 'Assumptions', costQuality: 'Quality', costRegion: 'Rate table',
    costRegionIndex: 'Regional price index', costFeePct: 'Design & engineering fee', costContPct: 'Contingency', costPpnPct: 'VAT (PPN)',
    costRangePct: 'Range ±', costQuantities: 'Quantities from the plan', costGfa: 'Floor area (GFA)', costSite: 'Site',
    costRoof: 'Roof (sloped)', costWalls: 'Walls ext. / int.', costPv: 'Solar PV', costRegionMissing: 'No rate table for region "{r}" yet; showing {d}.',
    costRegionHint: '1.00 = prices of the rate table; e.g. 1.10 for 10 % dearer areas.',
  },
  id: {
    loading: 'Membangun rumah…',
    loadingHint: 'Di HP/tablet bisa memakan waktu ±20–40 detik.',
    loadFail: 'Rumah belum bisa dimuat',
    reload: 'Muat ulang',
    openPlan: 'Buka denah 2D ↗',
    openCost: 'Estimasi biaya pembangunan ↗',
    walk: 'Jalan', dollhouse: 'Dollhouse', all: 'Semua',
    options: '☰ Opsi', tabControls: 'Kontrol', tabSpec: 'Spec rumah',
    goTo: 'Pindah ke lokasi', pickPlace: 'Pilih lokasi…', time: 'Waktu', month: 'Bulan (posisi matahari)', quality: 'Kualitas grafis',
    qUltra: 'Ultra (HD penuh)', qHigh: 'Tinggi (bayangan)', qLow: 'Ringan (HP)',
    language: 'Bahasa',
    explore: 'Jelajah bareng', yourName: 'Nama Anda', avatarColor: 'Warna avatar', createRoom: 'Buat ruang',
    roomCode: 'Kode ruang', join: 'Gabung', copyLink: 'Salin link', copied: 'Tersalin ✓', voiceOn: '🎙 Nyalakan suara', mute: '🎙 Mute', unmute: '🔇 Unmute',
    follow: 'Ikuti (F)', ping: 'Tandai (Q)', leaveRoom: 'Keluar ruang', together: 'Bersama: {names}',
    localMode: 'Mode uji: hanya tab di browser ini (server realtime belum diatur).',
    micFail: 'Mikrofon tidak bisa dipakai: {msg}',
    gpu: 'GPU', gpuAuto: 'Kualitas otomatis menyesuaikan GPU perangkat; pilih manual untuk mengunci.',
    gpuWarn: 'Browser sedang merender tanpa GPU (akselerasi hardware mati), jadi tampilan akan sangat lambat. Aktifkan di <b>Chrome → Setelan → Sistem → "Gunakan akselerasi grafis"</b> (Edge: "Gunakan akselerasi hardware"), lalu muat ulang.',
    builtFrom: 'Model ini dibangun otomatis dari data denah proyek <b>{name}</b>.',
    clickToWalk: 'Klik untuk mulai berjalan',
    clickHint: 'WASD / panah untuk berjalan, mouse untuk melihat, Shift untuk lari.<br>Klik minimap untuk teleport.',
    helpTouch: 'Geser jempol kiri untuk berjalan, geser kanan untuk melihat sekeliling. Dekati kursi/kasur lalu sentuh tombol Duduk / Berbaring; sentuh pintu (atau tombol Buka pintu) untuk membuka.',
    helpDesk: 'Klik untuk mulai. WASD / panah = jalan, Shift = lari, mouse = lihat, E = duduk / tekan tombol / buka-tutup pintu (atau klik pintu), R = berbaring, M = dollhouse, Esc = lepas mouse.',
    loadingPct: 'Memuat… {p}%',
    resolution: 'resolusi {p}%',
    fps: '{n} FPS',
    stand: 'Berdiri', exit: 'Keluar', sit: 'Duduk', lie: 'Berbaring', press: 'Tekan',
    openDoor: 'Buka pintu', closeDoor: 'Tutup pintu', openGarage: 'Buka pintu garasi', closeGarage: 'Tutup pintu garasi',
    liftCall: 'Panggil lift (E)', liftPress: 'Lift · tekan 1–{n}', liftTo: 'Ke lantai {lv}', liftCallBtn: 'Panggil lift', liftOpen: 'Buka pintu', liftClose: 'Tutup pintu',
    driver: 'Kemudi', passenger: 'Penumpang', kmh: 'km/j', driveHintDesk: 'W/S gas · rem/mundur · A/D setir · Spasi rem tangan · mouse = putar kamera · E keluar', driveHintTouch: 'jempol kiri = setir', gas: 'Gas', brake: 'Rem /<br>Mundur',
    street: 'Jalan', site: 'Tapak', frontGate: 'Gerbang depan', garden: 'Taman',
    north: 'U ↑',
    ctxLost: 'Memori grafis perangkat penuh. Tutup tab/aplikasi lain, pilih kualitas "Ringan", lalu muat ulang.',
    noWebgl: 'Browser sedang memblokir grafis 3D untuk situs ini (biasanya setelah GPU perangkat sempat kehabisan memori). Tutup browser sepenuhnya lalu buka lagi; jika tetap gagal, mulai ulang perangkat.',
    bootFetch: 'Gagal mengunduh file aplikasi', bootRetry: 'mencoba lagi…', bootErr: 'Terjadi error saat membangun: {msg}. Tutup tab lain lalu muat ulang.',
    bootSlow: 'Aplikasi belum mulai setelah 40 detik', bootNet: 'Periksa koneksi, lalu muat ulang.',
    dataError: 'Data rumah bermasalah',
    specArea: 'Luas', specRooms: 'Ruang', specEnergy: 'Energi', specWater: 'Air', specNote: 'Angka dihitung dari model 3D dengan asumsi di project.json (spec). Hanya perkiraan.',
    specGfa: 'Total luas lantai', specLevel: '{name}', specLevelRow: '±{a} m² · {n} ruang · plafon {h} m', specSite: 'Tapak', specBuilt: 'Luas dasar / KDB',
    specBedrooms: 'Kamar tidur', specBaths: 'Kamar mandi / WC', specSeats: 'Kursi & kasur (furnitur)', specDoors: 'Pintu / jendela',
    specPv: 'Panel surya atap (PV)', specPvVal: '{n} panel · {kwp} kWp', specPvYield: 'Produksi surya (perkiraan)', specUse: 'Pemakaian rumah (asumsi)', specCover: 'Surya menutup',
    specRoof: 'Luas tangkapan atap', specRain: 'Panen air hujan (perkiraan)', specDemand: 'Kebutuhan air (asumsi)', specRainCover: 'Air hujan menutup',
    specPerDay: '{v} per hari', specPerYear: '{v} per tahun', specAssume: 'Asumsi',
    yes: 'ya', no: 'tidak',
    // studio: denah 2D + estimasi biaya
    planTitle: 'Denah 2D', open3d: 'Jelajah 3D ↗', siteTab: 'Tapak', floorArea: 'Luas lantai', selected: 'Ruang terpilih',
    clickRoom: 'Klik / tap sebuah ruang untuk detail.', legend: 'Legenda', showFurniture: 'Tampilkan furnitur', showGrid: 'Grid & koordinat',
    showRoofs: 'Garis atap', planHint: 'Scroll / cubit untuk zoom, geser untuk pan. Grid 1 m, label tiap 5 m: x → timur, y → utara.',
    lgDoor: 'Pintu & arah buka', lgSliding: 'Pintu geser', lgWindow: 'Jendela / kaca', lgHigh: 'Jendela tinggi', lgOpen: 'Open plan (tanpa dinding)',
    lgStair: 'Tangga (panah = naik)', lgLift: 'Lift', lgRoof: 'Tepi atap', outdoorArea: '(luar ruang)', total: 'Total', items: 'Furnitur',
    roadLabel: 'JALAN', perimeterLbl: 'Tapak', notes: 'Catatan',
    costTitle: 'Estimasi biaya pembangunan', estimateBadge: 'PERKIRAAN',
    costDisclaimer: 'Ini <b>perkiraan kasar</b> dari denah dan harga satuan umum di wilayah terpilih, bukan penawaran harga. Harga nyata bergantung pada kontraktor, pasar, kondisi tanah, detail dan waktu. Minta RAB dari minimal tiga kontraktor lokal sebelum memutuskan.',
    costTotal: 'Perkiraan total', costRange: 'Rentang wajar', costPerM2: 'per m² luas lantai', costConstruction: 'Konstruksi',
    costFees: 'Desain & perencanaan', costPermits: 'Izin & sambungan', costCont: 'Cadangan tak terduga', costPpn: 'PPN',
    costByCat: 'Per kategori', costByLevel: 'Per lantai', costDrivers: 'Pos biaya terbesar', costItem: 'Pekerjaan', costQty: 'Volume', costUnit: 'Satuan',
    costRate: 'Harga satuan', costAmount: 'Jumlah', costAssumptions: 'Asumsi', costQuality: 'Mutu', costRegion: 'Tabel harga',
    costRegionIndex: 'Indeks harga daerah', costFeePct: 'Fee desain & perencanaan', costContPct: 'Cadangan', costPpnPct: 'PPN',
    costRangePct: 'Rentang ±', costQuantities: 'Volume dari denah', costGfa: 'Luas lantai', costSite: 'Tapak',
    costRoof: 'Atap (miring)', costWalls: 'Dinding luar / dalam', costPv: 'Panel surya', costRegionMissing: 'Belum ada tabel harga untuk wilayah "{r}"; ditampilkan {d}.',
    costRegionHint: '1,00 = harga tabel; mis. 1,10 untuk daerah 10 % lebih mahal.',
  },
};
