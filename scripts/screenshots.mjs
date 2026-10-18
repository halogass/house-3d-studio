// Screenshots of the active house from fixed viewpoints, for reviewing a design step (the wizard's
// qa-visual agent shows them to the user). Starts its own dev server, opens Chromium on the GPU
// (scripts/lib/browser.mjs) and writes PNGs to projects/<house>/shots/ (git-ignored).
//   npm run screenshots                       all views
//   node scripts/screenshots.mjs --only plan,street,rooms --rooms living,master --time 16 --mobile
// Views:
//   street      the house from the road, where a visitor starts
//   aerial      dollhouse overview of the whole plot from the south-east
//   cut-<lv>    dollhouse cut at each level (roof and upper floors hidden)
//   room-<id>   standing in each room (or --rooms a,b), looking along its longer side
//   plan-<lv>   the 2D plan of each level (studio/plan.html) + plan-site
//   mobile      a phone-sized view of the street (with --mobile, or in "all")
// Options: --time 9.5 (hour), --month 7, --quality high|ultra|low, --width 1280 --height 800,
//          --out <dir>, --port <n>. Without a GPU the pictures still come out (slowly, software).
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { useProject, activeProject, ROOT } from './lib/project.mjs';
import { gpuLaunchOptions, gpuInfo } from './lib/browser.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const name = activeProject();
const dir = useProject(name);
process.env.PROJECT = name;
const { Z, PROJECT } = await import('../engine/data.js');
const { LEVEL_ORDER, GROUND } = await import('../engine/config.js');
const only = arg('only') ? arg('only').split(',') : null;
const want = (v) => !only || only.some(o => v === o || v.startsWith(o + '-') || (o === 'rooms' && v.startsWith('room-')) || (o === 'cuts' && v.startsWith('cut-')) || (o === 'plan' && v.startsWith('plan-')));
const out = arg('out') ? join(ROOT, arg('out')) : join(dir, 'shots');
mkdirSync(out, { recursive: true });
const W = +arg('width', 1280), H = +arg('height', 800);
const common = `quality=${arg('quality', 'high')}&time=${arg('time', 10)}&month=${arg('month', 7)}&ui=0&staged=0`;

const { chromium } = await import('playwright-core');
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', server: { port: +arg('port', 0) || 0, host: '127.0.0.1', hmr: false } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch(gpuLaunchOptions());
const errors = [];
const saved = [];

async function shot(file, url, { mobile = false, plan = false } = {}) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${file}: ${e.message}`));
  await page.goto(base + url);
  if (plan) await page.waitForFunction(() => window.__plan?.ready, null, { timeout: 60000 });
  else {
    await page.waitForFunction(() => window.__dh && !document.getElementById('loading') && window.__dh.build?.doneAt, null, { timeout: 120000 });
    await page.waitForTimeout(2500); // textures, photo plants
  }
  const path = join(out, file);
  await page.screenshot({ path });
  saved.push(path);
  await ctx.close();
}

try {
  const page = await browser.newPage();
  const gpu = await gpuInfo(page);
  await page.close();
  console.log(`GPU: ${gpu.name}${gpu.software ? ' (software rendering: slow)' : ''}`);
  const site = Z.site, cx = site.w / 2, cy = site.d / 2;
  if (want('street')) await shot('street.png', `?${common}`);
  if (want('aerial')) await shot('aerial.png', `?${common}&mode=house&cam=${site.w + 12},-12,${Math.max(site.w, site.d) * 0.9},${cx},${cy},0`);
  for (const lv of LEVEL_ORDER) if (want('cut-' + lv)) {
    const rooms = Z.floors[lv] || [];
    if (!rooms.length) continue;
    const x0 = Math.min(...rooms.map(r => r.r[0])), x1 = Math.max(...rooms.map(r => r.r[2])), y0 = Math.min(...rooms.map(r => r.r[1])), y1 = Math.max(...rooms.map(r => r.r[3]));
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, span = Math.max(x1 - x0, y1 - y0);
    await shot(`cut-${lv}.png`, `?${common}&mode=house&cut=${lv}&cam=${mx + span * 0.35},${my - span * 0.9},${span * 1.25},${mx},${my},0`);
  }
  const pick = arg('rooms') ? arg('rooms').split(',') : null;
  for (const lv of LEVEL_ORDER) for (const r of Z.floors[lv] || []) {
    if (pick ? !pick.includes(r.id) : !want('room-' + r.id)) continue;
    const [x0, y0, x1, y1] = r.r;
    // stand near one end of the longer side, looking along it
    const alongX = x1 - x0 >= y1 - y0;
    const x = alongX ? x0 + 0.9 : (x0 + x1) / 2, y = alongX ? (y0 + y1) / 2 : y0 + 0.9;
    const yaw = alongX ? 90 : 0;
    await shot(`room-${r.id}.png`, `?${common}&at=${x},${y},${lv},${yaw},-8`);
  }
  for (const lv of ['site', ...LEVEL_ORDER]) if (want('plan-' + lv)) await shot(`plan-${lv}.png`, `studio/plan.html?level=${lv}&furniture=1&grid=1`, { plan: true });
  if ((!only && !process.argv.includes('--no-mobile')) || process.argv.includes('--mobile') || want('mobile')) await shot('mobile.png', `?${common.replace('quality=high', 'quality=low')}`, { mobile: true });
} catch (e) {
  errors.push(e.message);
} finally {
  await browser.close();
  await server.close();
}
for (const p of saved) console.log('  ' + p);
console.log(`${saved.length} screenshot(s) → ${out}`);
if (errors.length) { console.log('✗ ' + errors.join('\n✗ ')); process.exit(1); }
void PROJECT; void GROUND;
