// Procedural canvas textures (immediate fallback + decor that has no CC0 photo source)
// and the async loader for the photo PBR sets in public/textures/.
// Each tiling texture covers `size` metres; geometry UVs are in metres, so
// texture.repeat = 1 / size.
import * as THREE from 'three';
import { TEXTURE_FILES } from './texture-files.js';

function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function canvas(px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  return [c, c.getContext('2d')];
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * f));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) * f));
  const b = Math.min(255, Math.max(0, (n & 255) * f));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function noise(ctx, px, amount, rand, alpha = 0.06) {
  for (let i = 0; i < amount; i++) {
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    const s = 1 + rand() * 3;
    ctx.fillRect(rand() * px, rand() * px, s, s);
  }
}

function finish(c, size, anisotropy) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  t.repeat.set(1 / size, 1 / size);
  t.userData.size = size;
  return t;
}

// Wood planks: 0.18 m wide boards, staggered joints. Covers 2 m.
function wood(base, seed, aniso) {
  const px = 512, [c, ctx] = canvas(px), rand = rng(seed);
  const boards = 11, bw = px / boards;
  for (let i = 0; i < boards; i++) {
    let y = -rand() * px;
    while (y < px) {
      const len = px * (0.35 + rand() * 0.5);
      ctx.fillStyle = shade(base, 0.9 + rand() * 0.16);
      ctx.fillRect(i * bw, y, bw, len);
      for (let k = 0; k < 6; k++) {
        ctx.strokeStyle = `rgba(0,0,0,${0.05 + rand() * 0.06})`;
        ctx.lineWidth = 1;
        const gx = i * bw + rand() * bw;
        ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + (rand() - 0.5) * 4, y + len); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(i * bw, y, bw, 1.5);
      y += len;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(i * bw, 0, 1.5, px);
  }
  return finish(c, 2, aniso);
}

// Square tiles with grout lines. `tiles` per texture, covering `size` metres.
function tiles(base, grout, tilesPer, size, seed, aniso, variation = 0.08) {
  const px = 512, [c, ctx] = canvas(px), rand = rng(seed);
  const t = px / tilesPer;
  for (let i = 0; i < tilesPer; i++) for (let j = 0; j < tilesPer; j++) {
    ctx.fillStyle = shade(base, 1 - variation + rand() * variation * 2);
    ctx.fillRect(i * t, j * t, t, t);
  }
  noise(ctx, px, 4000, rand, 0.04);
  ctx.fillStyle = grout;
  for (let i = 0; i <= tilesPer; i++) {
    ctx.fillRect(i * t - 1, 0, 2, px);
    ctx.fillRect(0, i * t - 1, px, 2);
  }
  return finish(c, size, aniso);
}

function speckle(base, size, seed, aniso, amount = 9000, alpha = 0.07) {
  const px = 256, [c, ctx] = canvas(px), rand = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, px, px);
  noise(ctx, px, amount, rand, alpha);
  return finish(c, size, aniso);
}

function grass(aniso) {
  const px = 512, [c, ctx] = canvas(px), rand = rng(7);
  ctx.fillStyle = '#7f9a52';
  ctx.fillRect(0, 0, px, px);
  for (let i = 0; i < 26000; i++) {
    const g = 110 + rand() * 70;
    ctx.fillStyle = `rgba(${g * 0.55 | 0},${g | 0},${g * 0.35 | 0},0.35)`;
    ctx.fillRect(rand() * px, rand() * px, 1.5, 3 + rand() * 4);
  }
  return finish(c, 6, aniso);
}

// Terracotta roof: rows of barrel tiles. Covers 2 m.
function terracotta(aniso) {
  const px = 512, [c, ctx] = canvas(px), rand = rng(11);
  const rows = 8, cols = 10, rh = px / rows, cw = px / cols;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x = k * cw, y = r * rh;
    const g = ctx.createLinearGradient(x, 0, x + cw, 0);
    const f = 0.85 + rand() * 0.25;
    g.addColorStop(0, shade('#a9583a', f * 0.75));
    g.addColorStop(0.5, shade('#c46f48', f));
    g.addColorStop(1, shade('#a9583a', f * 0.7));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, cw, rh);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y + rh - 3, cw, 3);
  }
  return finish(c, 2, aniso);
}

