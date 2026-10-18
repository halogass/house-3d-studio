// Interior light manager.
//
//   const lights = new LightManager(scene, defs);   // defs in plan coords
//   per frame: lights.update(camera.position, levelId, day, quality);
//
// defs: { x, y, z, color, intensity, distance, level, room, kind } — plan x/y, z = elevation.
// A fixed pool of PointLights (decay 2) is kept in the scene; the first `budget` are visible
// (ultra 12, high 8, low 4) so shader programs only recompile when the quality changes.
// Each pool slot is assigned one of the nearest defs (same level first) and fades in/out.
// Lamps glow at night and fade by day; basement levels are always lit; exterior
// lights (no level / level 'site') are off by day; lamps of windowless rooms (def.enclosed) stay at
// 80 % by day. def.rtDrop: the point light hangs that much below the fixture (ceiling LEDs: no hot
// spot on the ceiling right above a point light). A visitor outdoors gets the garden lamps first
// (the house's lamps behind walls light nothing out there), indoors the house's.
import * as THREE from 'three';
import { LEVEL_ORDER, isBasement } from '../config.js';

const BUDGET = { ultra: 12, high: 8, low: 4 };
const MAX = 12;
const BASEMENT = new Set(LEVEL_ORDER.filter(isBasement));
const INDOOR = new Set(LEVEL_ORDER);

export class LightManager {
  constructor(scene, defs = [], { intensityScale = 1, otherLevelPenalty = 30, maxDistance = 45 } = {}) {
    this.scene = scene;
    this.intensityScale = intensityScale;
    this.otherLevelPenalty = otherLevelPenalty;
    this.maxDistance = maxDistance;
    this.group = new THREE.Group();
    this.group.name = 'LightManager';
    scene.add(this.group);
    this.slots = [];
    for (let i = 0; i < MAX; i++) {
      const light = new THREE.PointLight(0xffd8a8, 0, 6, 2);
      light.castShadow = false;
      light.visible = false;
      this.group.add(light);
      this.slots.push({ light, def: null, fade: 0 });
    }
    this.budget = 0;
    this._timer = Infinity;
    this._lastPos = new THREE.Vector3(1e9, 0, 0);
    this._lastLevel = null;
    this._last = performance.now();
    this.setDefs(defs);
  }

  setDefs(defs) {
    this.defs = (defs || []).map((d) => ({
      ...d,
      pos: new THREE.Vector3(d.x, d.z - (d.rtDrop || 0), -d.y),
      col: new THREE.Color(d.color || '#ffd8a8'),
      intensity: d.intensity ?? 4,
      distance: d.distance ?? 6,
    }));
    for (const s of this.slots) { s.def = null; s.fade = 0; }
    this._timer = Infinity;
  }

  // More defs (a building stage landed): appended, the lit slots keep their lamps
  addDefs(defs) {
    for (const d of defs || []) this.defs.push({
      ...d,
      pos: new THREE.Vector3(d.x, d.z - (d.rtDrop || 0), -d.y),
      col: new THREE.Color(d.color || '#ffd8a8'),
      intensity: d.intensity ?? 4,
      distance: d.distance ?? 6,
    });
    this._timer = Infinity; // reassign on the next update
  }

  // How "on" a def is for the given daylight (0 night .. 1 noon).
  onFactor(def, day) {
    if (BASEMENT.has(def.level)) return 1;
    if (def.enclosed) return Math.max(0.8, 0.12 + 0.88 * (1 - day)); // windowless room: on by day (= BAKE_GAIN.enclosedDayLamps)
    if (!INDOOR.has(def.level) || def.outdoor) return 1 - Math.min(1, day * 1.5); // exterior (or outdoor on a level, e.g. a balcony): off by day
    return 0.12 + 0.88 * (1 - day);                                // interior lamps: dim by day
  }

  _assign(camPos, levelId, budget) {
    const scored = [];
    for (const d of this.defs) {
      const dist = d.pos.distanceTo(camPos);
      if (dist > this.maxDistance + d.distance) continue;
      const out = d.room === 'exterior' || !!d.outdoor || !INDOOR.has(d.level);
      scored.push([dist + (d.level === levelId || out ? 0 : this.otherLevelPenalty) + (this._outside === undefined || out === this._outside ? 0 : 14), d]);
    }
    scored.sort((a, b) => a[0] - b[0]);
    const want = new Set(scored.slice(0, budget).map((s) => s[1]));
    const active = this.slots.slice(0, budget);
    // keep slots whose def is still wanted, free the others (they fade out first)
    for (const s of active) {
      if (s.def && want.has(s.def)) want.delete(s.def);
      else if (s.def) s.leaving = true;
    }
    for (const s of active) {
      if (!want.size) break;
      if (!s.def || (s.leaving && s.fade <= 0.001)) {
        const d = want.values().next().value;
        want.delete(d);
        s.def = d; s.leaving = false; s.fade = 0;
        s.light.position.copy(d.pos);
        s.light.color.copy(d.col);
        s.light.distance = d.distance;
      }
    }
    // a slot still fading out keeps its def until it reaches 0; a pending def gets it next round
    this._pending = want.size > 0;
  }

  update(camPos, levelId, day = 1, quality = 'high', outside = undefined) {
    if (outside !== this._outside) { this._outside = outside; this._timer = Infinity; }
    const now = performance.now();
    const dt = Math.min(0.1, (now - this._last) / 1000);
    this._last = now;
    const budget = BUDGET[quality] ?? BUDGET.high;
    if (budget !== this.budget) {
      this.budget = budget;
      this.slots.forEach((s, i) => {
        s.light.visible = i < budget;
        if (i >= budget) { s.def = null; s.fade = 0; s.light.intensity = 0; }
      });
      this._timer = Infinity;
    }
    this._timer += dt;
    const moved = camPos.distanceToSquared(this._lastPos) > 0.25;
    if (this._timer > 0.25 && (moved || levelId !== this._lastLevel || this._pending || this._timer > 2)) {
      this._assign(camPos, levelId, budget);
      this._lastPos.copy(camPos);
      this._lastLevel = levelId;
      this._timer = 0;
    }
    const step = dt / 0.35; // fade time
    for (let i = 0; i < budget; i++) {
      const s = this.slots[i];
      if (!s.def) { s.light.intensity = 0; continue; }
      s.fade = s.leaving ? Math.max(0, s.fade - step) : Math.min(1, s.fade + step);
      s.light.intensity = s.def.intensity * this.intensityScale * this.onFactor(s.def, day) * s.fade;
      if (s.leaving && s.fade === 0) { s.def = null; s.leaving = false; this._pending = true; }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.slots.forEach((s) => s.light.dispose());
  }
}
