// Screenshots of the active house from fixed viewpoints, for reviewing a design step (the wizard's
// qa-visual agent shows them to the user). Starts its own dev server, opens Chromium on the GPU
// (scripts/lib/browser.mjs) and writes PNGs to projects/<house>/shots/ (git-ignored).
//   npm run screenshots                       all views
//   node scripts/screenshots.mjs --only plan,street,rooms --rooms living,master --time 16 --mobile
// Views:
//   street      the house from the road, where a visitor starts
//   entrance    eye level, 3.5 m in front of the main entrance door, facing it
//   garden      eye level from the back of the plot, looking at the house
//   aerial      dollhouse overview of the whole plot from the south-east
//   cut-<lv>    dollhouse cut at each level (roof and upper floors hidden)
//   room-<id>   standing in each room (or --rooms a,b) just inside its widest door, looking at the far corner
//   plan-<lv>   the 2D plan of each level (studio/plan.html) + plan-site
//   mobile      a phone-sized view of the street (with --mobile, or in "all")
// Options: --time 9.5 (hour; 18.5 = dusk, 20 = night), --month 7, --quality high|ultra|low,
//          --width 1280 --height 800, --out <dir> (relative to the repo, or absolute), --port <n>,
//          --prefix dusk- (prefix every file name, e.g. for a night set).
// One extra view of your own (no script needed):
//   --at x,y[,level[,yawDeg[,pitchDeg]]] --name garden-west    eye level (yaw 0 = north, 90 = east)
//   --cam x,y,h,tx,ty,th --name aerial-low                      dollhouse camera at (x,y,h) looking at (tx,ty,th)
// Without a GPU the pictures still come out (slowly, software).
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { useProject, activeProject, ROOT } from './lib/project.mjs';
import { gpuLaunchOptions, gpuInfo } from './lib/browser.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const name = activeProject();
const dir = useProject(name);
process.env.PROJECT = name;
const { Z, PROJECT } = await import('../engine/data.js');
const { LEVEL_ORDER, GROUND } = await import('../engine/config.js');
const DOOR_TYPES = new Set(['swing', 'double', 'sliding', 'folding', 'opening', 'garage']);
const only = arg('only') ? arg('only').split(',') : null;
const want = (v) => !only || only.some(o => v === o || v.startsWith(o + '-') || (o === 'rooms' && v.startsWith('room-')) || (o === 'cuts' && v.startsWith('cut-')) || (o === 'plan' && v.startsWith('plan-')));
const out = arg('out') ? resolve(ROOT, arg('out')) : join(dir, 'shots'); // relative to the repo, or absolute
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
  const path = join(out, (arg('prefix') || '') + file);
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
  if (arg('at') || arg('cam')) { // one custom view only
    const file = (arg('name') || 'view').replace(/[^a-z0-9-]+/gi, '-') + '.png';
    await shot(file, arg('at') ? `?${common}&at=${arg('at')}` : `?${common}&mode=house&cam=${arg('cam')}`);
    throw null; // done: skip the fixed views
  }
  if (want('street')) await shot('street.png', `?${common}`);
  // entrance: the widest door in an outside wall that faces the road (else any outside door)
  const ground = Z.floors[GROUND] || [];
  const inside = (x, y) => ground.some((r) => x > r.r[0] && x < r.r[2] && y > r.r[1] && y < r.r[3]);
  const ROAD = { s: [0, -1], n: [0, 1], e: [1, 0], w: [-1, 0] }[site.road || 's'] || [0, -1];
  const outsideDoors = (Z.openings[GROUND] || []).filter((o) => DOOR_TYPES.has(o.t)).map((o) => {
    const h = o.o === 'h', mx = h ? o.x + o.w / 2 : o.x, my = h ? o.y : o.y + o.w / 2;
    const normals = h ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
    const n = normals.find(([nx, ny]) => !inside(mx + nx * 0.3, my + ny * 0.3) && inside(mx - nx * 0.3, my - ny * 0.3));
    return n && { o, mx, my, n, road: n[0] === ROAD[0] && n[1] === ROAD[1] };
  }).filter(Boolean).sort((a, b) => (b.road - a.road) || (b.o.w - a.o.w));
  if (want('entrance') && outsideDoors.length) {
    const { mx, my, n } = outsideDoors[0];
    const x = mx + n[0] * 3.5, y = my + n[1] * 3.5, yaw = Math.round((Math.atan2(-n[0], -n[1]) * 180 / Math.PI + 360) % 360);
    await shot('entrance.png', `?${common}&at=${x.toFixed(2)},${y.toFixed(2)},${GROUND},${yaw},-3`);
  }
  if (want('garden') && ground.length) { // from 2 m inside the back boundary, looking at the house
    const hx = (Math.min(...ground.map((r) => r.r[0])) + Math.max(...ground.map((r) => r.r[2]))) / 2;
    const hy = (Math.min(...ground.map((r) => r.r[1])) + Math.max(...ground.map((r) => r.r[3]))) / 2;
    const [x, y] = { s: [hx, site.d - 2], n: [hx, 2], e: [2, hy], w: [site.w - 2, hy] }[site.road || 's'] || [hx, site.d - 2];
    const yaw = Math.round((Math.atan2(hx - x, hy - y) * 180 / Math.PI + 360) % 360);
    await shot('garden.png', `?${common}&at=${x.toFixed(2)},${y.toFixed(2)},${GROUND},${yaw},-6`);
  }
  // from the south-east, far enough that the whole plot fills about two thirds of the frame
  const span = Math.max(site.w, site.d, 12);
  if (want('aerial')) await shot('aerial.png', `?${common}&mode=house&cam=${(cx + span * 0.48).toFixed(1)},${(cy - span * 0.72).toFixed(1)},${(span * 0.62).toFixed(1)},${cx},${cy},0`);
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
    // stand just inside the room's widest door (its clear zone is kept free of furniture by
    // check-interior), looking at the far corner; rooms without a door: near one end, looking along
    const door = (Z.openings[lv] || []).filter((o) => DOOR_TYPES.has(o.t) && (o.o === 'h'
      ? (Math.abs(o.y - y0) < 1e-6 || Math.abs(o.y - y1) < 1e-6) && o.x >= x0 - 1e-6 && o.x + o.w <= x1 + 1e-6
      : (Math.abs(o.x - x0) < 1e-6 || Math.abs(o.x - x1) < 1e-6) && o.y >= y0 - 1e-6 && o.y + o.w <= y1 + 1e-6)).sort((a, b) => b.w - a.w)[0];
    let x, y, yaw;
    if (door) {
      const h = door.o === 'h', mid = (h ? door.x : door.y) + door.w / 2;
      const inward = h ? (Math.abs(door.y - y0) < 1e-6 ? 1 : -1) : (Math.abs(door.x - x0) < 1e-6 ? 1 : -1);
      const step = Math.min(x1 - x0, y1 - y0) < 3 ? 0.3 : 0.7;  // small rooms (baths): in the doorway
      x = h ? mid : door.x + inward * step; y = h ? door.y + inward * step : mid;
      const fx = h ? (mid - x0 < x1 - mid ? x1 : x0) : (inward > 0 ? x1 : x0);  // far corner
      const fy = h ? (inward > 0 ? y1 : y0) : (mid - y0 < y1 - mid ? y1 : y0);
      yaw = Math.round((Math.atan2(fx - x, fy - y) * 180 / Math.PI + 360) % 360);  // 0 = north, 90 = east
    } else {
      const alongX = x1 - x0 >= y1 - y0;
      x = alongX ? x0 + 0.9 : (x0 + x1) / 2; y = alongX ? (y0 + y1) / 2 : y0 + 0.9;
      yaw = alongX ? 90 : 0;
    }
    await shot(`room-${r.id}.png`, `?${common}&at=${x.toFixed(2)},${y.toFixed(2)},${lv},${yaw},-8`);
  }
  for (const lv of ['site', ...LEVEL_ORDER]) if (want('plan-' + lv)) await shot(`plan-${lv}.png`, `studio/plan.html?level=${lv}&furniture=1&grid=1`, { plan: true });
  if ((!only && !process.argv.includes('--no-mobile')) || process.argv.includes('--mobile') || want('mobile')) await shot('mobile.png', `?${common.replace('quality=high', 'quality=low')}`, { mobile: true });
} catch (e) {
  if (e) errors.push(e.message);
} finally {
  await browser.close();
  await server.close();
}
for (const p of saved) console.log('  ' + p);
console.log(`${saved.length} screenshot(s) → ${out}`);
if (errors.length) { console.log('✗ ' + errors.join('\n✗ ')); process.exit(1); }
void PROJECT; void GROUND;
