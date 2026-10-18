// Offline lightmap bake (optional feature 'bake'): photoreal interior light, rendered on the GPU.
//   npm run bake                         every area of the active project; skips areas whose stored
//                                        bake still matches the geometry (resumable: just re-run)
//   node scripts/bake.mjs --area l1,l2   some areas (ids: one per level unless project.json "bake.areas")
//   options: --spp 256 --bounces 3 --per-pass 4 --bands N (start; they adapt) --force --headed
//            --out <dir>   write there instead of projects/<name>/bake (test bakes)
//            --gpu <i>     render on GPU i (Linux: NVIDIA PRIME offload; Windows: high-performance GPU)
//            --gpus 2      Linux, several NVIDIA cards: split the areas over them (one child bake each)
//            --software    bake even without a GPU (hours; normally the bake is skipped then)
//            --help
// Starts the Vite dev server, opens studio/bake.html in Chromium on the real GPU (ANGLE: Direct3D 11
// on Windows, Metal on macOS, OpenGL on Linux; see scripts/lib/browser.mjs), one fresh page per area,
// and writes projects/<name>/bake/<area>/: day-<page>-<hash>.webp, night-<page>-<hash>.webp
// (desktop, 2048 wide), the -1k.webp halves (phones), manifest.json; plus bake/index.json (all baked
// areas, in area order) and bake/bake-log.json (timings). The app ignores an area whose hash does not
// match the current geometry; re-run after changing that area's shell, finishes or furniture.
// The bake directory is served at /bake/ and copied into dist/ by vite.config.js.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';
import { activeProject, projectDir, ROOT } from './lib/project.mjs';
import { gpuLaunchOptions, gpuInfo, chromePath } from './lib/browser.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
if (flag('help') || flag('h')) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
  process.exit(0);
}
const NAME = activeProject();
process.env.PROJECT = NAME;
const OUT = arg('out') ? resolve(arg('out')) : join(projectDir(NAME), 'bake');
const base = { spp: +arg('spp', 256), bounces: +arg('bounces', 3), sppPerPass: +arg('per-pass', 4), bands: +arg('bands', 0) || undefined, hour: +arg('hour', 11), month: +arg('month', 7) };
const headed = flag('headed'), force = flag('force');
if (flag('debug-overdraw')) base.debugOverdraw = true;
const GPU = arg('gpu');
if (!chromePath()) {
  console.log('✗ No Chromium found. Install it once with: npx playwright install chromium\n  Chromium belum ada. Pasang sekali dengan: npx playwright install chromium');
  process.exit(1);
}

if (+arg('gpus', 1) > 1 && platform() === 'linux') {
  const { spawn } = await import('node:child_process');
  const readJson = (p, d) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { return d; } };
  const n = +arg('gpus');
  const display = process.env.BAKE_DISPLAY_GPU ?? '0';
  const pass = process.argv.slice(2).filter((a, i, all) => !['--gpus', '--area', '--all'].includes(a) && !['--gpus', '--area'].includes(all[i - 1]));
  const ids = arg('area') ? String(arg('area')).split(',').filter(Boolean) : readJson(join(OUT, 'index.json'), { areas: [] }).areas.map(a => a.id);
  if (!ids.length) { console.log('--gpus needs --area a,b,… (or one earlier bake)'); process.exit(1); }
  const secs = (id) => readJson(join(OUT, id, 'manifest.json'), {}).totalSeconds || 600;
  const lists = Array.from({ length: n }, () => ({ ids: [], t: 0 }));
  for (const id of [...ids].sort((a, b) => secs(b) - secs(a))) { const l = lists.reduce((m, x) => (x.t < m.t ? x : m)); l.ids.push(id); l.t += secs(id); }
  const kids = lists.map((l, i) => l.ids.length && new Promise((res) => {
    const c = spawn(process.execPath, [fileURLToPath(import.meta.url), '--area', l.ids.join(','), '--gpu', String(i), ...pass],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, BAKE_DISPLAY_GPU: display } });
    const tag = (s) => s.toString().split('\n').filter(Boolean).map(x => `[gpu${i}] ${x}`).join('\n');
    c.stdout.on('data', (d) => console.log(tag(d))); c.stderr.on('data', (d) => console.error(tag(d)));
    c.on('exit', (code) => res(code));
  })).filter(Boolean);
  const codes = await Promise.all(kids);
  console.log(`total (all gpus) done, exit codes ${codes.join(',')}`);
  process.exit(codes.some(Boolean) ? 1 : 0);
}

const readJson = (p, d) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { return d; } };

const t0 = Date.now();
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'warn', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const url = server.resolvedUrls.local[0];
// A fresh Chromium per area (and per retry): after a lost context the GPU process refuses new
// WebGL contexts for the rest of its life.
let browser = null;
const launch = async () => {
  await browser?.close().catch(() => {});
  browser = await chromium.launch(gpuLaunchOptions({ gpu: GPU, headless: !headed }));
};
const openPage = async () => {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  page.setDefaultTimeout(0);
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('[bake]') || m.type() === 'error') console.log(m.type() === 'log' ? ' ' : m.type(), t.slice(0, 600)); });
  page.on('pageerror', (e) => console.log('page error:', e.message));
  await page.goto(url + 'studio/bake.html');
  await page.waitForFunction(() => window.bakeReady === true);
  return page;
};

