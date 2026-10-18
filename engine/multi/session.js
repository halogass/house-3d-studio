// "Explore together": shared exploration for two (or a few) people.
// Syncs poses (15 Hz, interpolated), the lift, time of day and pings, and runs
// spatial voice chat over WebRTC with signaling through the same realtime channel.
import * as THREE from 'three';
import { connect } from './transport.js';
import { buildAvatar, buildPing } from './avatar.js';
import { LEVELS } from '../config.js';

const POSE_HZ = 15;
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
const turn = import.meta.env.VITE_TURN_URL;
if (turn) ICE.push({ urls: turn, username: import.meta.env.VITE_TURN_USER, credential: import.meta.env.VITE_TURN_CREDENTIAL });

const randomId = () => Math.random().toString(36).slice(2, 10);
export const newRoomCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

export class MultiSession {
  constructor(app) {
    this.app = app;           // { scene, camera, player, physics, lift, currentLevel, teleport, setTime, roomAt, onStatus, onPeers }
    this.me = null;
    this.t = null;
    this.peers = new Map();   // id → { info, avatar, cur, target, speed, last, voice }
    this.pings = [];
    this.sendClock = 0;
    this.liftClock = 0;
    this.local = null;        // local mic stream
    this.muted = false;
    this.audio = null;
  }

  get active() { return !!this.t; }

  async start({ room, name, color }) {
    this.stop();
    this.me = { id: randomId(), name, color };
    this.room = room;
    this.app.onStatus(`Menyambung ke ruang ${room}…`);
    const t = await connect({ room, me: this.me });
    this.t = t;
    t.onPeers((peers) => this.syncPeers(peers));
    t.on('p', (d, from) => this.onPose(d, from));
    t.on('lift', (d) => this.app.lift.request(d.lv));
    t.on('liftState', (d, from) => this.onLiftState(d, from));
    // doors: one message per open / close, a snapshot for newcomers (ties: the smaller peer id wins)
    t.on('door', (d, from) => this.app.doors?.applyRemote(d, from < this.me.id));
    t.on('doorState', (d, from) => this.app.doors?.applySnapshot(d.s, from < this.me.id));
    t.on('doorReq', () => this.sendDoorState());
    t.on('time', (d) => this.app.setTime(d.hour, d.month, false));
    t.on('ping', (d, from) => this.showPing(d, this.peers.get(from)?.info.color || '#ffcc33', this.peers.get(from)?.info.name));
    t.on('sdp', (d, from) => this.onSdp(d, from));
    t.on('ice', (d, from) => this.onIce(d, from));
    t.on('hello', (d, from) => { if (this.local) this.ensurePc(from); });
    this.app.onTransport?.(t); // extra channels (cars: engine/drive)
    t.send('doorReq', {}); // handlers are in place now: ask the others for the doors' state
    this.app.onStatus(`Ruang ${room} · ${t.kind === 'local' ? 'mode uji (tab browser ini)' : 'online'} · menunggu pasangan…`);
  }

  stop() {
    for (const id of [...this.peers.keys()]) this.dropPeer(id);
    if (this.t) this.t.leave();
    this.t = null;
    if (this.local) { this.local.getTracks().forEach(tr => tr.stop()); this.local = null; }
  }

  // ------------------------------------------------------------ peers
  syncPeers(list) {
    for (const [id, info] of list) if (!this.peers.has(id)) this.addPeer(id, info);
    for (const id of [...this.peers.keys()]) if (!list.has(id)) this.dropPeer(id);
    this.app.onPeers([...this.peers.values()].map(p => p.info));
    const n = this.peers.size;
    this.app.onStatus(`Ruang ${this.room} · ${n ? n + ' orang bergabung' : 'menunggu pasangan…'}`);
    if (this.local) for (const id of this.peers.keys()) this.ensurePc(id);
    // Newcomers need the current time and lift state
    this.app.setTime(null, null, true);
    this.sendLiftState(true);
    this.sendDoorState();
    this.app.onPeersChanged?.();
  }

  addPeer(id, info) {
    const avatar = buildAvatar(info.name || 'Tamu', info.color || '#4d7ea8');
    avatar.visible = false;
    this.app.scene.add(avatar);
    this.peers.set(id, { id, info, avatar, cur: null, target: null, speed: 0, last: 0, voice: null });
  }

