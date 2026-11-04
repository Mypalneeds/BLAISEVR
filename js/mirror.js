// BlaiseVR — 🪞 Mirror Mode: a live digital twin of a real object on your table.
// The webcam finds the object (MediaPipe object detector), BlaiseVR copies its real look into a 3D particle twin,
// then mirrors its position, depth and tilt every frame. Your hand appears as a virtual hand, and liquid inside
// containers is simulated: it sloshes, pours out of the mouth when tipped and puddles on the table.
import * as THREE from 'three';
import { ParticleCloud } from './particles.js';
import { buildModel, sampleShape } from './sampler.js';
import { bakeAO } from './ao.js';
import { OneEuro, CONNECTIONS } from './gestures.js';

const W = 8, H = 6;                       // scene units covered by the camera image (4:3)
const TWIN_N = 36000;
const CONTAINERS = new Set(['bottle', 'cup', 'wine glass', 'bowl', 'vase']);
const NAMES = { bottle: 'Bottle', cup: 'Cup', 'wine glass': 'Glass', 'cell phone': 'Phone', book: 'Book', apple: 'Apple', orange: 'Orange', banana: 'Banana', bowl: 'Bowl', vase: 'Vase', remote: 'Remote', mouse: 'Mouse', scissors: 'Scissors', toothbrush: 'Toothbrush', 'teddy bear': 'Teddy bear', clock: 'Clock', laptop: 'Laptop', keyboard: 'Keyboard', donut: 'Donut', 'sports ball': 'Ball' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toX = u => (0.5 - u) * W;          // image x (un-mirrored) → scene x (mirrored, like a mirror)
const toY = v => (0.5 - v) * H;

// ---------- shape templates: unit height (y −0.5…0.5), radius scaled by the object's aspect ----------
function template(kind, aspect) {
  const R = clamp(aspect, 0.15, 2.5) * 0.5;
  const L = (pts, extra = {}) => ({ t: 'lathe', pts: pts.map(([r, y]) => [r * R, y]), ...extra });
  switch (kind) {
    case 'bottle': return { body: [L([[0, -0.5], [0.94, -0.5], [1, -0.46], [1, 0.1], [0.92, 0.2], [0.55, 0.32], [0.37, 0.37], [0.37, 0.43]])],
      cap: [{ t: 'cyl', c: [0, 0.465, 0], r: 0.4 * R, h: 0.07 }], liquid: { r: 0.9 * R, y0: -0.48, y1: 0.3, fill: 0.72 }, mouthY: 0.43, mouthR: 0.35 * R, mat: 'glass' };
    case 'cup': return { body: [L([[0, -0.5], [0.85, -0.5], [0.9, -0.47], [1, 0.5]], { open: true }), L([[0.94, 0.5], [0.82, -0.44], [0, -0.44]])],
      cap: [{ t: 'torus', c: [1.08 * R, 0.02, 0], R: 0.22, r: 0.035, axis: 'z' }], liquid: { r: 0.82 * R, y0: -0.44, y1: 0.42, fill: 0.6 }, mouthY: 0.5, mouthR: 0.95 * R, mat: 'plastic' };
    case 'wine glass': return { body: [L([[0, -0.5], [0.7, -0.5], [0.7, -0.48], [0.08, -0.45], [0.07, -0.05], [0.5, 0.05], [0.95, 0.25], [1, 0.5]])], cap: [],
      liquid: { r: 0.8 * R, y0: 0.0, y1: 0.4, fill: 0.5 }, mouthY: 0.5, mouthR: 0.95 * R, mat: 'glass' };
    case 'vase': return { body: [L([[0, -0.5], [0.6, -0.5], [0.95, -0.2], [0.9, 0.1], [0.45, 0.35], [0.55, 0.5]])], cap: [], liquid: { r: 0.7 * R, y0: -0.48, y1: 0.25, fill: 0.5 }, mouthY: 0.5, mouthR: 0.5 * R, mat: 'plastic' };
    case 'bowl': return { body: [L([[0, -0.5], [0.5, -0.5], [0.85, -0.2], [1, 0.5]]), L([[0.95, 0.5], [0.8, -0.2], [0.45, -0.44], [0, -0.44]])], cap: [],
      liquid: { r: 0.75 * R, y0: -0.44, y1: 0.3, fill: 0.45 }, mouthY: 0.5, mouthR: 0.95 * R, mat: 'plastic' };
    case 'apple': case 'orange': case 'sports ball': return { body: [{ t: 'sphere', r: 0.5, n: kind === 'orange' ? 0.006 : 0.012, nf: kind === 'orange' ? 40 : 5 }], cap: kind === 'apple' ? [{ t: 'cyl', c: [0, 0.52, 0], r: 0.02, h: 0.1, color: '#6b4226' }] : [], mat: 'organic' };
    case 'donut': return { body: [{ t: 'torus', R: 0.3, r: 0.18, axis: 'z' }], cap: [], mat: 'organic' };
    case 'banana': return { body: [{ t: 'tube', pts: [[-0.5 * R * 2, 0.35, 0], [-0.2, -0.1, 0], [0.25, -0.2, 0], [0.5 * R * 2, 0.2, 0]], r: 0.12 }], cap: [], mat: 'organic' };
    case 'mouse': return { body: [{ t: 'ellipsoid', r: [R, 0.5, R * 0.6] }], cap: [], mat: 'plastic' };
    case 'toothbrush': return { body: [{ t: 'capsule', r: Math.min(0.06, R), h: 0.85 }], cap: [], mat: 'plastic' };
    case 'book': return { body: [{ t: 'rbox', s: [2 * R, 1, Math.max(0.12, R * 0.35)], rad: 0.02 }], cap: [], mat: 'matte', slab: true };
    default: return { body: [{ t: 'rbox', s: [2 * R, 1, Math.max(0.06, R * 0.18)], rad: 0.03 }], cap: [], mat: 'plastic', slab: true }; // phone, remote, laptop, clock…
  }
}

// colour each particle from the captured photo (front projection, slightly darker on the far side)
function buildTwinDef(kind, crop, aspect) {
  const T = template(kind, aspect);
  const px = (u, v) => {
    const x = clamp(Math.round((0.06 + u * 0.88) * (crop.w - 1)), 0, crop.w - 1), y = clamp(Math.round(v * (crop.h - 1)), 0, crop.h - 1), i = (y * crop.w + x) * 4;
    return [crop.data[i] / 255, crop.data[i + 1] / 255, crop.data[i + 2] / 255];
  };
  const halfW = Math.max(0.05, clamp(aspect, 0.15, 2.5) * 0.5);
  const toPts = (shapes, n) => {
    const data = [], w = shapes.reduce((a, s) => a + 1, 0);
    shapes.forEach(s => sampleShape(s, Math.round(n / w), (x, y, z, nx, ny, nz) => {
      const [r, g, b] = s.color ? hex(s.color) : px(clamp(0.5 + x / (2 * halfW), 0, 1), clamp(0.5 - y, 0, 1));
      const k = z < 0 ? 0.8 : 1; data.push([x, y, z, r * k, g * k, b * k, nx, ny, nz]);
    }));
    return data;
  };
  // clear (low-saturation, bright) objects such as water bottles render as glass; coloured ones as plastic
  let sat = 0, n = 0;
  for (let y = Math.floor(crop.h * 0.3); y < crop.h * 0.8; y += 3) for (let x = Math.floor(crop.w * 0.3); x < crop.w * 0.7; x += 3) {
    const i = (y * crop.w + x) * 4, r = crop.data[i], g = crop.data[i + 1], b = crop.data[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    sat += mx ? (mx - mn) / mx : 0; n++;
  }
  const clear = sat / Math.max(1, n) < 0.18;
  if (T.mat === 'glass' && !clear) T.mat = 'plastic';
  T.clear = clear;
  const parts = [{ name: NAMES[kind] || 'Object', mat: T.mat, shapes: [{ t: 'pts', data: toPts(T.body, 26000) }] }];
  if (T.cap.length) parts.push({ name: 'Cap', mat: 'plastic', shapes: [{ t: 'pts', data: toPts(T.cap, 4000) }] });
  return { def: { id: 'twin-' + kind + '-' + Date.now(), name: 'Twin: ' + (NAMES[kind] || kind), parts, explode: 0 }, T };
}
const hex = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

// ---------- tilt: separate the object from the colours around it, then take its main axis (PCA) ----------
const TS = 56;
const tiltCv = document.createElement('canvas'); tiltCv.width = tiltCv.height = TS;
const tiltCx = tiltCv.getContext('2d', { willReadFrequently: true });
function measureTilt(video, box) {
  const vw = video.videoWidth, vh = video.videoHeight; if (!vw) return null;
  const cx = (box.x + box.w / 2) * vw, cy = (box.y + box.h / 2) * vh, s = Math.max(box.w * vw, box.h * vh) * 1.15;   // square crop keeps angles true
  tiltCx.drawImage(video, cx - s / 2, cy - s / 2, s, s, 0, 0, TS, TS);
  const d = tiltCx.getImageData(0, 0, TS, TS).data;
  // background palette = pixels on the crop border
  const bg = [];
  for (let k = 0; k < TS; k += 3) for (const [x, y] of [[k, 0], [k, TS - 1], [0, k], [TS - 1, k]]) { const i = (y * TS + x) * 4; bg.push([d[i], d[i + 1], d[i + 2]]); }
  // only look inside the detector's box (in crop coordinates)
  const bx0 = (box.x * vw - (cx - s / 2)) / s * TS, by0 = (box.y * vh - (cy - s / 2)) / s * TS, bx1 = bx0 + box.w * vw / s * TS, by1 = by0 + box.h * vh / s * TS;
  let W = 0, mx = 0, my = 0, sxx = 0, syy = 0, sxy = 0;
  const wts = new Float32Array(TS * TS);
  for (let y = Math.max(0, by0 | 0); y < Math.min(TS, by1); y++) for (let x = Math.max(0, bx0 | 0); x < Math.min(TS, bx1); x++) {
    const i = (y * TS + x) * 4; let dm = 1e9;
    for (const c of bg) { const dd = Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]); if (dd < dm) dm = dd; }
    const w = Math.min(1, Math.max(0, (dm - 40) / 80)); wts[y * TS + x] = w; W += w; mx += w * x; my += w * y;
  }
  if (W < 25) return null;
  mx /= W; my /= W;
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const w = wts[y * TS + x]; if (!w) continue; const dx = x - mx, dy = y - my; sxx += w * dx * dx; syy += w * dy * dy; sxy += w * dx * dy; }
  const a = 0.5 * Math.atan2(2 * sxy, sxx - syy);                         // main axis angle from +x (image, y down)
  const tr = sxx + syy, det = sxx * syy - sxy * sxy, l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det)), l2 = tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const tilt = a > 0 ? a - Math.PI / 2 : a + Math.PI / 2;                  // 0 = upright, + = top leans right (in the camera image)
  return { tilt, elong: l1 / Math.max(1e-6, l2) };
}
// the axis is undirected (a bottle tipped 115° looks like −65°): pick the reading closest to the last one
function unwrap(t, prev) { let best = t; for (const k of [-1, 1]) { const c = t + k * Math.PI; if (Math.abs(c - prev) < Math.abs(best - prev)) best = c; } return best; }