let code = 0;
const log = readJson(join(OUT, 'bake-log.json'), { runs: [] });
const run = { started: new Date().toISOString(), opts: base, areas: [] };
log.runs.push(run);
try {
  await launch();
  const probe = await openPage();
  const gpu = await gpuInfo(probe);
  console.log(`GPU: ${gpu.name}`);
  if (gpu.software && !flag('software')) {
    console.log('! No GPU available to the browser (software rendering): the bake would take hours, so it is skipped.\n' +
      '  The house keeps its real-time lighting. Run with --software to bake anyway.\n' +
      '! Tidak ada GPU untuk browser: bake dilewati (rumah tetap memakai pencahayaan real-time).');
    await probe.close();
    run.skipped = 'no gpu';
    throw Object.assign(new Error('skipped'), { skip: true });
  }
  const ORDER = await probe.evaluate(() => window.bakeAreaIds());
  await probe.close();
  const want = arg('area') ? String(arg('area')).split(',').filter(Boolean) : ORDER;
  for (const a of want) if (!ORDER.includes(a)) throw new Error(`unknown area ${a} (areas: ${ORDER.join(', ')})`);
  console.log(`project ${NAME} · areas: ${want.join(', ')}  (spp ${base.spp}, bounces ${base.bounces}) → ${OUT}`);
  for (const area of want) {
    const dir = join(OUT, area);
    const old = readJson(join(dir, 'manifest.json'), null);
    const same = old && old.version === 3 && Array.isArray(old.files?.desktop?.day) && old.spp === base.spp && old.bounces === base.bounces && old.files?.desktop?.day?.every(f => existsSync(join(dir, f)));
    const skipHash = !force && same ? old.hash + '|' + (old.heroHash || '') : null;
    const ta = Date.now();
    let r = null;
    for (let attempt = 0; attempt < 3 && !r; attempt++) {
      await launch();
      const page = await openPage();
      try {
        const o = { ...base, area, skipHash, bands: attempt ? (base.bands || 24) * 2 * attempt : base.bands };
        r = await page.evaluate((o) => window.runBake(o), o);
      } catch (e) {
        console.error(`bake ${area} failed${attempt ? '' : ' (retrying with more bands)'}:`, e.message.slice(0, 400));
      } finally { await page.close().catch(() => {}); }
    }
    if (!r) { code = 1; run.areas.push({ area, failed: true }); continue; }
    if (r.skipped) { console.log(`${area}: up to date (${r.hash}), skipped`); run.areas.push({ area, skipped: true, hash: r.hash }); continue; }
    mkdirSync(dir, { recursive: true });
    for (const f of readdirSync(dir)) if (f.endsWith('.webp') && !(f in r.files)) rmSync(join(dir, f)); // superseded maps
    let bytes = 0, mobile = 0;
    for (const [name, b64] of Object.entries(r.files)) {
      const buf = Buffer.from(b64, 'base64');
      writeFileSync(join(dir, name), buf);
      bytes += buf.length;
      if (name.endsWith('-1k.webp')) mobile += buf.length;
    }
    r.manifest.totalSeconds = Math.round((Date.now() - ta) / 1000);
    r.manifest.bytes = { desktop: bytes - mobile, mobile };
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(r.manifest, null, 1) + '\n');
    run.areas.push({ area, seconds: r.manifest.totalSeconds, pages: r.manifest.pages, hash: r.manifest.hash, bytes: r.manifest.bytes });
    console.log(`bake ${area}: ${r.manifest.totalSeconds} s, ${r.manifest.pages} page(s), ${(bytes / 1024).toFixed(0)} KB → ${join(OUT, area)}/`);
    writeIndex(ORDER);
    writeFileSync(join(OUT, 'bake-log.json'), JSON.stringify(log, null, 1) + '\n');
  }
  writeIndex(ORDER);
} catch (e) {
  if (!e.skip) { console.error('bake failed:', e.message); code = 1; }
} finally {
  run.seconds = Math.round((Date.now() - t0) / 1000);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'bake-log.json'), JSON.stringify(log, null, 1) + '\n');
  await browser?.close().catch(() => {});
  await server.close();
}
console.log(`total ${Math.round((Date.now() - t0) / 1000)} s`);
process.exit(code);

// bake/index.json: every area with a complete bake, in the areas' order
function writeIndex(order) {
  const areas = [];
  for (const id of order) {
    const m = readJson(join(OUT, id, 'manifest.json'), null);
    if (!m || m.version !== 3 || !Array.isArray(m.files?.desktop?.day) || !m.files.desktop.day.every(f => existsSync(join(OUT, id, f)))) continue;
    areas.push({ id, level: m.level, dayP995: m.p995?.day ?? null, hash: m.hash, heroHash: m.heroHash || null, pages: m.pages, lastH: m.lastH, density: m.density, files: m.files, bytes: m.bytes, seconds: m.totalSeconds, spp: m.spp });
  }
  const page = areas.length ? readJson(join(OUT, areas[0].id, 'manifest.json'), {}).page : 2048;
  writeFileSync(join(OUT, 'index.json'), JSON.stringify({ version: 3, page, generated: new Date().toISOString(), areas }, null, 1) + '\n');
}