  dropPeer(id) {
    const p = this.peers.get(id);
    if (!p) return;
    this.app.scene.remove(p.avatar);
    if (p.voice) { p.voice.pc.close(); p.voice.el?.remove(); }
    this.peers.delete(id);
  }

  onPose(d, from) {
    const p = this.peers.get(from);
    if (!p) return;
    const now = performance.now();
    if (p.target) {
      const dt = Math.max(0.03, (now - p.last) / 1000);
      p.speed = Math.hypot(d.x - p.target.x, d.y - p.target.y) / dt;
    }
    p.target = d; p.last = now;
    if (!p.cur) p.cur = { ...d };
    p.avatar.visible = true;
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    if (!this.t) return;
    const pl = this.app.player;
    this.sendClock += dt;
    if (this.sendClock >= 1 / POSE_HZ) {
      this.sendClock = 0;
      const st = this.app.seat?.();   // { id, kind, h } while sitting / lying
      this.t.send('p', { x: +pl.x.toFixed(3), y: +pl.y.toFixed(3), e: +pl.e.toFixed(3), yaw: +pl.yaw.toFixed(3), lv: this.app.currentLevel(),
        ...(st ? { seat: st.id, pose: st.kind, sh: st.h, sy: +st.yaw.toFixed(3) } : {}) });
    }
    // The peer with the smallest id is the lift's reference
    this.liftClock += dt;
    if (this.liftClock > 1) { this.liftClock = 0; this.sendLiftState(false); }
    this.doorClock = (this.doorClock || 0) + dt;
    if (this.doorClock > 10) { this.doorClock = 0; this.sendDoorState(); } // heals a lost door message

    const k = 1 - Math.exp(-dt * 12);
    for (const p of this.peers.values()) {
      if (!p.cur || !p.target) continue;
      p.cur.x += (p.target.x - p.cur.x) * k;
      p.cur.y += (p.target.y - p.cur.y) * k;
      p.cur.e += (p.target.e - p.cur.e) * k;
      let dy = p.target.yaw - p.cur.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      p.cur.yaw += dy * k;
      const pose = p.target.pose || 'stand';
      p.avatar.userData.setPose(pose);
      if (pose === 'stand') {
        p.avatar.position.set(p.cur.x, p.cur.e, -p.cur.y);
        p.avatar.rotation.y = -p.cur.yaw;
      } else {
        // Seated poses snap to the seat (the body faces the seat, not where the partner looks)
        const t = p.target, yaw = t.sy ?? t.yaw, fx = Math.sin(yaw), fy = Math.cos(yaw);
        p.cur = { ...t };
        if (pose === 'sit') p.avatar.position.set(t.x - fx * 0.05, t.e + t.sh - 0.86, -(t.y - fy * 0.05));
        // lying: the slot is the head, the feet (avatar origin) lie 1.62 m towards the foot end
        else p.avatar.position.set(t.x + fx * 1.62, t.e + t.sh + 0.14, -(t.y + fy * 1.62));
        p.avatar.rotation.set(pose === 'lie' ? Math.PI / 2 : 0, -yaw, 0, 'YXZ');
      }
      p.avatar.userData.animate(dt, performance.now() - p.last > 400 ? 0 : p.speed);
      if (p.voice?.panner) {
        const pn = p.voice.panner, a = this.audio;
        const t = a.currentTime;
        pn.positionX.setTargetAtTime(p.cur.x, t, 0.05);
        pn.positionY.setTargetAtTime(p.cur.e + 1.6, t, 0.05);
        pn.positionZ.setTargetAtTime(-p.cur.y, t, 0.05);
      }
    }
    if (this.audio) {
      const L = this.audio.listener, c = this.app.camera, t = this.audio.currentTime;
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion), u = new THREE.Vector3(0, 1, 0).applyQuaternion(c.quaternion);
      if (L.positionX) {
        L.positionX.setTargetAtTime(c.position.x, t, 0.05); L.positionY.setTargetAtTime(c.position.y, t, 0.05); L.positionZ.setTargetAtTime(c.position.z, t, 0.05);
        L.forwardX.setTargetAtTime(f.x, t, 0.05); L.forwardY.setTargetAtTime(f.y, t, 0.05); L.forwardZ.setTargetAtTime(f.z, t, 0.05);
        L.upX.setTargetAtTime(u.x, t, 0.05); L.upY.setTargetAtTime(u.y, t, 0.05); L.upZ.setTargetAtTime(u.z, t, 0.05);
      } else { L.setPosition(c.position.x, c.position.y, c.position.z); L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z); }
    }
    // Pings fade out after 12 s
    const now = performance.now();
    this.pings = this.pings.filter(pg => {
      const age = (now - pg.born) / 1000;
      if (age > 12) { this.app.scene.remove(pg.obj); return false; }
      const s = 1 + 0.25 * Math.sin(age * 6);
      pg.obj.userData.ring.scale.set(s, s, s);
      return true;
    });
  }

  // Seat ids the partners are using (so nobody sits on someone's lap)
  occupiedSeats() {
    const s = new Set();
    for (const p of this.peers.values()) if (p.target?.seat && performance.now() - p.last < 3000) s.add(p.target.seat);
    return s;
  }

  peerMarkers() {
    return [...this.peers.values()].filter(p => p.cur).map(p => ({ x: p.cur.x, y: p.cur.y, e: p.cur.e, yaw: p.cur.yaw, color: p.info.color, name: p.info.name, lv: p.target.lv }))
      .concat(this.pings.map(pg => ({ x: pg.x, y: pg.y, e: pg.e, color: pg.color, ping: true, lv: pg.lv })));
  }

  peerSummary(roomAt) {
    return [...this.peers.values()].filter(p => p.target).map(p => `${p.info.name}: ${LEVELS[p.target.lv]?.name || ''} · ${roomAt(p.target.lv, p.target.x, p.target.y)}`);
  }

  // ------------------------------------------------------------ actions
  follow() {
    const p = [...this.peers.values()].find(q => q.target);
    if (!p) return false;
    const { x, y, lv, yaw } = p.target;
    // Arrive a step behind them, looking the same way
    const bx = x - Math.sin(yaw) * 2.0, by = y - Math.cos(yaw) * 2.0;
    return this.app.teleport(bx, by, lv, yaw) || this.app.teleport(x + 0.6, y, lv, yaw);
  }

  sendLift(lv) { this.t?.send('lift', { lv }); }
  sendDoor(m) { this.t?.send('door', m); }
  sendDoorState() {
    const s = this.app.doors?.snapshot();
    if (this.t && s && s.length) this.t.send('doorState', { s });
  }
  sendTime(hour, month) { this.t?.send('time', { hour, month }); }

  sendLiftState(force) {
    if (!this.t) return;
    const ids = [this.me.id, ...this.peers.keys()].sort();
    if (ids[0] !== this.me.id && !force) return;
    if (ids[0] !== this.me.id) return;
    const L = this.app.lift;
    this.t.send('liftState', { level: L.level, y: L.y, phase: L.phase, target: L.target, open: L.open });
  }

  onLiftState(d, from) {
    const ids = [this.me.id, ...this.peers.keys()].sort();
    if (ids[0] !== from) return; // only the reference peer is authoritative
    const L = this.app.lift;
    if (L.rider) return;          // never yank a rider
    if (Math.abs(L.y - d.y) > 0.3 || L.level !== d.level || L.target !== d.target) Object.assign(L, { level: d.level, y: d.y, phase: d.phase, target: d.target, open: d.open });
  }

  // Ping where the player is looking: march the view ray across the walk physics
  pingAhead() {
    const c = this.app.camera, P = this.app.physics;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
    let last = null;
    for (let t = 0.3; t < 40; t += 0.12) {
      const wx = c.position.x + dir.x * t, wz = c.position.z + dir.z * t, h = c.position.y + dir.y * t;
      const x = wx, y = -wz;
      const cell = P.cell(x, y);
      const wall = cell && cell.c.some(b => !b.off && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && h >= b.z0 && h <= b.z1);
      const sup = P.probe(x, y, h).support;
      if (wall) break;
      if (sup > -Infinity && h <= sup + 0.02) { last = { x, y, e: sup }; break; }
      if (sup > -Infinity) last = { x, y, e: sup };
    }
    if (!last) return;
    const d = { ...last, lv: this.app.currentLevel() };
    this.showPing(d, this.me?.color || '#ffcc33', 'Saya');
    this.t?.send('ping', d);
  }

  showPing(d, color) {
    const obj = buildPing(color);
    obj.position.set(d.x, d.e, -d.y);
    this.app.scene.add(obj);
    this.pings.push({ obj, born: performance.now(), x: d.x, y: d.y, e: d.e, color, lv: d.lv });
    if (this.audio) { // soft chime
      const o = this.audio.createOscillator(), g = this.audio.createGain();
      o.frequency.value = 880; g.gain.value = 0.06; o.connect(g).connect(this.audio.destination);
      g.gain.setTargetAtTime(0, this.audio.currentTime + 0.1, 0.15); o.start(); o.stop(this.audio.currentTime + 0.8);
    }
  }

  // ------------------------------------------------------------ voice (WebRTC, spatial)
  ensureAudio() {
    if (!this.audio) this.audio = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audio.state === 'suspended') this.audio.resume();
  }

  async enableVoice() {
    this.ensureAudio();
    if (!this.local) {
      this.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    }
    this.local.getAudioTracks().forEach(tr => (tr.enabled = !this.muted));
    for (const id of this.peers.keys()) this.ensurePc(id);
    this.t?.send('hello', {});
  }

  setMuted(m) {
    this.muted = m;
    this.local?.getAudioTracks().forEach(tr => (tr.enabled = !m));
  }

  ensurePc(id) {
    const p = this.peers.get(id);
    if (!p) return null;
    if (p.voice) {
      // Late mic: add our track to an existing connection
      if (this.local && !p.voice.sending) { this.local.getTracks().forEach(tr => p.voice.pc.addTrack(tr, this.local)); p.voice.sending = true; }
      return p.voice;
    }
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const v = { pc, polite: this.me.id > id, makingOffer: false, ignoreOffer: false, sending: false };
    p.voice = v;
    if (this.local) { this.local.getTracks().forEach(tr => pc.addTrack(tr, this.local)); v.sending = true; }
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.onicecandidate = ({ candidate }) => candidate && this.t.send('ice', { c: candidate.toJSON() }, id);
    pc.onnegotiationneeded = async () => {
      try { v.makingOffer = true; await pc.setLocalDescription(); this.t.send('sdp', { d: pc.localDescription.toJSON() }, id); }
      finally { v.makingOffer = false; }
    };
    pc.ontrack = ({ streams }) => this.attachRemote(p, streams[0]);
    return v;
  }

  async onSdp({ d }, from) {
    if (!this.peers.has(from)) return;
    this.ensureAudio();
    const v = this.ensurePc(from), pc = v.pc;
    const collision = d.type === 'offer' && (v.makingOffer || pc.signalingState !== 'stable');
    v.ignoreOffer = !v.polite && collision;
    if (v.ignoreOffer) return;
    await pc.setRemoteDescription(d);
    if (d.type === 'offer') { await pc.setLocalDescription(); this.t.send('sdp', { d: pc.localDescription.toJSON() }, from); }
  }

  async onIce({ c }, from) {
    const v = this.peers.get(from)?.voice;
    if (!v) return;
    try { await v.pc.addIceCandidate(c); } catch (e) { if (!v.ignoreOffer) console.warn('[voice] ice', e); }
  }

  attachRemote(p, stream) {
    if (!stream || p.voice.panner) return;
    this.ensureAudio();
    // Chrome only feeds WebRTC audio into WebAudio while a media element plays it (muted)
    const el = document.createElement('audio');
    el.srcObject = stream; el.muted = true; el.autoplay = true; el.playsInline = true;
    document.body.appendChild(el); el.play().catch(() => {});
    const src = this.audio.createMediaStreamSource(stream);
    const pn = new PannerNode(this.audio, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 2, maxDistance: 40, rolloffFactor: 1.3 });
    src.connect(pn).connect(this.audio.destination);
    p.voice.panner = pn; p.voice.el = el;
  }
}
