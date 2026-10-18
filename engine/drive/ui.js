// Driving HUD: speed + key hints (desktop), gas / brake-reverse pedals on touch screens.
// Getting out is the Interact prompt (engine/interact/controller.js).
import { t } from '../i18n.js';
const CSS = `
#driveHud { position: fixed; left: 50%; bottom: 58px; transform: translateX(-50%); padding: 6px 14px; border-radius: 18px;
  background: rgba(251,248,242,.92); border: 1px solid rgba(58,48,40,.18); color: #3a3028; font: 600 14px Inter, system-ui, sans-serif;
  box-shadow: 0 2px 10px rgba(0,0,0,.15); pointer-events: none; display: flex; gap: 12px; align-items: baseline; white-space: nowrap; }
.touch #driveHud { left: 16px; top: 150px; bottom: auto; transform: none; }
#driveHud b { font-size: 20px; font-variant-numeric: tabular-nums; }
#driveHud small { font-weight: 500; opacity: .75; }
#driveHud.hidden, #drivePedals.hidden { display: none; }
#drivePedals { position: fixed; right: 16px; bottom: 84px; display: flex; flex-direction: column; gap: 14px; align-items: flex-end; touch-action: none; user-select: none; -webkit-user-select: none; }
#drivePedals button, #drivePedals button * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
#drivePedals button { touch-action: none; border: 2px solid rgba(255,255,255,.85); color: #fff; font: 700 15px Inter, system-ui, sans-serif;
  border-radius: 50%; box-shadow: 0 3px 12px rgba(0,0,0,.3); -webkit-tap-highlight-color: transparent; }
#drivePedals .gas { width: 92px; height: 92px; background: rgba(46,125,50,.82); }
#drivePedals .brake { width: 78px; height: 78px; background: rgba(183,28,28,.8); font-size: 13px; line-height: 1.15; }
#drivePedals button.on { filter: brightness(1.25); transform: scale(.96); }
`;

export class DriveUI {
  constructor({ isTouch }) {
    this.isTouch = isTouch;
    this.gas = false; this.brake = false; this.hand = false;
    this.shown = -1;
    if (typeof document === 'undefined') return;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    this.hud = document.createElement('div');
    this.hud.id = 'driveHud'; this.hud.className = 'hidden';
    this.hud.innerHTML = `<b>0</b><span>${t('kmh')}</span><small></small>`;
    this.num = this.hud.querySelector('b'); this.hint = this.hud.querySelector('small');
    document.body.appendChild(this.hud);
    this.pedals = document.createElement('div');
    this.pedals.id = 'drivePedals'; this.pedals.className = 'hidden';
    this.pedals.innerHTML = `<button class="gas">${t('gas')}</button><button class="brake">${t('brake')}</button>`;
    document.body.appendChild(this.pedals);
    const hold = (el, k) => {
      const on = (e) => { e.preventDefault(); this[k] = true; el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ } };
      const off = () => { this[k] = false; el.classList.remove('on'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('lostpointercapture', off);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      // Android/iOS start a text selection (and the magnifier) on a long press unless the touch itself is cancelled
      el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
      el.addEventListener('selectstart', (e) => e.preventDefault());
    };
    hold(this.pedals.querySelector('.gas'), 'gas');
    hold(this.pedals.querySelector('.brake'), 'brake');
  }

  // role: 'driver' | 'passenger' | null
  show(role) {
    if (!this.hud) return;
    this.hud.classList.toggle('hidden', !role);
    this.pedals.classList.toggle('hidden', role !== 'driver' || !this.isTouch);
    this.hint.textContent = role === 'driver'
      ? (this.isTouch ? t('driveHintTouch') : t('driveHintDesk'))
      : role === 'passenger' ? t('passenger') : '';
    if (!role) { this.gas = this.brake = this.hand = false; }
    this.shown = -1;
  }

  speed(kmh) {
    if (!this.num) return;
    const v = Math.round(kmh);
    if (v !== this.shown) { this.shown = v; this.num.textContent = v; }
  }
}