// Stone pavers (running bond). Covers 2 m.
function pavers(base, seed, aniso) {
  const px = 512, [c, ctx] = canvas(px), rand = rng(seed);
  const rows = 5, rh = px / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -rh / 2 : 0;
    while (x < px) {
      const w = rh * (1 + rand() * 0.8);
      ctx.fillStyle = shade(base, 0.88 + rand() * 0.2);
      ctx.fillRect(x, r * rh, w, rh);
      ctx.fillStyle = 'rgba(80,60,40,0.35)';
      ctx.fillRect(x, r * rh, 2, rh);
      x += w;
    }
    ctx.fillStyle = 'rgba(80,60,40,0.35)';
    ctx.fillRect(0, r * rh, px, 2);
  }
  noise(ctx, px, 5000, rand, 0.05);
  return finish(c, 2, aniso);
}

// ---------------------------------------------------------------- decor (procedural)
// These map once over a 0..1 UV range (rugs, paintings) or tile at a stated size.

function finishOnce(c, anisotropy, repeat = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  t.repeat.set(repeat[0], repeat[1]);
  return t;
}

function canvasWH(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// Persian rug: guard stripes, main border with a running motif, field with a
// lattice of small boteh/rosettes, a layered central medallion and corner spandrels.
function persianRug(p, seed, aniso) {
  const W = 1024, H = 1536, [c, ctx] = canvasWH(W, H), rand = rng(seed);
  ctx.fillStyle = p.field; ctx.fillRect(0, 0, W, H);
  // field lattice
  const step = 64;
  for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) {
    const off = ((y / step) | 0) % 2 ? step / 2 : 0;
    const cx = x + off, cy = y;
    ctx.fillStyle = p.motif;
    ctx.beginPath(); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx + 9, cy); ctx.lineTo(cx, cy + 14); ctx.lineTo(cx - 9, cy); ctx.fill();
    ctx.fillStyle = p.accent;
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.motif; ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
      ctx.quadraticCurveTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 16, cx + Math.cos(a) * 26, cy + Math.sin(a) * 26); ctx.stroke();
    }
  }
  // central medallion (concentric lobed lozenges)
  const mx = W / 2, my = H / 2;
  const lobe = (rx, ry, n, fill) => {
    ctx.fillStyle = fill; ctx.beginPath();
    for (let i = 0; i <= 360; i += 2) {
      const a = i * Math.PI / 180, wob = 1 + 0.08 * Math.cos(a * n);
      const d = Math.pow(Math.abs(Math.cos(a)), 1.4) + Math.pow(Math.abs(Math.sin(a)), 1.4);
      const k = wob / Math.pow(d, 1 / 1.4);
      const x = mx + Math.cos(a) * rx * k, y = my + Math.sin(a) * ry * k;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.fill();
  };
  lobe(300, 420, 16, p.border);
  lobe(270, 385, 16, p.medallion);
  lobe(190, 270, 12, p.accent);
  lobe(150, 215, 12, p.field);
  lobe(95, 135, 8, p.motif);
  lobe(55, 80, 8, p.medallion);
  ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(mx, my, 22, 0, Math.PI * 2); ctx.fill();
  // pendants above/below the medallion
  for (const s of [-1, 1]) {
    ctx.fillStyle = p.border;
    ctx.beginPath(); ctx.moveTo(mx - 40, my + s * 430); ctx.lineTo(mx, my + s * 520); ctx.lineTo(mx + 40, my + s * 430); ctx.fill();
    ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(mx, my + s * 470, 12, 0, Math.PI * 2); ctx.fill();
  }
  // corner spandrels
  const bw = 150;
  for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const x = sx ? W - bw : bw, y = sy ? H - bw : bw;
    ctx.fillStyle = p.medallion;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + (sx ? -260 : 260), y); ctx.quadraticCurveTo(x + (sx ? -150 : 150), y + (sy ? -150 : 150), x, y + (sy ? -260 : 260));
    ctx.fill();
  }
  // borders: outer guard, main band with running motif, inner guard
  const band = (inset, wdt, fill) => { ctx.strokeStyle = fill; ctx.lineWidth = wdt; ctx.strokeRect(inset + wdt / 2, inset + wdt / 2, W - 2 * inset - wdt, H - 2 * inset - wdt); };
  band(0, 22, p.guard);
  band(22, 8, p.accent);
  band(30, 100, p.border);
  band(130, 8, p.accent);
  band(138, 12, p.guard);
  ctx.fillStyle = p.motif;
  const runner = (x, y) => {
    ctx.beginPath(); ctx.ellipse(x, y, 16, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = p.motif;
  };
  for (let x = 80; x < W - 60; x += 70) { runner(x, 80); runner(x, H - 80); }
  for (let y = 150; y < H - 120; y += 70) { runner(80, y); runner(W - 80, y); }
  // abrash (colour banding) + wool noise + wear
  for (let y = 0; y < H; y += 6) {
    ctx.fillStyle = `rgba(0,0,0,${0.02 + 0.05 * Math.abs(Math.sin(y * 0.013 + seed))})`;
    ctx.fillRect(0, y, W, 6);
  }
  noise(ctx, W, 60000, rand, 0.05);
  const g = ctx.createRadialGradient(mx, my, 100, mx, my, 900);
  g.addColorStop(0, 'rgba(255,240,220,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  return finishOnce(c, aniso);
}

// Sage trellis rug (living room inspo).
function trellisRug(aniso) {
  const W = 1024, H = 1536, [c, ctx] = canvasWH(W, H), rand = rng(83);
  ctx.fillStyle = '#9aa585'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#ebe3cf'; ctx.lineWidth = 7;
  const s = 96;
  for (let y = -s; y < H + s; y += s) for (let x = -s; x < W + s; x += s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s / 2);
    ctx.quadraticCurveTo(x + s / 2, y + s / 2 - 34, x + s, y + s / 2);
    ctx.quadraticCurveTo(x + s / 2, y + s / 2 + 34, x, y + s / 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#ebe3cf'; ctx.lineWidth = 26; ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = '#7b8669'; ctx.lineWidth = 8; ctx.strokeRect(78, 78, W - 156, H - 156);
  noise(ctx, W, 50000, rand, 0.05);
  return finishOnce(c, aniso);
}

// Damask wallpaper: symmetric baroque motif in half-drop repeat. Tile = 0.53 m.
function damask(base, ink, aniso) {
  const px = 512, [c, ctx] = canvas(px), rand = rng(89);
  ctx.fillStyle = base; ctx.fillRect(0, 0, px, px);
  const motif = (cx, cy, s) => {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    ctx.fillStyle = ink;
    for (const m of [1, -1]) {
      ctx.save(); ctx.scale(m, 1);
      ctx.beginPath();
      ctx.moveTo(0, -100);
      ctx.bezierCurveTo(30, -80, 55, -60, 40, -30);
      ctx.bezierCurveTo(85, -40, 95, 10, 60, 20);
      ctx.bezierCurveTo(80, 50, 55, 85, 20, 70);
      ctx.bezierCurveTo(25, 90, 10, 105, 0, 110);
      ctx.lineTo(0, -100); ctx.fill();
      // scroll curls
      ctx.lineWidth = 5; ctx.strokeStyle = ink;
      ctx.beginPath(); ctx.arc(70, -55, 16, 0.5, Math.PI * 1.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(75, 60, 14, -1.5, Math.PI); ctx.stroke();
      ctx.restore();
    }
    // carve the centre
    ctx.fillStyle = base;
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 46, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -62, 8, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  const s = 0.95;
  motif(px / 4, px / 4, s); motif(px * 3 / 4, px * 3 / 4, s);
  motif(px * 3 / 4, -px / 4, s); motif(px / 4, px * 5 / 4, s);
  // small sprigs between
  ctx.fillStyle = ink;
  for (const [x, y] of [[px * 3 / 4, px / 4], [px / 4, px * 3 / 4]]) {
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 14, y + Math.sin(a) * 14, 5, 11, a + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  noise(ctx, px, 8000, rand, 0.025);
  return finish(c, 0.53, aniso);
}

// Book spines strip: one row of books across the 0..1 U range (repeat set per use).
function books(aniso) {
  const W = 1024, H = 256, [c, ctx] = canvasWH(W, H), rand = rng(97);
  ctx.fillStyle = '#1b1612'; ctx.fillRect(0, 0, W, H);
  const pal = ['#5b1d1d', '#1f2f4a', '#24402d', '#6b4a2b', '#2a2522', '#8a6a3a', '#d8cdb5', '#4a2533', '#3c4f5a', '#7a2e22'];
  let x = 0;
  while (x < W) {
    const w = 14 + rand() * 30, h = H * (0.72 + rand() * 0.28);
    const col = pal[(rand() * pal.length) | 0];
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, shade(col.length === 7 ? col : '#555555', 0.65));
    g.addColorStop(0.35, col); g.addColorStop(0.7, shade(col, 1.12)); g.addColorStop(1, shade(col, 0.6));
    ctx.fillStyle = g; ctx.fillRect(x, H - h, w - 1, h);
    ctx.fillStyle = rand() > 0.4 ? 'rgba(212,175,95,0.85)' : 'rgba(20,15,10,0.5)';
    const b = H - h + 14 + rand() * 10;
    ctx.fillRect(x + 1, b, w - 3, 3); ctx.fillRect(x + 1, H - 20, w - 3, 3);
    ctx.fillRect(x + w * 0.3, b + 14, w * 0.35, 30 + rand() * 40);
    x += w;
  }
  noise(ctx, W, 9000, rand, 0.05);
  return finishOnce(c, aniso);
}

// Classic landscape paintings (oil look).
function painting(variant, aniso) {
  const W = 1024, H = 768, [c, ctx] = canvasWH(W, H), rand = rng(101 + variant);
  const skies = [['#f3c98b', '#e7a76a', '#8fa6b8'], ['#a9c3d6', '#d9e2e0', '#f2e3c4'], ['#6f8ea8', '#b9c7cc', '#e8d6b0']];
  const [s0, s1, s2] = skies[variant];
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  g.addColorStop(0, s2); g.addColorStop(0.6, s1); g.addColorStop(1, s0);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // clouds
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(255,250,240,${0.12 + rand() * 0.2})`;
    ctx.beginPath(); ctx.ellipse(rand() * W, rand() * H * 0.35, 60 + rand() * 120, 14 + rand() * 26, 0, 0, Math.PI * 2); ctx.fill();
  }
  const hills = (y0, amp, col, n) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y0 + Math.sin(x * 0.006 * n + variant) * amp + Math.sin(x * 0.017 + n) * amp * 0.35);
    ctx.lineTo(W, H); ctx.fill();
  };
  if (variant === 2) {
    // seascape with cliffs
    ctx.fillStyle = '#4f7486'; ctx.fillRect(0, H * 0.5, W, H * 0.5);
    for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(240,240,230,${rand() * 0.25})`; ctx.fillRect(rand() * W, H * 0.5 + rand() * H * 0.5, 20 + rand() * 50, 2); }
    ctx.fillStyle = '#6b5a45'; ctx.beginPath(); ctx.moveTo(W, H * 0.25); ctx.lineTo(W * 0.62, H * 0.55); ctx.lineTo(W * 0.55, H); ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = '#4c6a3c'; ctx.beginPath(); ctx.moveTo(W, H * 0.22); ctx.lineTo(W * 0.7, H * 0.38); ctx.lineTo(W * 0.66, H * 0.43); ctx.lineTo(W, H * 0.3); ctx.fill();
    hills(H * 0.86, 18, '#c8b48a', 1);
  } else {
    hills(H * 0.5, 30, variant ? '#8ea0a8' : '#a9a08a', 1.2);
    hills(H * 0.6, 26, variant ? '#6f8a5e' : '#9a8f55', 2);
    if (variant === 1) { ctx.fillStyle = '#9fb7c0'; ctx.fillRect(0, H * 0.7, W, H * 0.12); }
    hills(H * 0.8, 20, variant ? '#4f6b3c' : '#7e7a3a', 3);
    // cypress / round trees
    for (let i = 0; i < 14; i++) {
      const x = rand() * W, y = H * (0.55 + rand() * 0.3), s = 0.6 + rand() * 0.8;
      ctx.fillStyle = '#2f3f22';
      if (variant === 0) { ctx.beginPath(); ctx.ellipse(x, y - 50 * s, 10 * s, 55 * s, 0, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(x, y - 30 * s, 34 * s, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3f5530'; ctx.beginPath(); ctx.arc(x - 8 * s, y - 38 * s, 20 * s, 0, Math.PI * 2); ctx.fill(); }
    }
    if (variant === 0) {
      // villa
      ctx.fillStyle = '#e5c99a'; ctx.fillRect(W * 0.6, H * 0.5, 120, 60);
      ctx.fillStyle = '#a5523a'; ctx.beginPath(); ctx.moveTo(W * 0.6 - 8, H * 0.5); ctx.lineTo(W * 0.6 + 60, H * 0.5 - 26); ctx.lineTo(W * 0.6 + 128, H * 0.5); ctx.fill();
    }
  }
  // brush texture + varnish
  for (let i = 0; i < 9000; i++) {
    ctx.strokeStyle = `rgba(${rand() > 0.5 ? '255,245,225' : '30,20,10'},0.05)`;
    ctx.lineWidth = 1 + rand() * 3;
    const x = rand() * W, y = rand() * H, a = rand() * 0.6 - 0.3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); ctx.stroke();
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
  v.addColorStop(0, 'rgba(255,220,150,0.05)'); v.addColorStop(1, 'rgba(60,35,10,0.35)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  return finishOnce(c, aniso);
}

// Cream floral quilt: scattered rose sprigs + diamond quilting. Tile = 0.6 m.
function quiltFloral(aniso) {
  const px = 512, [c, ctx] = canvas(px), rand = rng(103);
  ctx.fillStyle = '#efe6d3'; ctx.fillRect(0, 0, px, px);
  for (let i = 0; i < 46; i++) {
    const x = rand() * px, y = rand() * px;
    ctx.fillStyle = '#7d9466';
    for (let k = 0; k < 3; k++) { const a = rand() * 6.28; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 12, y + Math.sin(a) * 12, 4, 9, a, 0, Math.PI * 2); ctx.fill(); }
    const col = ['#c9747a', '#b8505c', '#d99a8f', '#e2c27a'][(rand() * 4) | 0];
    for (let k = 0; k < 5; k++) { const a = k * 1.256; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = shade(col, 0.7); ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(120,100,80,0.25)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
  for (let k = -px; k < px * 2; k += 64) {
    ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + px, px); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(k, px); ctx.lineTo(k + px, 0); ctx.stroke();
  }
  noise(ctx, px, 6000, rand, 0.03);
  return finish(c, 0.6, aniso);
}

// Pegboard: 25 mm holes on a 50 mm grid (tile = 0.2 m).
function pegboard(aniso) {
  const px = 256, [c, ctx] = canvas(px), rand = rng(107);
  ctx.fillStyle = '#b48c62'; ctx.fillRect(0, 0, px, px);
  noise(ctx, px, 3000, rand, 0.05);
  ctx.fillStyle = '#2a2018';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(32 + i * 64, 32 + j * 64, 7, 0, Math.PI * 2); ctx.fill(); }
  return finish(c, 0.2, aniso);
}

// Woven wire mesh (pet enclosure / net): transparent background, dark wires on a 2.5 cm grid.
// Covers 0.05 m (2 × 2 cells); use with alpha (transparent) materials.
function wireMesh(aniso) {
  const px = 64, [c, ctx] = canvas(px);
  ctx.clearRect(0, 0, px, px);
  ctx.fillStyle = '#1b1b1b';
  for (let i = 0; i < 2; i++) {
    ctx.fillRect(i * 32, 0, 2, px);
    ctx.fillRect(0, i * 32, px, 2);
  }
  return finish(c, 0.05, aniso);
}

// ---------------------------------------------------------------- exports
export function makeTextures(renderer) {
  const a = renderer.capabilities.getMaxAnisotropy();
  const T = {
    wood: wood('#9a6a43', 3, a),
    woodDark: wood('#5e3d27', 5, a),
    travertine: tiles('#e2d4bb', 'rgba(150,130,100,0.45)', 3, 1.8, 13, a, 0.05),
    tileGrey: tiles('#bdb8ae', 'rgba(90,90,90,0.4)', 6, 1.8, 17, a),
    tileBath: tiles('#e9e4da', 'rgba(140,130,115,0.4)', 6, 1.8, 19, a, 0.03),
    concrete: speckle('#a9a49b', 3, 23, a, 12000, 0.06),
    epoxy: speckle('#8d939a', 3, 29, a, 6000, 0.04),
    carpet: speckle('#5a2b2b', 1, 31, a, 14000, 0.08),
    rubber: speckle('#3a3d40', 1, 37, a, 10000, 0.06),
    grass: grass(a),
    terracotta: terracotta(a),
    pavers: pavers('#d6c3a2', 41, a),
    paversWarm: pavers('#c99f78', 43, a),
    gravel: speckle('#c8bba4', 1.5, 47, a, 16000, 0.12),
    asphalt: speckle('#55555a', 3, 53, a, 14000, 0.08),
    soil: speckle('#6e5038', 2, 59, a, 14000, 0.1),
    water: speckle('#4f9fb8', 2, 61, a, 4000, 0.05),
    plaster: speckle('#efe6d7', 2, 67, a, 3000, 0.025),
    plasterExt: speckle('#e3cca6', 2, 71, a, 5000, 0.04),
    stone: tiles('#c4ae8c', 'rgba(90,70,50,0.35)', 5, 2, 73, a, 0.06),
  };
  // Decor textures are drawn lazily on first use (some are 1–1.5k canvases).
  const lazy = {
    rugPersianRed: () => persianRug({ field: '#8e2a24', border: '#1f2a44', medallion: '#e3d3b0', motif: '#1f2a44', accent: '#c99a4a', guard: '#e3d3b0' }, 109, a),
    rugPersianCream: () => persianRug({ field: '#e6dcc6', border: '#7a2f2a', medallion: '#9a4a3a', motif: '#8a6f55', accent: '#3f5a6a', guard: '#c9b48e' }, 113, a),
    rugPersianBlue: () => persianRug({ field: '#24345a', border: '#8e2a24', medallion: '#d9c8a2', motif: '#b88a48', accent: '#e6dcc6', guard: '#8e2a24' }, 127, a),
    rugSage: () => trellisRug(a),
    damask: () => damask('#e8dcc2', '#d3c3a1', a),
    books: () => books(a),
    canvasArt1: () => painting(0, a),
    canvasArt2: () => painting(1, a),
    canvasArt3: () => painting(2, a),
    quiltFloral: () => quiltFloral(a),
    pegboard: () => pegboard(a),
    wireMesh: () => wireMesh(a),
  };
  for (const [k, fn] of Object.entries(lazy)) {
    let v;
    Object.defineProperty(T, k, { enumerable: true, get: () => (v ??= fn()) });
  }
  return T;
}

// ---------------------------------------------------------------- photo PBR sets
// public/textures/<name>/{diff,nor,rough}.jpg, loaded asynchronously. `repeat` is
// [u, v] repeats per UV unit (UVs are metres, so 1 / metres-per-tile).
const loader = new THREE.TextureLoader();
export const TEXTURE_BASE = (import.meta.env?.BASE_URL ?? '/') + 'textures/';

// lite (phones/tablets): colour map only, at most 512 px (diff-512.webp) — about a tenth of the GPU
// memory of the full set and a third of the download.
const LITE_MAX = 512;
// WebP copies where they are smaller at the same look (scripts/textures.mjs, engine/texture-files.js);
// the JPG is the fallback when a WebP fails to load.
export function loadPBRSet(name, repeat, anisotropy, lite = false) {
  const has = TEXTURE_FILES[name] || {};
  const fileOf = (file) => lite && file === 'diff' && has.lite ? 'diff-512.webp' : file + (has[file] === 'webp' ? '.webp' : '.jpg');
  const fetchTex = (file) => new Promise((resolve, reject) => {
    const url = TEXTURE_BASE + name + '/' + fileOf(file);
    loader.load(url, resolve, undefined, (e) => {
      if (url.endsWith('.jpg')) return reject(e);
      loader.load(TEXTURE_BASE + name + '/' + file + '.jpg', resolve, undefined, reject);
    });
  });
  const load = (file, srgb) => fetchTex(file).then((t) => {
    const img = t.image;
    if (lite && img && Math.max(img.width, img.height) > LITE_MAX) { // a JPG fallback
      const k = LITE_MAX / Math.max(img.width, img.height), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      t.image = c;
    }
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = anisotropy;
    t.repeat.set(repeat[0], repeat[1]);
    return t;
  });
  if (lite) return load('diff', true).then((map) => ({ map, normalMap: null, roughnessMap: null }));
  return Promise.all([load('diff', true), load('nor', false), load('rough', false)])
    .then(([map, normalMap, roughnessMap]) => ({ map, normalMap, roughnessMap }));
}