function captureCrop(video, box) {
  const vw = video.videoWidth, vh = video.videoHeight, cw = 96, ch = Math.round(96 * (box.h * vh) / Math.max(1, box.w * vw));
  const c = document.createElement('canvas'); c.width = cw; c.height = clamp(ch, 24, 320);
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.translate(cw, 0); cx.scale(-1, 1);                                     // store mirrored, to match what the user sees
  cx.drawImage(video, box.x * vw, box.y * vh, box.w * vw, box.h * vh, 0, 0, cw, c.height);
  return { w: cw, h: c.height, data: cx.getImageData(0, 0, cw, c.height).data, url: c.toDataURL('image/jpeg', 0.7) };
}

// ---------- liquid shader: visible only below the (always horizontal) surface ----------
const liquidVert = `
uniform float uLevel, uTime, uWave, uSize;
varying float vA; varying vec3 vC;
attribute float aR;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float wave = uWave * (sin(wp.x * 5.0 + uTime * 7.0) + sin(wp.z * 6.0 - uTime * 5.0)) * 0.5;
  float below = uLevel + wave - wp.y;
  vA = below > 0.0 ? 1.0 : 0.0;
  vC = mix(vec3(0.35, 0.7, 1.0), vec3(0.8, 0.95, 1.0), smoothstep(0.08, 0.0, below)) * (0.75 + aR * 0.35);
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vA > 0.5 ? uSize * (300.0 / -mv.z) : 0.0;
}`;
const liquidFrag = `varying float vA; varying vec3 vC; void main(){ if (vA < 0.5 || length(gl_PointCoord - 0.5) > 0.5) discard; gl_FragColor = vec4(vC, 0.55); }`;

