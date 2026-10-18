// Chromium for the bake and the browser tests, on the real GPU where there is one.
//   Windows: ANGLE on Direct3D 11 (--use-angle=d3d11); the adapter can be picked with --gpu <i>
//            (ANGLE's --use-adapter-luid is not stable across drivers, so --gpu only sets the
//            high-performance preference: laptops then use the discrete GPU).
//   macOS:   ANGLE on Metal (--use-angle=metal).
//   Linux:   ANGLE on OpenGL (--use-angle=gl); --gpu <i> on a multi-GPU NVIDIA box renders on card i
//            through PRIME render offload (the X screen's card is BAKE_DISPLAY_GPU, default 0).
// Without a usable GPU Chromium falls back to SwiftShader (software): gpuInfo() tells, so the
// bake can skip instead of crawling for hours.
// Chromium itself: Playwright's (`npx playwright-core install chromium`) or CHROME=/path/to/chrome.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';

export function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(homedir(), '.cache', 'ms-playwright'),                       // Linux
    join(homedir(), 'Library', 'Caches', 'ms-playwright'),            // macOS
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright'), // Windows
  ].filter(Boolean);
  for (const b of roots) {
    if (!existsSync(b)) continue;
    const dirs = readdirSync(b).filter(d => /^chromium-\d+$/.test(d)).sort((a, c) => +c.split('-')[1] - +a.split('-')[1]);
    for (const d of dirs) for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-win64/chrome.exe', 'chrome-win/chrome.exe',
      'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
      'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing']) {
      const p = join(b, d, sub);
      if (existsSync(p)) return p;
    }
  }
  // installed browsers
  const sys = {
    win32: [join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  }[platform()] || [];
  return sys.find(existsSync);
}

// Launch options for chromium.launch()
export function gpuLaunchOptions({ gpu = null, headless = true } = {}) {
  const os = platform();
  const angle = os === 'win32' ? 'd3d11' : os === 'darwin' ? 'metal' : 'gl';
  const args = [`--use-angle=${angle}`, '--ignore-gpu-blocklist', '--enable-gpu', '--disable-gpu-watchdog',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-unsafe-swiftshader'];
  if (os === 'win32' && gpu != null) args.push('--force_high_performance_gpu');
  const env = { ...process.env };
  if (os === 'linux' && gpu != null && String(process.env.BAKE_DISPLAY_GPU ?? '0') !== String(gpu)) {
    Object.assign(env, { __NV_PRIME_RENDER_OFFLOAD: '1', __NV_PRIME_RENDER_OFFLOAD_PROVIDER: 'NVIDIA-G' + gpu, __GLX_VENDOR_LIBRARY_NAME: 'nvidia' });
  }
  return { executablePath: chromePath(), headless, args, env };
}

// What the page renders with: { name, software }
export async function gpuInfo(page) {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return { name: 'none', software: true };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return { name, software: /swiftshader|llvmpipe|software|basic render/i.test(name) };
  });
}
