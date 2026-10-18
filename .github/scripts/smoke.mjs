// CI smoke test (GitHub Actions, ubuntu): serves the production build (dist/) and opens the three
// pages in headless Chromium with software WebGL (SwiftShader). It only checks that each page loads
// without a page error and exposes its ready hook; it says nothing about how the house looks
// (SwiftShader renders slowly and is not a visual reference).
//   npm run build && node .github/scripts/smoke.mjs
// Needs Chromium once: npx playwright-core install --with-deps chromium   (or CHROME=/path/to/chrome)
import { preview } from 'vite';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { chromePath } = await import('../../scripts/lib/browser.mjs');
const { chromium } = await import('playwright-core');

if (!existsSync(join(ROOT, 'dist', 'index.html'))) { console.error('✗ No dist/ — run npm run build first'); process.exit(1); }
const executablePath = chromePath();
if (!executablePath) { console.error('✗ No Chromium — npx playwright-core install --with-deps chromium'); process.exit(1); }

const server = await preview({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'warn', preview: { host: '127.0.0.1', port: 0 } });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const pages = [
  { name: '3D walk-through', url: '?quality=low&ui=1', ready: () => window.__dh && window.__dh.build?.doneAt && !document.getElementById('loading'), timeout: 240000 },
  { name: '2D plan', url: 'studio/plan.html', ready: () => window.__plan?.ready, timeout: 60000 },
  { name: 'cost estimate', url: 'studio/cost.html', ready: () => window.__cost?.ready, timeout: 60000 },
];
let failed = 0;
try {
  for (const p of pages) {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log(`    console.error on ${p.name}: ${m.text()}`); });
    const t0 = Date.now();
    try {
      await page.goto(base + p.url, { waitUntil: 'load' });
      await page.waitForFunction(p.ready, null, { timeout: p.timeout, polling: 500 });
      await page.waitForTimeout(1500); // let a few frames run
    } catch (e) {
      errors.push(`not ready: ${e.message.split('\n')[0]}`);
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    if (errors.length) { failed++; console.log(`✗ ${p.name} (${secs} s)\n` + errors.map(e => '    ' + e).join('\n')); }
    else console.log(`✓ ${p.name} (${secs} s)`);
    await ctx.close();
  }
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
console.log(failed ? `\n✗ ${failed} page(s) failed` : '\n✓ all pages load');
process.exit(failed ? 1 : 0);