export class MirrorMode {
  constructor({ scene, camera, video, overlay, toast, speak, sfx, onStatus }) {
    Object.assign(this, { scene, camera, video, overlay, toast, speak, sfx, onStatus });
    this.on = false; this.state = 'search'; this.target = 'auto'; this.showHand = true;
    this.root = new THREE.Group(); this.root.visible = false; scene.add(this.root);
    // lights for the table & hand
    this.root.add(new THREE.HemisphereLight(0xcfe6ff, 0x30241a, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-3, 6, 5); this.root.add(sun);
    this._buildTable(); this._buildHand(); this._buildLiquid(); this._buildDrops();
    this.twinGroup = new THREE.Group(); this.root.add(this.twinGroup);
    this.space = new THREE.Group(); this.twinGroup.add(this.space);        // template space (unit height)
    this.cloud = new ParticleCloud(TWIN_N); this.cloud.setStyle('real'); this.space.add(this.cloud.group);
    this.space.add(this.liquid);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.root.add(this.shadow);
    this.f = { x: new OneEuro(1.2, 0.05), y: new OneEuro(1.2, 0.05), z: new OneEuro(0.6, 0.02), tilt: new OneEuro(0.9, 0.03) };
    this.pose = { x: 0, y: 0, z: 0, tilt: 0 }; this.target3 = { x: 0, y: 0, z: 0, tilt: 0 };
    this.stable = 0; this.lastSeen = 0; this.holding = false; this.prevTilt = 0; this.tiltVel = 0;
    this.tableY = -1.6;
  }
  // ---------------- scene pieces ----------------
  _buildTable() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#7a5434'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 140; i++) { g.strokeStyle = `rgba(${40 + Math.random() * 40},${25 + Math.random() * 20},10,${0.15 + Math.random() * 0.25})`; g.lineWidth = 1 + Math.random() * 3; g.beginPath(); const y = Math.random() * 512; g.moveTo(0, y); for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 60 + i) * 6); g.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 2); tex.colorSpace = THREE.SRGBColorSpace;
    this.table = new THREE.Mesh(new THREE.BoxGeometry(14, 0.25, 8), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.05 }));
    this.root.add(this.table);
    this.puddleMat = new THREE.PointsMaterial({ color: 0x8fd0ff, size: 0.11, transparent: true, opacity: 0.8, depthWrite: false });
  }
  _buildHand() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8ff0ff, emissive: 0x1aa6c9, emissiveIntensity: 0.55, roughness: 0.35, transparent: true, opacity: 0.92 });
    this.joints = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 14, 10), mat, 42);
    this.bones = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 10), mat, CONNECTIONS.length * 2);
    this.joints.count = 0; this.bones.count = 0; this.root.add(this.joints, this.bones);
  }
  _buildLiquid() {
    const n = 9000, pos = new Float32Array(n * 3), r = new Float32Array(n);
    for (let i = 0; i < n; i++) r[i] = Math.random();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aR', new THREE.BufferAttribute(r, 1));
    this.liqU = { uLevel: { value: 0 }, uTime: { value: 0 }, uWave: { value: 0 }, uSize: { value: 0.05 } };
    this.liquid = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.liqU, vertexShader: liquidVert, fragmentShader: liquidFrag, transparent: true, depthWrite: false }));
    this.liquid.frustumCulled = false; this.liquid.renderOrder = 3; this.liquid.visible = false;
  }
  _buildDrops() {
    this.DN = 1600; this.drops = new Float32Array(this.DN * 3).fill(1e4); this.vel = new Float32Array(this.DN * 3); this.alive = new Uint8Array(this.DN); this.dropI = 0;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.drops, 3));
    this.dropPts = new THREE.Points(g, this.puddleMat); this.dropPts.frustumCulled = false; this.root.add(this.dropPts);
  }
  // ---------------- lifecycle ----------------
  enter() { this.on = true; this.root.visible = true; this.status(this.twin ? 'live' : 'search'); }
  exit() { this.on = false; this.root.visible = false; }
  setTarget(t) { this.target = t; this.recapture(); }
  recapture() { this.twin = null; this.state = 'search'; this.stable = 0; this.cloud.group.visible = false; this.liquid.visible = false; this.shadow.visible = false; this.status('search'); }
  refill() { if (this.twin?.T.liquid) { this.fill = this.twin.T.liquid.fill; this.clearDrops(); this.sfx?.select(); } }
  clearDrops() { this.drops.fill(1e4); this.alive.fill(0); this.dropPts.geometry.getAttribute('position').needsUpdate = true; }
  status(state, extra = '') {
    this.state = state;
    const label = this.twin ? (NAMES[this.twin.kind] || this.twin.kind) : (this.target === 'auto' ? 'an object' : (NAMES[this.target] || this.target));
    const msg = state === 'search' ? `🔍 Looking for ${label}… place it on the table in clear view` : state === 'held' ? `✋ You're holding the ${label.toLowerCase()} — I'm following your hand` : state === 'lost' ? `👀 Lost sight of the ${label.toLowerCase()} — bring it back into view` : `🪞 Mirroring your ${label.toLowerCase()}`;
    this.onStatus?.(msg + (extra ? ' · ' + extra : ''), this);
  }
  // ---------------- capture a new twin ----------------
  _capture(det) {
    const kind = det.label, box = det;
    const vw = this.video.videoWidth || 640, vh = this.video.videoHeight || 480;
    const aspect = (box.w * vw) / Math.max(1, box.h * vh);
    const crop = captureCrop(this.video, box);
    const { def, T } = buildTwinDef(kind, crop, aspect);
    const built = buildModel(def, TWIN_N);
    // splat size from the real surface area of the twin (world units)
    this.objH = box.h * H;
    const R0 = clamp(aspect, 0.15, 2.5) * 0.5, area = (2 * Math.PI * R0 + 2 * Math.PI * R0 * R0 + (T.slab ? 2 * R0 : 0)) * this.objH * this.objH;
    built.solidSize = Math.sqrt(area / TWIN_N) * 4.2;
    built.ao = bakeAO(built.positions, built.normals, built.N); built.aoDone = true;
    this.cloud.setModel(built, false); this.cloud.group.visible = true;
    // template space → normalised space used by the particle cloud
    this.cloud.group.scale.setScalar(1 / built.scale); this.cloud.group.position.copy(built.center);
    this.states = built.parts.map(p => ({ q: new THREE.Quaternion(), pivot: p.pivot, scale: 1, t: new THREE.Vector3(), hl: 0 }));
    this.cloud.uniforms.uForm.value = 1; this.cloud.uniforms.uMorph.value = 1;
    this.twin = { kind, T, h0: box.h, w0: box.w, aspect, crop: crop.url, liquid: !!T.liquid && CONTAINERS.has(kind) };
    // scene scale: object height in scene units, sitting on the table where it was found
    this.tableY = toY(box.y + box.h) - 0.12;
    this.table.position.set(0, this.tableY - 0.125, -0.5);
    this.space.scale.setScalar(this.objH);
    if (this.twin.liquid) this._fillLiquid(T.liquid); else this.liquid.visible = false;
    this.fill = T.liquid?.fill ?? 0; this.clearDrops();
    this.shadow.visible = true; this.shadow.scale.set(aspect * this.objH * 1.2, this.objH * 0.45, 1);
    Object.values(this.f).forEach(f => f.x = null);
    this.sfx?.win(); this.toast?.(`🪞 Twin created: your ${(NAMES[kind] || kind).toLowerCase()}! Move it, lift it, tilt it.`);
    this.speak?.(`Got it. I've made a twin of your ${NAMES[kind] || kind}. Pick it up and move it around.`);
    this.status('live');
  }
  _fillLiquid(L) {
    const p = this.liquid.geometry.getAttribute('position'), a = p.array, n = a.length / 3;
    for (let i = 0; i < n; i++) { const r = L.r * Math.sqrt(Math.random()), t = Math.random() * Math.PI * 2; a[i * 3] = r * Math.cos(t); a[i * 3 + 1] = L.y0 + Math.random() * (L.y1 - L.y0); a[i * 3 + 2] = r * Math.sin(t); }
    p.needsUpdate = true; this.liquid.visible = true; this.liqU.uSize.value = 0.05;
  }
  // ---------------- every vision frame ----------------
  onVision({ hands = [], objects = [] }, now = performance.now()) {
    if (!this.on) return;
    this.hands = hands;
    const want = o => this.target === 'auto' ? true : o.label === this.target;
    let cands = objects.filter(o => want(o) && o.score > 0.35);
    if (this.twin) cands = cands.filter(o => o.label === this.twin.kind);
    // pick the detection closest to where the twin was
    const last = this.lastBox;
    const det = cands.sort((a, b) => last ? Math.hypot(a.x + a.w / 2 - last.cx, a.y + a.h / 2 - last.cy) - Math.hypot(b.x + b.w / 2 - last.cx, b.y + b.h / 2 - last.cy) : b.score - a.score)[0];
    this._drawOverlay(objects, det);
    const hand = hands[0];
    const handPt = hand ? { x: toX(hand.palm.x), y: toY(hand.palm.y) } : null;

    if (!this.twin) {
      if (det && det.score > 0.5) { this.stable++; this.status('search', `found ${NAMES[det.label] || det.label} ${(det.score * 100) | 0}% — hold still`); if (this.stable >= 8) this._capture(det); }
      else this.stable = Math.max(0, this.stable - 1);
      return;
    }
    if (det) {
      this.lastSeen = now; this.lastBox = { cx: det.x + det.w / 2, cy: det.y + det.h / 2 };
      const t = measureTilt(this.video, det); this.dbgTilt = t;
      let tilt = this.target3.tilt;
      if (t && t.elong > 1.35) tilt = unwrap(t.tilt, this.target3.tilt);   // round objects (fruit, balls) have no axis: keep the last value
      // size → depth. Undo the box growth caused by tilting before comparing with the captured size.
      const c = Math.abs(Math.cos(tilt)), s = Math.abs(Math.sin(tilt));
      const len = c > 0.35 ? (det.h - this.twin.w0 * s * 0.75) / c : det.w / Math.max(0.35, s);
      const depth = clamp((len / this.twin.h0 - 1) * 3.2, -3, 3.2);
      this.target3 = { x: toX(det.x + det.w / 2), y: toY(det.y + det.h / 2), z: depth, tilt };
      // holding? (hand overlapping the object box)
      this.holding = !!hand && hand.palm.x > det.x - det.w * 0.4 && hand.palm.x < det.x + det.w * 1.4 && hand.palm.y > det.y - det.h * 0.4 && hand.palm.y < det.y + det.h * 1.3;
      if (this.holding && handPt) this.handOff = { x: this.target3.x - handPt.x, y: this.target3.y - handPt.y, roll: hand.roll, tilt };
      this.status(this.holding ? 'held' : 'live');
    } else if (this.holding && handPt && this.handOff && now - this.lastSeen < 6000) {
      // the hand is covering the object: follow the hand (and its twist)
      this.target3 = { ...this.target3, x: handPt.x + this.handOff.x, y: handPt.y + this.handOff.y, tilt: this.handOff.tilt - (hand.roll - this.handOff.roll) * 1.2 };
      this.status('held');
    } else if (now - this.lastSeen > 1500) { this.holding = false; this.status('lost'); }
  }
  _drawOverlay(objects, det) {
    const c = this.overlay?.getContext('2d'); if (!c) return;
    const Wc = this.overlay.width, Hc = this.overlay.height;
    c.lineWidth = 3; c.font = '600 22px system-ui';
    for (const o of objects) {
      const sel = o === det; c.strokeStyle = sel ? '#ffd23f' : 'rgba(255,255,255,.45)'; c.fillStyle = c.strokeStyle;
      const x = (1 - o.x - o.w) * Wc, y = o.y * Hc; c.strokeRect(x, y, o.w * Wc, o.h * Hc);
      c.fillText(`${NAMES[o.label] || o.label} ${(o.score * 100) | 0}%`, x + 4, y - 6);
    }
  }
  // ---------------- every render frame ----------------
  update(dt, t) {
    if (!this.on) return;
    this.camera.position.set(0, 1.1, 9.5); this.camera.lookAt(0, -0.4, 0);
    this._updateHand();
    if (!this.twin) return;
    const now = performance.now(), T3 = this.target3, P = this.pose;
    P.x = this.f.x.f(T3.x, now); P.y = this.f.y.f(T3.y, now); P.z = this.f.z.f(T3.z, now);
    const newTilt = this.f.tilt.f(T3.tilt, now);
    this.tiltVel = this.tiltVel * 0.85 + (newTilt - P.tilt) / Math.max(dt, 1e-3) * 0.15; P.tilt = newTilt;
    // sitting on the table? keep it from sinking into the wood
    const bottom = P.y - Math.cos(P.tilt) * this.objH / 2;
    const y = bottom < this.tableY ? P.y + (this.tableY - bottom) : P.y;
    this.twinGroup.position.set(P.x, y, P.z);
    this.twinGroup.rotation.set(0, 0, P.tilt);
    this.cloud.applyPartStates(this.states);
    this.cloud.uniforms.uTime.value = t;
    // shadow on the table, fading as the object lifts
    const lift = Math.max(0, y - this.objH / 2 - this.tableY);
    this.shadow.position.set(P.x, this.tableY + 0.01, P.z); this.shadow.material.opacity = 0.35 * Math.exp(-lift * 0.8);
    if (this.twin.liquid) this._updateLiquid(dt, t);
    this._updateDrops(dt);
  }
  _updateLiquid(dt, t) {
    const L = this.twin.T.liquid, s = this.objH, th = this.twinGroup.rotation.z, c = Math.cos(th);
    this.twinGroup.updateMatrixWorld();
    const center = new THREE.Vector3(0, (L.y0 + L.y1) / 2, 0).applyMatrix4(this.space.matrixWorld);
    const span = (L.y1 - L.y0) * s;
    // horizontal surface; volume-preserving approximation for a tilted cylinder
    const level = center.y + (this.fill - 0.5) * span * Math.max(0.25, Math.abs(c)) + (c < 0 ? -(1 - this.fill) * span * 0.5 : 0);
    this.liqU.uLevel.value = level; this.liqU.uTime.value = t;
    this.liqU.uWave.value = Math.min(0.12, this.liqU.uWave.value * 0.96 + Math.abs(this.tiltVel) * 0.01);
    this.liquid.visible = this.fill > 0.01;
    // pouring: the mouth dips below the liquid surface
    const mouth = new THREE.Vector3(0, this.twin.T.mouthY, 0).applyMatrix4(this.space.matrixWorld);
    const capped = this.twin.kind === 'bottle' && !this.capOff;
    if (!capped && this.fill > 0.005 && mouth.y < level + 0.02) {
      const rate = clamp((level - mouth.y) / span + 0.15, 0.05, 1) * 0.35;
      this.fill = Math.max(0, this.fill - rate * dt);
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(this.twinGroup.quaternion);
      const n = Math.ceil(rate * 260 * dt * 60 / 60 * 3);
      for (let k = 0; k < n; k++) this._spawnDrop(mouth, axis);
      if (!this.pouring) { this.pouring = true; this.sfx?.whoosh(false); }
    } else this.pouring = false;
  }
  _spawnDrop(at, axis) {
    const i = this.dropI = (this.dropI + 1) % this.DN, j = i * 3;
    this.drops[j] = at.x + (Math.random() - 0.5) * 0.06; this.drops[j + 1] = at.y; this.drops[j + 2] = at.z + (Math.random() - 0.5) * 0.06;
    this.vel[j] = axis.x * 1.6 + (Math.random() - 0.5) * 0.3; this.vel[j + 1] = axis.y * 1.6; this.vel[j + 2] = (Math.random() - 0.5) * 0.3;
    this.alive[i] = 1;
  }
  _updateDrops(dt) {
    let any = false;
    for (let i = 0; i < this.DN; i++) {
      if (!this.alive[i]) continue; any = true; const j = i * 3;
      if (this.alive[i] === 1) {
        this.vel[j + 1] -= 9.8 * 0.6 * dt;
        this.drops[j] += this.vel[j] * dt; this.drops[j + 1] += this.vel[j + 1] * dt; this.drops[j + 2] += this.vel[j + 2] * dt;
        if (this.drops[j + 1] <= this.tableY + 0.02) { this.drops[j + 1] = this.tableY + 0.015; this.alive[i] = 2; this.vel[j] *= 0.25; this.vel[j + 2] = (Math.random() - 0.5) * 0.4; }
      } else { // spreading puddle
        this.drops[j] += this.vel[j] * dt; this.drops[j + 2] += this.vel[j + 2] * dt; this.vel[j] *= 0.92; this.vel[j + 2] *= 0.92;
      }
    }
    if (any) this.dropPts.geometry.getAttribute('position').needsUpdate = true;
  }
  _updateHand() {
    const hands = this.showHand ? (this.hands || []) : [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), a = new THREE.Vector3(), b = new THREE.Vector3(), sc = new THREE.Vector3();
    let ji = 0, bi = 0;
    for (const h of hands.slice(0, 2)) {
      const depth = clamp((h.size / 0.2 - 1) * 2.2, -2.5, 3) + (this.pose?.z || 0) * 0.5;
      const P = h.lm.map(p => new THREE.Vector3(toX(p.x), toY(p.y), depth - p.z * W * 0.9));
      P.forEach(p => { m.makeTranslation(p.x, p.y, p.z); this.joints.setMatrixAt(ji++, m); });
      for (const [i, k] of CONNECTIONS) {
        a.copy(P[i]); b.copy(P[k]); const len = a.distanceTo(b); if (len < 1e-4) continue;
        q.setFromUnitVectors(up, b.clone().sub(a).normalize()); sc.set(1, len, 1);
        m.compose(a.add(b).multiplyScalar(0.5), q, sc); this.bones.setMatrixAt(bi++, m);
      }
    }
    this.joints.count = ji; this.bones.count = bi;
    this.joints.instanceMatrix.needsUpdate = true; this.bones.instanceMatrix.needsUpdate = true;
  }
}
