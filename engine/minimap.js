// 2D minimap that follows the player. Click / tap to teleport on the shown level.
import { GROUND, LEVEL_ORDER, isBasement } from './config.js';
import { t } from './i18n.js';
const SPAN = 40; // metres shown across

export class Minimap {
  constructor(canvas, Z, onTeleport) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.Z = Z;
    this.onTeleport = onTeleport;
    this.level = GROUND;
    this.pinned = false; // true when the user picked a level by hand
    this.center = [Z.site.w / 2, Z.site.d / 2];
    canvas.addEventListener('click', (e) => {
      const b = canvas.getBoundingClientRect();
      const [x, y] = this.toPlan((e.clientX - b.left) * (canvas.width / b.width), (e.clientY - b.top) * (canvas.height / b.height));
      // the garden counts as the ground floor: a click outside the house lands on the ground
      const inHouse = (this.Z.floors[this.level] || []).some(r => x > r.r[0] && x < r.r[2] && y > r.r[1] && y < r.r[3]);
      this.onTeleport(x, y, inHouse || this.level !== GROUND ? this.level : null);
      this.pinned = false;
    });
  }

  setLevel(lv, pinned) {
    this.level = lv;
    this.pinned = pinned;
    document.querySelectorAll('#mmLevels button').forEach(b => b.classList.toggle('on', b.dataset.lv === lv));
  }

  scale() { return this.c.width / SPAN; }
  toPx(x, y) { const s = this.scale(); return [(x - this.center[0]) * s + this.c.width / 2, -(y - this.center[1]) * s + this.c.height / 2]; }
  toPlan(px, py) { const s = this.scale(); return [(px - this.c.width / 2) / s + this.center[0], -(py - this.c.height / 2) / s + this.center[1]]; }

  // markers: other people / pings from the shared session [{ x, y, yaw?, color, ping?, lv }]
  draw(player, lv, markers = []) {
    if (!this.pinned && this.level !== lv) this.setLevel(lv, false);
    this.center = [player.x, player.y];
    const { ctx, c, Z } = this;
    const s = this.scale();
    ctx.fillStyle = '#e9efd9';
    ctx.fillRect(0, 0, c.width, c.height);
    const rect = (r, fill, stroke) => {
      const [x0, y0] = this.toPx(r[0], r[3]), [x1, y1] = this.toPx(r[2], r[1]);
      if (x1 < 0 || y1 < 0 || x0 > c.width || y0 > c.height) return;
      ctx.fillStyle = fill; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); }
    };
    rect([0, 0, Z.site.w, Z.site.d], 'rgba(0,0,0,0)', '#8a7a68');
    const zc = (it) => (Z.zones[it.zone] || {}).color || '#ddd';
    if (!isBasement(this.level)) {
      for (const it of Z.site.items) if (it.r) rect(it.r, zc(it) + 'cc');
      // the floor below, faint, under an upper level
      const below = LEVEL_ORDER[LEVEL_ORDER.indexOf(this.level) - 1];
      if (this.level !== GROUND && below) for (const it of Z.floors[below] || []) rect(it.r, 'rgba(120,100,80,0.12)');
    } else for (const it of Z.floors[GROUND] || []) rect(it.r, 'rgba(120,100,80,0.12)');
    for (const it of Z.outdoor[this.level] || []) if (it.r) rect(it.r, zc(it));
    for (const it of Z.floors[this.level] || []) rect(it.r, zc(it), 'rgba(58,48,40,0.55)');

    // Player arrow (only when on the shown level)
    if (this.level === lv) {
      const [px, py] = this.toPx(player.x, player.y);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(player.yaw);
      ctx.fillStyle = '#b5532f';
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    for (const m of markers) {
      if (m.lv !== this.level) continue;
      const [mx, my] = this.toPx(m.x, m.y);
      if (m.ping) {
        ctx.strokeStyle = m.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(mx, my, 9 + 3 * Math.sin(performance.now() / 150), 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      ctx.save(); ctx.translate(mx, my); ctx.rotate(m.yaw || 0);
      ctx.fillStyle = m.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      if (m.name) { ctx.fillStyle = '#3a3028'; ctx.font = '600 11px Inter, sans-serif'; ctx.fillText(m.name, mx + 8, my - 8); }
    }
    // North marker + scale
    ctx.fillStyle = '#3a3028';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText(t('north'), c.width - 30, 16);
    ctx.fillRect(10, c.height - 12, 10 * s, 2);
    ctx.fillText('10 m', 10, c.height - 16);
  }
}
