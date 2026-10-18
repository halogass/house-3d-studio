// Simple stylised person: head, torso, arms and legs that swing while walking,
// with a floating name tag. Origin at the feet; faces local -Z (three.js forward).
import * as THREE from 'three';

function nameTag(text, color) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fs = 48;
  ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
  c.width = Math.ceil(ctx.measureText(text).width) + 48; c.height = fs + 28;
  ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(251,248,242,0.92)';
  ctx.beginPath(); ctx.roundRect(0, 0, c.width, c.height, 18); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(26, c.height / 2, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a3028'; ctx.textBaseline = 'middle'; ctx.fillText(text, 42, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(c.width * 0.0026, c.height * 0.0026, 1);
  sp.renderOrder = 20;
  return sp;
}

export function buildAvatar(name, color) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc89a78, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2f3440, roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 });
  const mesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };

  const torso = mesh(new THREE.CapsuleGeometry(0.19, 0.42, 4, 10), shirt, 0, 1.18, 0);
  torso.scale.set(1, 1, 0.7);
  const head = mesh(new THREE.SphereGeometry(0.13, 16, 12), skin, 0, 1.62, 0);
  const hairCap = mesh(new THREE.SphereGeometry(0.135, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 1.64, 0.01);
  const nose = mesh(new THREE.ConeGeometry(0.025, 0.06, 6), skin, 0, 1.61, -0.135);
  nose.rotation.x = -Math.PI / 2;
  g.add(torso, head, hairCap, nose);

  // Limbs pivot at the shoulder / hip so they can swing
  const limb = (len, r, mat, x, y) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const m = mesh(new THREE.CapsuleGeometry(r, len, 3, 8), mat, 0, -len / 2 - r, 0);
    pivot.add(m); g.add(pivot); return pivot;
  };
  const armL = limb(0.42, 0.055, shirt, -0.25, 1.42), armR = limb(0.42, 0.055, shirt, 0.25, 1.42);
  const legL = limb(0.62, 0.075, pants, -0.1, 0.86), legR = limb(0.62, 0.075, pants, 0.1, 0.86);

  const tag = nameTag(name, color);
  tag.position.set(0, 2.05, 0);
  g.add(tag);

  let phase = 0, pose = 'stand';
  // 'stand' | 'sit' | 'lie'. The session places the group: sit = hips over the seat, lie = on the back
  // (whole figure tipped π/2 about X so the head points to local +Z and the face up).
  g.userData.setPose = (p) => {
    if (p === pose) return;
    pose = p;
    const legs = p === 'sit' ? 1.4 : 0, arms = p === 'sit' ? 0.5 : 0;
    legL.rotation.x = legR.rotation.x = legs;
    armL.rotation.x = armR.rotation.x = arms;
    torso.position.y = 1.18;
    tag.position.set(0, p === 'lie' ? 1.8 : 2.05, p === 'lie' ? 0.3 : 0);
    tag.visible = p !== 'lie';
  };
  g.userData.animate = (dt, speed) => {
    if (pose !== 'stand') return;
    phase += dt * Math.min(speed, 4) * 3.2;
    const swing = Math.min(1, speed / 1.5) * 0.55 * Math.sin(phase);
    legL.rotation.x = swing; legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8; armR.rotation.x = swing * 0.8;
    torso.position.y = 1.18 + Math.abs(Math.sin(phase)) * 0.02 * Math.min(1, speed);
  };
  g.userData.head = head;
  return g;
}

// A pulsing beacon for pings
export function buildPing(color) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false }));
  beam.position.y = 1.5;
  g.add(ring, beam);
  g.userData.ring = ring;
  return g;
}
