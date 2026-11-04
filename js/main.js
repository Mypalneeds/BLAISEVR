// BlaiseVR — main app: scene, state, controls, gestures, quiz, voice, recording.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { MODELS } from './models.js';
import { buildModel, TARGET_RADIUS } from './sampler.js';
import { ParticleCloud } from './particles.js';
import { HandTracker, POSES } from './gestures.js';
import { fromJSON, from3DFile, fromImage, fromText } from './importers.js';

THREE.ColorManagement.enabled = false; // colours in models are used as-is (sRGB look)

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isMobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);

// ---------------------------------------------------------------- settings
const DEFAULTS = { style: 'real', focus: true, sound: true, calib: null, particles: isMobile ? 70000 : 150000, bloom: !isMobile, trails: false, sensitivity: 'standard', colorMode: 'parts', autoRotate: true, animSpeed: 1, gestureRotate: true, voiceRate: 1 };
const settings = { ...DEFAULTS, ...safeJSON(localStorage.getItem('blaisevr:settings')) };
function safeJSON(s) { try { return JSON.parse(s) || {}; } catch { return {}; } }
function saveSettings() { try { localStorage.setItem('blaisevr:settings', JSON.stringify(settings)); } catch {} }

// ---------------------------------------------------------------- three.js setup
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setClearColor(0x000000, 1);
renderer.xr.enabled = true;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 200);
camera.position.set(0, 0.3, 7.5);
const cloud = new ParticleCloud(settings.particles);
const pivot = new THREE.Group(); pivot.add(cloud.group); scene.add(pivot);

// faint starfield for depth
let stars;
{
  const g = new THREE.BufferGeometry(), n = 1500, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const r = 40 + Math.random() * 60, t = Math.random() * 6.28, p = Math.acos(2 * Math.random() - 1); a.set([r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t)], i * 3); }
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x334466, size: 0.15, sizeAttenuation: true }));
  scene.add(stars);
}
// studio backdrop + soft floor shadow for the realistic view
const canvasTex = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return new THREE.CanvasTexture(c); };
const studioBg = canvasTex(4, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a3550'); gr.addColorStop(0.5, '#121a2c'); gr.addColorStop(1, '#04060b'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const floorShadow = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.7,
  map: canvasTex(256, 256, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }) }));
floorShadow.rotation.x = -Math.PI / 2; floorShadow.position.y = -2.6; scene.add(floorShadow);
const floorRing = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.24, 96), new THREE.MeshBasicMaterial({ color: 0x3b5b8f, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
floorRing.rotation.x = -Math.PI / 2; floorRing.position.y = -2.62; scene.add(floorRing);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.5, 0.22);
const trails = new AfterimagePass(0.86);
composer.addPass(bloom); composer.addPass(trails);
function applyFx() { bloom.enabled = settings.bloom; trails.enabled = settings.trails; }
const STYLES = ['real', 'glow', 'xray'], STYLE_NAMES = { real: 'Realistic', glow: 'Glow', xray: 'X-ray' };
function applyStyle() {
  const st = settings.style;
  cloud.setStyle(st);
  scene.background = st === 'real' ? studioBg : null;
  stars.visible = st !== 'real'; floorShadow.visible = floorRing.visible = st === 'real';
  bloom.strength = st === 'real' ? 0.22 : st === 'xray' ? 0.9 : 0.6; bloom.threshold = st === 'real' ? 0.72 : st === 'xray' ? 0.1 : 0.22;
  btnState('style', st !== 'glow'); const b = $('[data-act="style"] span'); if (b) b.textContent = 'View: ' + STYLE_NAMES[st];
}
function cycleStyle() { settings.style = STYLES[(STYLES.indexOf(settings.style) + 1) % STYLES.length]; saveSettings(); applyStyle(); syncSettingsUI(); toast('View: ' + STYLE_NAMES[settings.style]); }
applyFx();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- state
const models = [...MODELS];
loadSavedCustom();
const S = {
  idx: 0, built: null, summoned: false, form: 0, formT: 0, explode: 0, explodeT: 0,
  sel: -1, hover: -1, isolate: false, pulled: new Set(), pullAmt: [],
  rotY: 0.5, rotX: 0.15, velY: 0, rotXT: 0.15, zoom: 7.5, zoomT: 7.5,
  cutOn: false, cutAxis: 0, cutW: 0, cutWT: 0.0,
  labels: false, anim: true, animTime: 0, time: 0, focus: new THREE.Vector3(),
  demo: false, quiz: null, recording: null, lastInput: performance.now(),
};
const cache = new Map();
// ambient occlusion is baked in a background worker so models appear instantly
let aoWorker = null, aoJob = 0; const aoPending = new Map();
try { aoWorker = new Worker(new URL('./aoWorker.js', import.meta.url), { type: 'module' }); aoWorker.onmessage = e => { const b = aoPending.get(e.data.id); aoPending.delete(e.data.id); if (!b) return; b.ao = e.data.ao; b.aoDone = true; if (cloud.model === b) cloud.setAO(b.ao); }; } catch { aoWorker = null; }
function requestAO(b) {
  if (b.aoDone || b.aoBusy) return; b.aoBusy = true;
  if (aoWorker) { const id = ++aoJob; aoPending.set(id, b); aoWorker.postMessage({ id, pos: b.positions.slice(), nor: b.normals.slice(), N: b.N }); }
  else import('./ao.js').then(({ bakeAO }) => setTimeout(() => { b.ao = bakeAO(b.positions, b.normals, b.N); b.aoDone = true; if (cloud.model === b) cloud.setAO(b.ao); }, 50));
}
function getBuilt(def) {
  const key = def.id + ':' + settings.particles;
  if (cache.has(key)) return cache.get(key);
  const b = buildModel(def, settings.particles);
  cache.set(key, b); if (cache.size > 5) cache.delete(cache.keys().next().value);
  return b;
}

// ---------------------------------------------------------------- model switching
function loadModel(i, { morph = true, announce = true } = {}) {
  S.idx = (i + models.length) % models.length;
  const def = models[S.idx];
  let built;
  try { built = getBuilt(def); } catch (e) { toast('Could not build model: ' + e.message, 'err'); console.error(e); return; }
  S.built = built; cloud.setModel(built, morph && S.summoned); requestAO(built);
  S.userOff = built.parts.map(() => new THREE.Vector3()); S.offGoal = built.parts.map(() => new THREE.Vector3()); S.grab = null; if (game?.on) endGame(false);
  if (settings.colorMode !== 'parts') cloud.setColorMode(settings.colorMode);
  S.sel = -1; S.hover = -1; S.isolate = false; S.pulled.clear(); S.pullAmt = built.parts.map(() => 0);
  // textbook-style models open already sliced so you can see inside
  if (def.autoCut) { S.cutAxis = def.autoCut[0]; S.cutW = S.cutWT = def.autoCut[1]; S.cutOn = true; S.autoCut = true; $('#cutBar').hidden = false; $('#cutSlider').value = S.cutWT; btnState('cut', true); }
  else if (S.autoCut) { S.cutOn = false; S.autoCut = false; $('#cutBar').hidden = true; btnState('cut', false); }
  buildLabels(); updateInfo(); updatePicker();
  $('#modelName').textContent = def.name;
  $('#modelMeta').textContent = `${def.category || ''} · ${built.parts.length} parts · ${(built.N / 1000).toFixed(0)}k particles`;
  if (models[S.idx].id && !models[S.idx].id.startsWith('file-') && !models[S.idx].id.startsWith('img-')) history.replaceState(null, '', '#m=' + encodeURIComponent(def.id));
  if (announce) toast(`${def.emoji || '✨'} ${def.name}`);
  if (S.quiz) endQuiz(true);
  if (tour?.on && !tour.switching) toggleTour(false);
}
const next = () => loadModel(S.idx + 1);
const prev = () => loadModel(S.idx - 1);

function summon() { S.summoned = true; S.formT = 1; setScene(); }
function dissolve() { S.summoned = false; S.formT = 0; S.explodeT = 0; select(-1); setScene(); }
function toggleSummon() { S.summoned ? dissolve() : summon(); }
function setExplode(v) { if (!S.summoned) summon(); S.explodeT = clamp(v, 0, 1); $('#explode').value = S.explodeT; setScene(); }
function setScene() {
  const st = !S.summoned ? 'dissolved' : S.explodeT > 0.05 ? `exploded ${(S.explodeT * 100) | 0}%` : 'formed';
  $('#sceneState').textContent = st;
}

// ---------------------------------------------------------------- selection
function select(i, { speak = false } = {}) {
  S.sel = i;
  if (i < 0) S.isolate = false;
  updateInfo();
  if (i >= 0) {
    if (S.quiz?.mode === 'find') checkFind(i);
    if (speak) speakPart(i);
  }
}
function togglePull(i) {
  if (i < 0) return;
  S.pulled.has(i) ? S.pulled.delete(i) : S.pulled.add(i);
  updateInfo();
}
function updateInfo() {
  const p = S.built?.parts[S.sel], el = $('#info');
  if (!p) { el.hidden = true; return; }
  el.hidden = false;
  $('#infoDot').style.background = p.color;
  $('#infoName').textContent = p.name;
  $('#infoModel').textContent = models[S.idx].name;
  $('#infoDesc').textContent = p.desc || 'No description yet for this part.';
  $('#infoFact').textContent = p.fact || '';
  $('#infoFact').hidden = !p.fact;
  $('#btnPull').textContent = S.pulled.has(S.sel) ? '↩ Put back' : '↗ Pull out';
  $('#btnIsolate').textContent = S.isolate ? '◎ Show all' : '◎ Isolate';
}

// ---------------------------------------------------------------- per-frame part transforms
const tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), camLocal = new THREE.Vector3();
let states = [];
function computeStates() {
  const parts = S.built.parts, t = S.animTime;
  const ex = easeInOut(S.explode);
  camLocal.copy(camera.position).applyMatrix4(new THREE.Matrix4().copy(cloud.points.matrixWorld).invert()).normalize();
  if (states.length !== parts.length) states = parts.map(() => ({ q: new THREE.Quaternion(), pivot: new THREE.Vector3(), scale: 1, t: new THREE.Vector3(), hl: 0 }));
  parts.forEach((p, i) => {
    const s = states[i]; s.q.identity(); s.scale = 1; s.t.set(0, 0, 0); s.pivot.copy(p.pivot);
    for (const a of p.anims) {
      const ph = Math.PI * 2 * a.freq * t + a.phase;
      if (a.type === 'spin') s.q.premultiply(tmpQ.setFromAxisAngle(a.axis, a.speed * t));
      else if (a.type === 'swing') s.q.premultiply(tmpQ.setFromAxisAngle(a.axis, a.amp * Math.sin(ph)));
      else if (a.type === 'bob') s.t.addScaledVector(a.axis, a.amp * Math.sin(ph));
      else if (a.type === 'pulse') s.scale *= 1 + a.amp * Math.pow(Math.max(0, Math.sin(ph)), 3) * 2 - a.amp * 0.5;
    }
    s.t.addScaledVector(p.explode, ex);
    S.pullAmt[i] += ((S.pulled.has(i) ? 1 : 0) - S.pullAmt[i]) * 0.08;
    if (S.pullAmt[i] > 0.001) {
      tmpV.copy(p.explode).normalize().multiplyScalar(0.6).addScaledVector(camLocal, 1.6);
      s.t.addScaledVector(tmpV, easeInOut(S.pullAmt[i]));
    }
    if (S.grab?.part !== i) S.userOff[i].lerp(S.offGoal[i], 0.12);
    s.t.add(S.userOff[i]);
    s.hl = S.sel === i || S.grab?.part === i ? 2 : S.hover === i ? 1 : 0;
  });
  return states;
}
const easeInOut = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

// ---------------------------------------------------------------- picking & labels
const proj = new THREE.Vector3();
function pickAt(cx, cy) {
  if (!S.built || S.form < 0.6) return -1;
  const W = innerWidth, H = innerHeight, mw = cloud.points.matrixWorld;
  const cutN = cutNormal();
  let best = -1, bestZ = 9, near = -1, nearD = 48 * 48;
  for (const i of cloud.pickIdx) {
    const pi = cloud.transformPoint(i, states, proj);
    if (S.isolate && pi !== S.sel) continue;
    if (S.cutOn && proj.dot(cutN) > S.cutW) continue;
    proj.applyMatrix4(mw).project(camera);
    if (proj.z > 1) continue;
    const dx = (proj.x * .5 + .5) * W - cx, dy = (-proj.y * .5 + .5) * H - cy, d2 = dx * dx + dy * dy;
    if (d2 < 20 * 20 && proj.z < bestZ) { bestZ = proj.z; best = pi; }
    if (d2 < nearD) { nearD = d2; near = pi; }
  }
  return best >= 0 ? best : near;
}
let labelEls = [];
function buildLabels() {
  const box = $('#labels'); box.innerHTML = '';
  labelEls = S.built.parts.map((p, i) => {
    const d = document.createElement('div'); d.className = 'label'; d.innerHTML = `<i style="background:${p.color}"></i>${escapeHTML(p.name)}`;
    d.onclick = () => select(i, { speak: false }); box.appendChild(d); return d;
  });
}
function updateLabels() {
  const show = S.form > 0.8 && (S.labels || S.explode > 0.35);
  const mw = cloud.points.matrixWorld, W = innerWidth, H = innerHeight;
  S.built.parts.forEach((p, i) => {
    const el = labelEls[i]; if (!el) return;
    const vis = (show || S.sel === i) && !(S.isolate && S.sel !== i);
    if (!vis) { el.style.opacity = 0; el.style.pointerEvents = 'none'; return; }
    const s = states[i];
    proj.copy(p.centroid).sub(s.pivot).multiplyScalar(s.scale).applyQuaternion(s.q).add(s.pivot).add(s.t).applyMatrix4(mw).project(camera);
    if (proj.z > 1) { el.style.opacity = 0; return; }
    el.style.opacity = S.sel === i ? 1 : 0.85; el.style.pointerEvents = 'auto';
    el.classList.toggle('sel', S.sel === i);
    el.style.transform = `translate(${(proj.x * .5 + .5) * W}px, ${(-proj.y * .5 + .5) * H}px) translate(-50%, -140%)`;
  });
}
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- cut-away
const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0]];
const AXIS_NAMES = ['side (X)', 'top (Y)', 'front (Z)', 'other side'];
const cutNormal = () => new THREE.Vector3(...AXES[S.cutAxis]);
function toggleCut(on = !S.cutOn) { S.cutOn = on; S.autoCut = false; if (on && !S.summoned) summon(); $('#cutBar').hidden = !on; btnState('cut', on); toast(on ? `Cut-away on · slicing ${AXIS_NAMES[S.cutAxis]} · move the slider or your mouse/hand` : 'Cut-away off'); }
function cycleCutAxis(d) { S.cutAxis = (S.cutAxis + d + AXES.length) % AXES.length; toast(`Slice from ${AXIS_NAMES[S.cutAxis]}`); }

// ---------------------------------------------------------------- render loop
let last = performance.now(), frame = 0;
renderer.setAnimationLoop(loop);
function loop() {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; frame++;
  S.time += dt; if (S.anim) S.animTime += dt * settings.animSpeed;
  S.form += (S.formT - S.form) * Math.min(1, dt * (S.formT > S.form ? 1.6 : 2.4));
  S.explode += (S.explodeT - S.explode) * Math.min(1, dt * 5);
  S.zoom += (S.zoomT - S.zoom) * Math.min(1, dt * 6);
  S.cutW += (S.cutWT - S.cutW) * Math.min(1, dt * 10);
  const U = cloud.uniforms;
  U.uTime.value = S.time; U.uForm.value = S.form;
  U.uMorph.value = Math.min(1, U.uMorph.value + dt * 0.75);
  U.uHasSel.value = S.sel >= 0 ? 1 : 0; U.uDim.value = S.isolate ? 0 : 0.28;
  U.uCutOn.value = S.cutOn ? 1 : 0; const cn = cutNormal(); U.uCut.value.set(cn.x, cn.y, cn.z, S.cutW);

  if (!dragging) { S.rotY += (S.velY + (settings.autoRotate && !S.cutOn && S.sel < 0 ? 0.18 : 0)) * dt; S.velY *= Math.pow(0.12, dt); }
  S.rotX += (S.rotXT - S.rotX) * Math.min(1, dt * 4);
  pivot.rotation.set(S.rotX, S.rotY, 0);
  const focusing = settings.focus && S.sel >= 0 && S.form > 0.8;
  if (!renderer.xr.isPresenting) { camera.position.set(0, 0.3, S.zoom * (1 + 0.28 * S.explode) * Math.max(1, 0.8 / camera.aspect) * (focusing ? 0.78 : 1)); camera.lookAt(0, 0, 0); }
  pivot.updateMatrixWorld();

  if (S.built) {
    cloud.applyPartStates(computeStates());
    // camera focus: slide the model so the selected part sits at the centre of rotation
    const ft = proj.set(0, 0, 0);
    if (focusing) { const p = S.built.parts[S.sel], s = states[S.sel]; ft.copy(p.centroid).sub(s.pivot).multiplyScalar(s.scale).applyQuaternion(s.q).add(s.pivot).add(s.t).multiplyScalar(-0.85); }
    S.focus.lerp(ft, Math.min(1, dt * 3)); cloud.group.position.copy(S.focus);
    if (frame % 3 === 0 && pointer.inside && !dragging && !handCursor.active) S.hover = pickAt(pointer.x, pointer.y);
    updateLabels();
  }
  if (S.demo) demoStep(dt);
  if (renderer.xr.isPresenting) renderer.render(scene, camera); else composer.render();
}

// ---------------------------------------------------------------- mouse / touch
const pointer = { x: 0, y: 0, inside: false };
let dragging = false, downAt = null, lastP = null, touches = new Map(), pinchStart = null;
const cv = renderer.domElement;
let longPress = null;
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; lastP = { ...downAt }; dragging = false; activity(); sfx.unlock();
  clearTimeout(longPress);
  if (touches.size === 2) { const [a, b] = [...touches.values()]; pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), z: S.zoomT }; endGrab(); return; }
  if (!S.summoned || S.form < 0.8) return;
  const p = pickAt(e.clientX, e.clientY);
  if (p < 0) return;
  // Shift / Rebuild game = grab at once; otherwise press and hold ~0.35 s on a part to pick it up
  if (e.shiftKey || game.on || e.button === 2) startGrab(p, e.clientX, e.clientY, 'mouse');
  else longPress = setTimeout(() => { if (downAt && !dragging) { startGrab(p, downAt.x, downAt.y, 'mouse'); if (navigator.vibrate) navigator.vibrate(15); } }, 350);
});
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true;
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2 && pinchStart) { const [a, b] = [...touches.values()]; S.zoomT = clamp(pinchStart.z * pinchStart.d / Math.hypot(a.x - b.x, a.y - b.y), 3, 16); dragging = true; return; }
  if (S.cutOn && !S.autoCut && !downAt) S.cutWT = (e.clientX / innerWidth * 2 - 1) * -TARGET_RADIUS * 1.05;
  if (!downAt) return;
  if (S.grab?.mode === 'mouse') { moveGrab(e.clientX, e.clientY, 1); dragging = true; return; }
  const dx = e.clientX - lastP.x, dy = e.clientY - lastP.y;
  if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) { dragging = true; clearTimeout(longPress); }
  if (dragging) { S.rotY += dx * 0.008; S.velY = dx * 0.5; S.rotXT = clamp(S.rotXT + dy * 0.006, -1.3, 1.3); S.rotX = S.rotXT; }
  lastP = { x: e.clientX, y: e.clientY };
});
const endPtr = e => {
  touches.delete(e.pointerId); if (touches.size < 2) pinchStart = null; clearTimeout(longPress);
  if (S.grab?.mode === 'mouse') { endGrab(); downAt = null; setTimeout(() => dragging = false, 0); return; }
  if (downAt && !dragging && touches.size === 0) {
    if (!S.summoned) summon();
    else { const p = pickAt(e.clientX, e.clientY); if (p >= 0) { select(p === S.sel ? -1 : p, { speak: false }); sfx.select(); } else select(-1); }
  }
  if (touches.size === 0) { downAt = null; setTimeout(() => dragging = false, 0); }
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('pointerleave', () => { pointer.inside = false; S.hover = -1; });
cv.addEventListener('dblclick', e => { const p = pickAt(e.clientX, e.clientY); if (p >= 0) togglePull(p); });
cv.addEventListener('wheel', e => {
  e.preventDefault(); activity();
  if (e.ctrlKey || e.metaKey) S.zoomT = clamp(S.zoomT * (1 + e.deltaY * 0.01), 3, 16);
  else if (e.shiftKey) S.zoomT = clamp(S.zoomT * (1 + e.deltaY * 0.0015), 3, 16);
  else if (S.grab) { S.grab.depth = (S.grab.depth || 0) - e.deltaY * 0.003; moveGrab(S.grab.lastX, S.grab.lastY, 1); }
  else setExplode(S.explodeT - e.deltaY * 0.0012);
}, { passive: false });

// ---------------------------------------------------------------- grabbing & moving parts (mouse, touch and hand)
const camRight = new THREE.Vector3(), camUp = new THREE.Vector3(), camFwd = new THREE.Vector3(), invQ = new THREE.Quaternion(), dWorld = new THREE.Vector3();
const SNAP_R = 0.42;
function startGrab(part, x, y, mode, size = 1) {
  if (part < 0 || !S.built) return;
  S.pulled.delete(part);
  S.grab = { part, mode, sx: x, sy: y, lastX: x, lastY: y, size0: size, off0: S.userOff[part].clone(), t0: performance.now(), moved: 0, depth: 0 };
  select(part); sfx.grab();
  flash('✋ Holding ' + S.built.parts[part].name);
}
function moveGrab(x, y, size) {
  const g = S.grab; if (!g) return;
  g.lastX = x; g.lastY = y;
  const wpp = 2 * camera.position.length() * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / innerHeight;
  camera.matrixWorld.extractBasis(camRight, camUp, camFwd);
  dWorld.set(0, 0, 0).addScaledVector(camRight, (x - g.sx) * wpp).addScaledVector(camUp, -(y - g.sy) * wpp);
  const dz = (g.mode === 'hand' ? (size / g.size0 - 1) * 3.2 : 0) + (g.depth || 0);
  dWorld.addScaledVector(camFwd, dz);                                     // camFwd points toward the viewer (camera +Z)
  cloud.points.getWorldQuaternion(invQ).invert();
  dWorld.applyQuaternion(invQ);
  const off = S.userOff[g.part].copy(g.off0).add(dWorld);
  // magnetic pull when close to home
  const home = homeDistance(g.part);
  if (home < SNAP_R * 1.6) off.multiplyScalar(0.94);
  g.moved = Math.max(g.moved, Math.hypot(x - g.sx, y - g.sy));
  $('#cursor').classList.toggle('near', home < SNAP_R);
}
// distance of a part from where it belongs (taking the current explode into account)
function homeDistance(i) { return S.userOff[i].length(); }
function endGrab() {
  const g = S.grab; if (!g) return;
  S.grab = null; $('#cursor').classList.remove('near');
  const i = g.part, quick = performance.now() - g.t0 < 300 && g.moved < 14;
  S.offGoal[i].copy(S.userOff[i]);
  if (quick && g.mode === 'hand' && !game.on) { S.offGoal[i].copy(g.off0); S.userOff[i].copy(g.off0); togglePull(i); sfx.select(); return; }
  if (homeDistance(i) < SNAP_R) { S.offGoal[i].set(0, 0, 0); sfx.snap(); if (game.on) placed(i); else flash('🧲 Snapped back into place'); }
  else sfx.drop();
}
function reassemble(announce = true) {
  if (!S.built) return;
  S.grab = null; S.pulled.clear(); S.offGoal.forEach(v => v.set(0, 0, 0)); S.isolate = false;
  if (!S.summoned) summon(); setExplode(0); select(-1); sfx.whoosh(false);
  if (game.on) endGame(false);
  if (announce) flash('♻️ Reassembled');
}
const anyMoved = () => S.userOff?.some(v => v.lengthSq() > 0.0004) || S.offGoal?.some(v => v.lengthSq() > 0.0004);

// ---------------------------------------------------------------- 🧩 Rebuild game: put the model back together
const game = { on: false, placed: new Set(), todo: [], start: 0, timer: null, hints: 0 };
function startRebuild() {
  if (!S.built) return;
  if (S.quiz) endQuiz(true); if (tour.on) toggleTour(false); if (S.demo) toggleDemo(false);
  if (!S.summoned) summon();
  reassemble(false); if (S.cutOn && !S.autoCut) toggleCut(false);
  const parts = S.built.parts, big = parts.reduce((b, p, i) => p.count > parts[b].count ? i : b, 0);
  const order = parts.map((_, i) => i).filter(i => i !== big).sort(() => Math.random() - 0.5).slice(0, 12);
  game.todo = order; game.placed = new Set(parts.map((_, i) => i).filter(i => !order.includes(i)));
  game.total = parts.length; game.hints = 0; game.on = true; game.start = performance.now();
  S.zoomT = Math.max(S.zoomT, 9.5); S.rotXT = 0.35;
  setTimeout(() => {
    order.forEach((i, k) => {
      const p = parts[i], dir = p.explode.lengthSq() > 0.01 ? p.explode.clone().normalize() : new THREE.Vector3(Math.cos(k * 2.4), 0.25, Math.sin(k * 2.4));
      dir.x += (Math.random() - 0.5) * 0.6; dir.y += (Math.random() - 0.3) * 0.5; dir.z += (Math.random() - 0.5) * 0.6; dir.normalize();
      S.offGoal[i].copy(dir.multiplyScalar(1.5 + Math.random() * 1.1));
    });
    sfx.whoosh(true);
  }, 400);
  $('#gameBar').hidden = false; btnState('rebuild', true); updateGame();
  clearInterval(game.timer); game.timer = setInterval(updateGame, 500);
  speak(`Rebuild the ${models[S.idx].name}. Pinch and drag each part back to where it belongs.`);
  toast('🧩 Pinch 🤏 (or drag with the mouse) each floating part back into place');
}
function placed(i) {
  game.placed.add(i); select(-1);
  flash(`✅ ${S.built.parts[i].name} placed`);
  updateGame();
  if (game.todo.every(k => game.placed.has(k))) {
    const secs = (performance.now() - game.start) / 1000 + game.hints * 10, key = 'blaisevr:rebuild:' + models[S.idx].id;
    const best = Math.min(secs, +(localStorage.getItem(key) || Infinity)); try { localStorage.setItem(key, best); } catch {}
    endGame(false); sfx.win();
    flash(`🏆 Rebuilt in ${fmtTime(secs)}!`);
    $('#gameDone').textContent = `🏆 Rebuilt in ${fmtTime(secs)} · best ${fmtTime(best)}`; $('#gameDone').hidden = false; setTimeout(() => $('#gameDone').hidden = true, 6000);
    speak(`Well done! You rebuilt the ${models[S.idx].name} in ${Math.round(secs)} seconds.`);
    setExplode(0.0);
  }
}
function gameHint() {
  if (!game.on) return;
  const i = game.todo.find(k => !game.placed.has(k)); if (i == null) return;
  game.hints++; S.offGoal[i].set(0, 0, 0); sfx.snap(); placed(i);
}
function endGame(reset = true) {
  clearInterval(game.timer); game.on = false; $('#gameBar').hidden = true; btnState('rebuild', false);
  if (reset) reassemble(false);
}
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function updateGame() {
  if (!game.on) return;
  const done = game.todo.filter(k => game.placed.has(k)).length, best = localStorage.getItem('blaisevr:rebuild:' + models[S.idx].id);
  $('#gameText').textContent = `🧩 Rebuild: ${done} / ${game.todo.length} parts placed`;
  $('#gameTime').textContent = `${fmtTime((performance.now() - game.start) / 1000 + game.hints * 10)}${best ? ' · best ' + fmtTime(+best) : ''}`;
}
$('#gameHint').onclick = gameHint; $('#gameStop').onclick = () => endGame(true);

// ---------------------------------------------------------------- sound effects (synthesised with Web Audio — no files, no cost)
const sfx = (() => {
  let ctx = null;
  const ac = () => { if (!ctx) try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} if (ctx?.state === 'suspended') ctx.resume(); return ctx; };
  function tone(f, d = 0.08, type = 'sine', vol = 0.07, slide = 0, delay = 0) {
    if (!settings.sound) return; const c = ac(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f * slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.03);
  }
  function noise(d, vol, f0, f1) {
    if (!settings.sound) return; const c = ac(); if (!c) return;
    const b = c.createBuffer(1, c.sampleRate * d, c.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
    src.buffer = b; bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + d * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(bp).connect(g).connect(c.destination); src.start(t);
  }
  let lastTick = 0;
  return {
    unlock: () => { if (settings.sound) ac(); },
    tick: () => { const n = performance.now(); if (n - lastTick > 70) { lastTick = n; tone(1500, 0.025, 'sine', 0.025); } },
    select: () => { tone(660, 0.07, 'triangle', 0.06); tone(990, 0.09, 'triangle', 0.05, 0, 0.06); },
    grab: () => tone(260, 0.12, 'square', 0.035, 1.8),
    drop: () => tone(520, 0.14, 'sine', 0.05, 0.55),
    snap: () => { tone(900, 0.04, 'square', 0.05); tone(1350, 0.16, 'sine', 0.07, 0, 0.04); },
    sign: () => tone(1046, 0.05, 'sine', 0.035),
    whoosh: up => noise(0.45, 0.05, up ? 300 : 1600, up ? 1600 : 300),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.08, 0, i * 0.12)),
    err: () => tone(200, 0.18, 'sawtooth', 0.035, 0.7),
  };
})();

// ---------------------------------------------------------------- keyboard
const KEYS = {
  ' ': toggleSummon, f: () => reassemble(), j: () => game.on ? endGame(true) : startRebuild(), o: () => setExplode(S.explodeT > 0.5 ? 0 : 1), e: () => setExplode(S.explodeT > 0.5 ? 0 : 1),
  v: next, arrowright: next, arrowleft: prev, arrowup: () => setExplode(S.explodeT + 0.1), arrowdown: () => setExplode(S.explodeT - 0.1),
  b: () => togglePicker(), g: () => toggleSetting('gestureRotate', 'Hand rotate'), x: () => toggleCut(), ',': () => cycleCutAxis(-1), '.': () => cycleCutAxis(1),
  r: () => { toggleSetting('autoRotate', 'Auto-rotate'); }, l: () => { S.labels = !S.labels; btnState('labels', S.labels); }, t: () => { toggleSetting('trails', 'Trails'); applyFx(); },
  s: () => cycleStyle(), y: () => toggleTour(), '/': () => openSearch(), a: () => { S.anim = !S.anim; cloud.setFlowOn(S.anim); btnState('anim', S.anim); toast(S.anim ? 'Animation & flows on' : 'Animation paused'); },
  q: () => S.quiz ? endQuiz(true) : startQuiz(), m: () => toggleVoice(), k: () => toggleRecord(), i: () => speakPart(S.sel), c: () => toggleCamera(), d: () => toggleDemo(),
  h: () => toggleDlg('#help'), '?': () => toggleDlg('#help'), n: () => openText(), u: () => $('#file').click(), p: () => screenshot(), z: () => toggleIsolate(),
  '+': () => S.zoomT = clamp(S.zoomT * 0.85, 3, 16), '=': () => S.zoomT = clamp(S.zoomT * 0.85, 3, 16), '-': () => S.zoomT = clamp(S.zoomT * 1.15, 3, 16), '0': () => { S.zoomT = 7.5; S.rotXT = 0.15; },
  escape: () => { if (!closeDialogs()) { if (S.quiz) endQuiz(true); else select(-1); } },
};
addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (/^[1-9]$/.test(k) && models[+k - 1]) { loadModel(+k - 1); return; }
  const fn = KEYS[k]; if (!fn) return;
  e.preventDefault(); activity(); fn();
});
function toggleSetting(key, label) { settings[key] = !settings[key]; saveSettings(); syncSettingsUI(); toast(`${label} ${settings[key] ? 'on' : 'off'}`); }
function toggleIsolate() { if (S.sel < 0) { toast('Select a part first'); return; } S.isolate = !S.isolate; updateInfo(); }

// ---------------------------------------------------------------- hand gestures
const tracker = new HandTracker($('#camVideo'), $('#camOverlay'));
tracker.sensitivity = settings.sensitivity; tracker.calib = settings.calib;
const handCursor = { active: false, x: 0, y: 0 };
const G = { slots: {}, dwellPart: -1, dwellStart: 0, lastNav: 0, two: null, lastSign: 0, lastPose: null };
const ACTION_NAMES = { fist: 'form · move to rotate', open: 'explode', partial: 'explode', point: 'point to select', pinch: 'grab & move', ok: 'isolate part', victory: 'next model', three: 'cut-away', rock: 'change view', shaka: 'guided tour', thumb: 'explain', thumbdown: 'reassemble' };
tracker.onHint = (k, msg) => toast(msg);
const toScreen = p => ({ x: clamp(((1 - p.x) - 0.15) / 0.7, 0, 1) * innerWidth, y: clamp((p.y - 0.12) / 0.7, 0, 1) * innerHeight });
// fires once when a hand settles into a new sign
function onSign(h, pose) {
  const SIGNS = ['victory', 'thumb', 'thumbdown', 'ok', 'rock', 'shaka', 'three']; if (!SIGNS.includes(pose)) return;
  const now = performance.now(); if (now - G.lastSign < 350) return; G.lastSign = now;
  switch (pose) {
    case 'victory': if (now - G.lastNav > 1300) { G.lastNav = now; next(); sfx.sign(); } break;
    case 'thumb': speakPart(S.sel); sfx.sign(); break;
    case 'thumbdown': reassemble(); break;
    case 'ok': { const p = S.hover >= 0 ? S.hover : S.sel; if (p >= 0) { select(p); S.isolate = !S.isolate; updateInfo(); flash(S.isolate ? '👌 Isolated ' + S.built.parts[p].name : '👌 Showing all'); } else { S.labels = !S.labels; btnState('labels', S.labels); flash('👌 Labels ' + (S.labels ? 'on' : 'off')); } sfx.sign(); break; }
    case 'rock': cycleStyle(); flash('🤘 View: ' + STYLE_NAMES[settings.style]); sfx.sign(); break;
    case 'shaka': toggleTour(); flash('🤙 Tour ' + (tour.on ? 'started' : 'stopped')); sfx.sign(); break;
    case 'three': toggleCut(); flash('3️⃣ Cut-away ' + (S.cutOn ? 'on' : 'off')); sfx.sign(); break;
  }
}
function singleHand(h, cur) {
  const sl = G.slots[h.side] || (G.slots[h.side] = { pose: null, count: 0, prevPalm: null });
  if (h.pose === sl.pose) sl.count++; else { if (sl.pose === 'pinch' && S.grab?.mode === 'hand') endGrab(); sl.pose = h.pose; sl.count = 1; }
  const holding = sl.count >= 2, onset = sl.count === 2;
  $('#gestureName').textContent = `${POSES[h.pose] || ''} ${ACTION_NAMES[h.pose] || h.pose}`;
  highlightGuide(h.pose);
  $('#openBar').style.width = `${(h.openness * 100) | 0}%`; $('#openPct').textContent = `${(h.openness * 100) | 0}%`;
  const src = h.pose === 'pinch' ? h.pinchPt : h.tip, sp = toScreen(src);
  handCursor.x += (sp.x - handCursor.x) * 0.6; handCursor.y += (sp.y - handCursor.y) * 0.6;
  const showCursor = ['point', 'pinch', 'ok'].includes(h.pose) || !!S.grab;
  handCursor.active = showCursor; cur.hidden = !showCursor;
  if (showCursor) { cur.style.transform = `translate(${handCursor.x}px, ${handCursor.y}px)`; cur.classList.toggle('pinch', h.pose === 'pinch'); }
  if (!holding) { sl.prevPalm = h.palm; return; }
  if (onset) onSign(h, h.pose);
  switch (h.pose) {
    case 'fist': {
      if (!S.summoned) summon();
      if (onset && (S.explodeT > 0.05 || anyMoved()) && !game.on) { setExplode(0); S.pulled.clear(); sfx.whoosh(false); }
      if (sl.prevPalm) { S.rotY += -(h.palm.x - sl.prevPalm.x) * 7; S.rotXT = clamp(S.rotXT + (h.palm.y - sl.prevPalm.y) * 5, -1.3, 1.3); S.velY = -(h.palm.x - sl.prevPalm.x) * 60; }
      break;
    }
    case 'open': case 'partial':
      if (S.summoned && !game.on && (!S.cutOn || S.autoCut)) { const before = S.explodeT; setExplode(clamp((h.openness - 0.35) / 0.5, 0, 1)); if (before < 0.2 && S.explodeT >= 0.2) sfx.whoosh(true); }
      if (S.cutOn && !S.autoCut) S.cutWT = ((1 - h.palm.x) * 2 - 1) * -TARGET_RADIUS * 1.3;
      if (settings.gestureRotate) { const r = h.roll, dz = 0.22; S.velY = Math.abs(r) > dz ? -(r - Math.sign(r) * dz) * 3 : S.velY * 0.9; S.rotXT = clamp((h.palm.y - 0.5) * 1.6, -1, 1); }
      break;
    case 'point': case 'ok': {
      const p = pickAt(handCursor.x, handCursor.y); if (p !== S.hover && p >= 0) sfx.tick(); S.hover = p;
      if (h.pose === 'point') {
        if (p !== G.dwellPart) { G.dwellPart = p; G.dwellStart = performance.now(); }
        else if (p >= 0 && p !== S.sel && performance.now() - G.dwellStart > 600) { select(p); sfx.select(); }
        cur.style.setProperty('--dwell', p >= 0 && p !== S.sel ? Math.min(1, (performance.now() - G.dwellStart) / 600) : 0);
      }
      break;
    }
    case 'pinch':
      if (onset) { const p = pickAt(handCursor.x, handCursor.y); const t = p >= 0 ? p : S.hover >= 0 ? S.hover : S.sel; if (t >= 0) startGrab(t, handCursor.x, handCursor.y, 'hand', h.size); }
      else if (S.grab?.mode === 'hand') moveGrab(handCursor.x, handCursor.y, h.size);
      break;
  }
  sl.prevPalm = h.palm;
}
tracker.onFrame = ({ hands, snap, swipe }) => {
  const cur = $('#cursor');
  $('#handState').textContent = hands.length ? hands.map(h => (h.side === 'Left' ? 'L' : 'R') + (POSES[h.pose] || '')).join(' ') : 'no hand';
  $('#camStatus').textContent = `Tracking · ${tracker.fps} fps${tracker.light != null ? ' · light ' + (tracker.light < 0.18 ? 'low ⚠️' : 'ok') : ''}`;
  if (!hands.length) { handCursor.active = false; cur.hidden = true; G.two = null; if (S.grab?.mode === 'hand') endGrab(); Object.values(G.slots).forEach(s => { s.pose = null; s.count = 0; s.prevPalm = null; }); $('#gestureName').textContent = '—'; highlightGuide(null); return; }
  activity();
  if (snap) { toggleSummon(); flash('🫰 Snap!'); sfx.whoosh(S.summoned); }
  if (swipe && !S.grab && performance.now() - G.lastNav > 900) { G.lastNav = performance.now(); swipe === 'right' ? next() : prev(); flash(swipe === 'right' ? '👉 Next' : '👈 Previous'); sfx.whoosh(true); return; }
  if (hands.length >= 2) {
    const [a, b] = hands, act = hands.find(h => ['point', 'pinch', 'ok'].includes(h.pose)), other = hands.find(h => h !== act);
    // one hand points / grabs while the other (fist) rotates the model
    if (act && other && other.pose === 'fist') { G.two = null; singleHand(act, cur); const sl = G.slots[other.side] || (G.slots[other.side] = {}); if (sl.prevPalm) { S.rotY += -(other.palm.x - sl.prevPalm.x) * 7; S.rotXT = clamp(S.rotXT + (other.palm.y - sl.prevPalm.y) * 5, -1.3, 1.3); } sl.prevPalm = other.palm; return; }
    if (S.grab?.mode === 'hand') endGrab();
    cur.hidden = true; handCursor.active = false;
    const d = Math.hypot(a.palm.x - b.palm.x, a.palm.y - b.palm.y), ang = Math.atan2(a.palm.y - b.palm.y, a.palm.x - b.palm.x);
    const stretch = a.pose === 'pinch' && b.pose === 'pinch';
    if (!G.two || G.two.stretch !== stretch) G.two = { d, ang, z: S.zoomT, ry: S.rotY, e: S.explodeT, stretch };
    if (stretch) { setExplode(G.two.e + (d - G.two.d) * 2.4); $('#gestureName').textContent = '🤏🤏 pull apart'; }
    else {
      S.zoomT = clamp(G.two.z * G.two.d / Math.max(0.05, d), 3, 16);
      let da = ang - G.two.ang; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
      S.rotY = G.two.ry - da * 1.5; S.velY = 0;
      $('#gestureName').textContent = '🙌 zoom · turn';
    }
    highlightGuide('two'); return;
  }
  G.two = null;
  singleHand(hands[0], cur);
};
const GUIDE = [['🫰', 'snap', 'summon'], ['✊', 'fist', 'form / rotate'], ['✋', 'open', 'explode'], ['☝️', 'point', 'select'], ['🤏', 'pinch', 'grab & move'], ['👌', 'ok', 'isolate'], ['👍', 'thumb', 'explain'], ['👎', 'thumbdown', 'reassemble'], ['✌️', 'victory', 'next'], ['3️⃣', 'three', 'cut-away'], ['🤘', 'rock', 'view'], ['🤙', 'shaka', 'tour'], ['👋', 'swipe', 'prev / next'], ['🙌', 'two', 'zoom · turn'], ['🤏🤏', 'two', 'pull apart']];
$('#gestureGuide').innerHTML = GUIDE.map(([e, k, t]) => `<span data-pose="${k}"><b>${e}</b>${t}</span>`).join('');
let lastGuide = null;
function highlightGuide(p) { if (p === lastGuide) return; lastGuide = p; $$('#gestureGuide span').forEach(s => s.classList.toggle('on', s.dataset.pose === p || (p === 'partial' && s.dataset.pose === 'open'))); }

// ---------------------------------------------------------------- calibration wizard
async function calibrate() {
  if (!tracker.running) { await toggleCamera(true); if (!tracker.running) return; }
  const box = $('#calibDlg'), txt = $('#calibText'), bar = $('#calibBar');
  toggleDlg('#calibDlg', true);
  const steps = [['open', '✋ Hold up an OPEN hand, fingers spread'], ['fist', '✊ Now make a FIST'], ['pinch', '🤏 Now PINCH your thumb and index finger together']], res = {};
  for (let k = 0; k < steps.length; k++) {
    const [key, msg] = steps[k];
    txt.textContent = msg; bar.style.width = `${(k / steps.length) * 100}%`;
    await new Promise(r => setTimeout(r, 1300));
    if (box.hidden) return;
    txt.textContent = msg + ' — hold still…';
    res[key] = await tracker.calibrate(key);
    if (!res[key]) { txt.textContent = '❌ I couldn\'t see your hand. Check the lighting and try again.'; sfx.err(); return; }
    sfx.sign();
  }
  bar.style.width = '100%';
  const ext = res.fist.ratio + (res.open.ratio - res.fist.ratio) * 0.45, pinch = res.pinch.pinchD + (res.open.pinchD - res.pinch.pinchD) * 0.35;
  settings.calib = { ext: clamp(ext, 1.15, 1.8), pinch: clamp(pinch, 0.18, 0.5), snap: clamp(pinch * 0.8, 0.15, 0.4) };
  settings.sensitivity = 'custom'; tracker.sensitivity = 'custom'; tracker.calib = settings.calib; saveSettings(); syncSettingsUI();
  txt.textContent = '✅ Calibrated to your hand! Gestures are now tuned just for you.'; sfx.win();
  setTimeout(() => { if (!box.hidden) toggleDlg('#calibDlg', false); }, 2200);
}
async function toggleCamera(force) {
  const on = force ?? !tracker.running;
  if (!on) { tracker.stop(); $('#cam').hidden = true; btnState('camera', false); $('#cursor').hidden = true; return; }
  $('#cam').hidden = false; $('#camStatus').textContent = 'Starting camera…'; btnState('camera', true);
  try {
    toast('Loading hand tracking… (first time takes a few seconds)');
    await tracker.start();
    $('#camStatus').textContent = 'Tracking on-device';
    if (!settings.calib) setTimeout(() => toast('Tip: press 🎯 Calibrate in the camera panel to tune gestures to your hand'), 4000);
    toast('Camera on · snap 🫰 or make a fist ✊ to summon');
  } catch (e) {
    console.error(e); tracker.stop(); $('#cam').hidden = true; btnState('camera', false);
    toast('Camera unavailable: ' + (e.message || e.name) + ' — mouse, touch and keys still work.', 'err');
  }
}

// ---------------------------------------------------------------- voice: speak + commands (Web Speech API, free & built-in)
function speak(text, onend) {
  if (!('speechSynthesis' in window) || !text) { if (onend) setTimeout(onend, Math.max(3000, (text || '').length * 60)); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.rate = settings.voiceRate; u.pitch = 1;
  const v = speechSynthesis.getVoices().find(v => /en[-_](NG|GB|US)/i.test(v.lang) && /natural|google|samantha|daniel/i.test(v.name)) || speechSynthesis.getVoices().find(v => /^en/i.test(v.lang));
  if (v) u.voice = v;
  if (onend) { let done = false; const fin = () => { if (!done) { done = true; onend(); } }; u.onend = fin; u.onerror = fin; setTimeout(fin, text.length * 95 + 4000); }
  speechSynthesis.speak(u);
}
function speakPart(i) {
  const p = S.built?.parts[i];
  if (p) { speak(`${p.name}. ${p.desc} ${p.fact || ''}`); flash('🔊 ' + p.name); }
  else { const d = models[S.idx]; speak(`${d.name}. ${d.about || ''} Point at a part to learn more.`); flash('🔊 ' + d.name); }
}
let recog = null;
function toggleVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Voice commands need Chrome or Edge. Speaking still works everywhere.', 'err'); return; }
  if (recog) { recog.onend = null; recog.stop(); recog = null; btnState('voice', false); toast('Voice off'); return; }
  recog = new SR(); recog.lang = 'en-US'; recog.continuous = true; recog.interimResults = false;
  recog.onresult = e => { const txt = e.results[e.results.length - 1][0].transcript.trim().toLowerCase(); handleVoice(txt); };
  recog.onerror = e => { if (e.error === 'not-allowed') { toast('Microphone blocked', 'err'); recog = null; btnState('voice', false); } };
  recog.onend = () => { if (recog) try { recog.start(); } catch {} };
  recog.start(); btnState('voice', true);
  toast('🎙 Listening: try "explode", "next", "show the heart", "what is the aorta", "quiz"');
}
function handleVoice(t) {
  flash('🎙 “' + t + '”'); activity();
  const has = (...w) => w.some(x => t.includes(x));
  // a model by name?
  const mi = models.findIndex(m => t.includes(m.name.toLowerCase()) || t.includes(m.id) || m.name.toLowerCase().split(/[ ,()]+/).some(w => w.length > 3 && t.includes(w) && has('show', 'open', 'load', 'go to')));
  if (has('show', 'open', 'load', 'go to') && mi >= 0) return loadModel(mi);
  // a part by name?
  const parts = S.built.parts;
  const pi = parts.findIndex(p => t.includes(p.name.toLowerCase().replace(/\(.*?\)/g, '').trim()));
  if (pi >= 0) { select(pi); if (has('pull', 'take out', 'remove')) togglePull(pi); else if (has('isolate', 'only')) { S.isolate = true; updateInfo(); } else speakPart(pi); return; }
  if (has('what', 'which', 'where', 'how', 'who', 'find', 'search', 'why')) { const r = search(t); if (r.length && r[0].score >= 6) return goResult(r[0], true); }
  if (has('rebuild', 'puzzle', 'put it back together')) return startRebuild();
  if (has('reassemble', 'reset', 'fix it')) return reassemble();
  if (has('calibrate')) return calibrate();
  if (has('explode', 'open up', 'take apart', 'break')) return setExplode(1);
  if (has('form', 'assemble', 'close', 'put together', 'rebuild')) return setExplode(0);
  if (has('dissolve', 'vanish', 'disappear', 'hide')) return dissolve();
  if (has('summon', 'appear', 'start')) return summon();
  if (has('next')) return next();
  if (has('previous', 'back')) return prev();
  if (has('quiz', 'test me')) return startQuiz();
  if (has('cut', 'slice')) return toggleCut();
  if (has('label')) { S.labels = !S.labels; return; }
  if (has('realistic', 'real view', 'solid')) { settings.style = 'real'; return applyStyle(); }
  if (has('x-ray', 'xray', 'x ray')) { settings.style = 'xray'; return applyStyle(); }
  if (has('glow')) { settings.style = 'glow'; return applyStyle(); }
  if (has('tour', 'guide me', 'teach me')) return toggleTour(true);
  if (has('stop', 'pause')) { S.anim = false; settings.autoRotate = false; return; }
  if (has('play', 'animate', 'run')) { S.anim = true; return; }
  if (has('rotate', 'spin')) { S.velY = 2.5; return; }
  if (has('zoom in', 'closer')) { S.zoomT = clamp(S.zoomT * 0.75, 3, 16); return; }
  if (has('zoom out', 'further')) { S.zoomT = clamp(S.zoomT * 1.3, 3, 16); return; }
  if (has('what is this', 'explain', 'tell me', 'describe')) return speakPart(S.sel);
  if (has('demo')) return toggleDemo();
}

// ---------------------------------------------------------------- quiz (multiple choice + "find it" with your hand)
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function startQuiz() {
  const parts = S.built.parts.map((p, i) => ({ ...p, i })).filter(p => p.desc);
  if (parts.length < 3) { toast('This model needs at least 3 described parts for a quiz', 'err'); return; }
  if (!S.summoned) summon();
  const pool = shuffle(parts.slice());
  const qs = pool.slice(0, Math.min(6, pool.length)).map((p, k) => k % 3 === 2
    ? { mode: 'find', target: p.i, text: `Find the ${p.name}`, hint: p.desc }
    : { mode: 'mc', target: p.i, text: p.desc.split(/(?<=\.)\s/)[0], options: shuffle([p, ...shuffle(parts.filter(o => o.i !== p.i && o.name !== p.name)).slice(0, 3)]).map(o => ({ name: o.name, i: o.i })) });
  S.quiz = { qs, n: 0, score: 0, mode: null };
  showQuestion();
}
function showQuestion() {
  const Q = S.quiz, q = Q.qs[Q.n], box = $('#quiz');
  if (!q) return finishQuiz();
  Q.mode = q.mode; select(-1);
  $('#quizProgress').textContent = `Question ${Q.n + 1} of ${Q.qs.length} · score ${Q.score}`;
  if (q.mode === 'mc') {
    box.hidden = false; $('#findBanner').hidden = true;
    $('#quizQ').textContent = `Which part is this? “${q.text}”`;
    $('#quizOpts').innerHTML = '';
    q.options.forEach(o => { const b = document.createElement('button'); b.textContent = o.name; b.onclick = () => answer(o.i === q.target, b); $('#quizOpts').appendChild(b); });
  } else {
    box.hidden = true; $('#findBanner').hidden = false;
    $('#findText').textContent = `🎯 ${q.text}`; $('#findHint').textContent = 'Point ☝️ and hold, or click it. Hint: ' + q.hint;
    Q.findStart = performance.now(); setExplode(0.6);
    clearTimeout(Q.timer); Q.timer = setTimeout(() => { if (S.quiz?.mode === 'find') { toast(`Time up — it was the ${S.built.parts[q.target].name}`, 'err'); select(q.target); setTimeout(() => nextQ(), 1800); } }, 30000);
  }
}
function answer(ok, btn) {
  const q = S.quiz.qs[S.quiz.n];
  $$('#quizOpts button').forEach(b => { b.disabled = true; if (b.textContent === S.built.parts[q.target].name) b.classList.add('right'); });
  if (ok) { S.quiz.score++; flash('✅ Correct!'); } else { btn.classList.add('wrong'); flash('❌ Not quite'); }
  select(q.target); setTimeout(nextQ, 1500);
}
function checkFind(i) {
  const q = S.quiz.qs[S.quiz.n]; if (S.quiz.mode !== 'find') return;
  S.quiz.mode = 'wait'; clearTimeout(S.quiz.timer);
  if (i === q.target) { S.quiz.score++; flash('✅ Found it!'); } else { flash(`❌ That's the ${S.built.parts[i].name}`); setTimeout(() => select(q.target), 900); }
  setTimeout(nextQ, 1800);
}
function nextQ() { if (!S.quiz) return; S.quiz.n++; showQuestion(); }
function finishQuiz() {
  const { score, qs } = S.quiz, key = 'blaisevr:best:' + models[S.idx].id;
  const best = Math.max(score, +(localStorage.getItem(key) || 0)); try { localStorage.setItem(key, best); } catch {}
  $('#findBanner').hidden = true; const box = $('#quiz'); box.hidden = false;
  $('#quizProgress').textContent = 'Finished';
  $('#quizQ').textContent = `You scored ${score} / ${qs.length}${score === qs.length ? ' — perfect! 🏆' : ''}  ·  best: ${best}`;
  $('#quizOpts').innerHTML = '<button id="quizAgain">Play again</button><button id="quizClose">Close</button>';
  $('#quizAgain').onclick = startQuiz; $('#quizClose').onclick = () => endQuiz(true);
  speak(`You scored ${score} out of ${qs.length}.`);
  S.quiz.mode = 'done';
}
function endQuiz(hide) { if (S.quiz) clearTimeout(S.quiz.timer); S.quiz = null; if (hide) { $('#quiz').hidden = true; $('#findBanner').hidden = true; } }

// ---------------------------------------------------------------- recording & screenshots (free, in-browser)
function toggleRecord() {
  if (S.recording) { S.recording.stop(); return; }
  if (!window.MediaRecorder) { toast('Recording not supported in this browser', 'err'); return; }
  const stream = cv.captureStream(60);
  const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t)) || '';
  const rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 8e6 } : {}); const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
    download(blob, `blaisevr-${models[S.idx].id}.${/mp4/.test(blob.type) ? 'mp4' : 'webm'}`);
    S.recording = null; btnState('record', false); document.body.classList.remove('rec'); toast('🎬 Video saved');
  };
  rec.start(); S.recording = rec; btnState('record', true); document.body.classList.add('rec'); toast('⏺ Recording… press K or the button again to stop');
}
function screenshot() {
  composer.render();
  cv.toBlob(b => { download(b, `blaisevr-${models[S.idx].id}.png`); toast('📸 Screenshot saved'); });
}
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

// ---------------------------------------------------------------- demo mode
const demo = { t: 0, step: 0 };
function toggleDemo(on = !S.demo) { S.demo = on; demo.t = 0; demo.step = 0; btnState('demo', on); toast(on ? '▶ Demo mode — any key or click stops it' : 'Demo stopped'); }
function demoStep(dt) {
  demo.t += dt; const steps = [
    [0.1, () => { if (!S.summoned) summon(); setExplode(0); select(-1); }],
    [3.5, () => setExplode(1)],
    [5.5, () => { const i = Math.floor(Math.random() * S.built.parts.length); select(i); }],
    [9.5, () => { const i = Math.floor(Math.random() * S.built.parts.length); select(i); togglePull(i); }],
    [13, () => { S.pulled.clear(); select(-1); setExplode(0); }],
    [15.5, () => next()],
  ];
  const s = steps[demo.step];
  if (s && demo.t > s[0]) { s[1](); demo.step++; }
  if (demo.step >= steps.length) { demo.t = 0; demo.step = 0; }
}
function activity() { S.lastInput = performance.now(); }
addEventListener('pointerdown', () => { if (S.demo) toggleDemo(false); }, true);
addEventListener('keydown', e => { if (S.demo && e.key.toLowerCase() !== 'd') toggleDemo(false); }, true);
setInterval(() => { if (!S.demo && !S.quiz && S.summoned && performance.now() - S.lastInput > 90000 && $('#welcome').hidden) toggleDemo(true); }, 5000);

// ---------------------------------------------------------------- importing: drag & drop / file picker / text
async function importFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  toast(`Importing ${file.name}…`);
  try {
    let def;
    if (ext === 'json') { def = fromJSON(await file.text(), file.name); saveCustom(def); }
    else if (['glb', 'gltf', 'obj', 'stl'].includes(ext)) def = await from3DFile(file);
    else if (/^image\//.test(file.type)) def = await fromImage(file);
    else throw new Error('Drop a .json, .glb, .gltf, .obj, .stl or an image');
    addModel(def);
  } catch (e) { console.error(e); toast('Import failed: ' + e.message, 'err'); }
}
function addModel(def) {
  const existing = models.findIndex(m => m.id === def.id);
  if (existing >= 0) { models[existing] = def; [...cache.keys()].filter(k => k.startsWith(def.id + ':')).forEach(k => cache.delete(k)); }
  else models.push(def);
  index = null; buildPicker(); if (!S.summoned) summon(); loadModel(existing >= 0 ? existing : models.length - 1);
}
function saveCustom(def) {
  try { const list = safeJSON(localStorage.getItem('blaisevr:custom')); list[def.id] = def; const s = JSON.stringify(list); if (s.length < 3e6) localStorage.setItem('blaisevr:custom', s); } catch {}
}
function loadSavedCustom() { const list = safeJSON(localStorage.getItem('blaisevr:custom')); Object.values(list).forEach(d => { if (d?.parts) models.push(d); }); }
let dragDepth = 0;
addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; $('#drop').hidden = false; });
addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#drop').hidden = true; } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; $('#drop').hidden = true; [...e.dataTransfer.files].forEach(importFile); });
$('#file').addEventListener('change', e => { [...e.target.files].forEach(importFile); e.target.value = ''; });
function openText() { toggleDlg('#textDlg', true); setTimeout(() => $('#textIn').focus(), 50); }
$('#textGo').onclick = () => { const t = $('#textIn').value.trim(); if (!t) return; toggleDlg('#textDlg', false); addModel(fromText(t)); };
$('#textIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#textGo').click(); } });

// ---------------------------------------------------------------- UI wiring
function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3700);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
function flash(msg) { const f = $('#flash'); f.textContent = msg; f.classList.remove('show'); void f.offsetWidth; f.classList.add('show'); }
function btnState(act, on) { $$(`[data-act="${act}"]`).forEach(b => b.classList.toggle('on', !!on)); }
function toggleDlg(sel, force) { const d = $(sel); const show = force ?? d.hidden; closeDialogs(); d.hidden = !show; }
function closeDialogs() { let any = false; $$('.dlg').forEach(d => { if (!d.hidden) { d.hidden = true; any = true; } }); return any; }
function togglePicker(force) { const p = $('#picker'); p.classList.toggle('open', force ?? !p.classList.contains('open')); }

function buildPicker() {
  const list = $('#pickerList'); list.innerHTML = '';
  models.forEach((m, i) => {
    const b = document.createElement('button'); b.className = 'card'; b.dataset.i = i;
    b.innerHTML = `<span class="em">${m.emoji || '✨'}</span><span class="nm">${escapeHTML(m.name)}</span><span class="ct">${escapeHTML(m.category || '')}</span>`;
    b.onclick = () => { if (!S.summoned) summon(); loadModel(i); };
    list.appendChild(b);
  });
  updatePicker();
}
function updatePicker() { $$('#pickerList .card').forEach(c => c.classList.toggle('on', +c.dataset.i === S.idx)); $('#pickerList .card.on')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }

const ACTIONS = {
  snap: toggleSummon, form: () => { summon(); setExplode(0); }, explodeBtn: () => setExplode(S.explodeT > 0.5 ? 0 : 1), next, prev,
  cut: () => toggleCut(), anim: KEYS.a, labels: KEYS.l, style: cycleStyle, tour: () => toggleTour(), search: () => openSearch(), quiz: KEYS.q, voice: toggleVoice, record: toggleRecord, camera: () => toggleCamera(),
  help: () => toggleDlg('#help'), settings: () => toggleDlg('#settings'), browse: () => togglePicker(), text: openText, import: () => $('#file').click(),
  demo: () => toggleDemo(), shot: screenshot, share: share, speak: () => speakPart(S.sel), pull: () => togglePull(S.sel), isolate: toggleIsolate, closeInfo: () => select(-1),
  closeDlg: () => closeDialogs(), rebuild: () => game.on ? endGame(true) : startRebuild(), reassemble: () => reassemble(), calibrate: () => calibrate(), sound: () => { settings.sound = !settings.sound; saveSettings(); btnState('sound', settings.sound); toast(settings.sound ? '🔊 Sound on' : '🔇 Sound off'); }, quizClose: () => endQuiz(true), colors: cycleColors,
};
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && ACTIONS[b.dataset.act]) { activity(); ACTIONS[b.dataset.act](); } });
$('#explode').addEventListener('input', e => setExplode(+e.target.value));
$('#cutSlider').addEventListener('input', e => { S.cutWT = +e.target.value; S.autoCut = false; });
$('#cutAxisBtn').onclick = () => cycleCutAxis(1);

const COLOR_MODES = ['parts', 'rainbow', 'heat', 'ice', 'gold'];
function cycleColors() { settings.colorMode = COLOR_MODES[(COLOR_MODES.indexOf(settings.colorMode) + 1) % COLOR_MODES.length]; cloud.setColorMode(settings.colorMode); saveSettings(); syncSettingsUI(); toast('Colours: ' + settings.colorMode); }
async function share() {
  const url = location.href;
  try { if (navigator.share) await navigator.share({ title: 'BlaiseVR — ' + models[S.idx].name, url }); else { await navigator.clipboard.writeText(url); toast('🔗 Link copied'); } } catch {}
}

// settings dialog
function syncSettingsUI() {
  $('#setStyle').value = settings.style; $('#setFocus').checked = settings.focus;
  $('#setParticles').value = settings.particles; $('#setBloom').checked = settings.bloom; $('#setTrails').checked = settings.trails;
  $('#setSens').value = settings.sensitivity; $('#camSens').value = settings.sensitivity; $('#setColor').value = settings.colorMode;
  $('#setAuto').checked = settings.autoRotate; $('#setAnimSpeed').value = settings.animSpeed; $('#setHandRot').checked = settings.gestureRotate;
  btnState('anim', S.anim); btnState('labels', S.labels); btnState('sound', settings.sound);
}
$('#setParticles').onchange = e => { settings.particles = +e.target.value; saveSettings(); cache.clear(); loadModel(S.idx, { morph: false, announce: false }); toast(`${(settings.particles / 1000) | 0}k particles`); };
$('#setStyle').onchange = e => { settings.style = e.target.value; saveSettings(); applyStyle(); };
$('#setFocus').onchange = e => { settings.focus = e.target.checked; saveSettings(); };
$('#setBloom').onchange = e => { settings.bloom = e.target.checked; saveSettings(); applyFx(); };
$('#setTrails').onchange = e => { settings.trails = e.target.checked; saveSettings(); applyFx(); };
const setSens = v => { if (v === 'custom' && !settings.calib) { calibrate(); return; } settings.sensitivity = v; tracker.sensitivity = v; saveSettings(); syncSettingsUI(); };
$('#setSens').onchange = e => setSens(e.target.value); $('#camSens').onchange = e => setSens(e.target.value);
$('#setColor').onchange = e => { settings.colorMode = e.target.value; cloud.setColorMode(settings.colorMode); saveSettings(); };
$('#setAuto').onchange = e => { settings.autoRotate = e.target.checked; saveSettings(); };
$('#setAnimSpeed').oninput = e => { settings.animSpeed = +e.target.value; saveSettings(); };
$('#setHandRot').onchange = e => { settings.gestureRotate = e.target.checked; saveSettings(); };
$('#setReset').onclick = () => { localStorage.removeItem('blaisevr:custom'); localStorage.removeItem('blaisevr:settings'); location.reload(); };

// welcome
$('#startCam').onclick = () => { sfx.unlock(); $('#welcome').hidden = true; summon(); toggleCamera(true); };
$('#startNoCam').onclick = () => { sfx.unlock(); $('#welcome').hidden = true; summon(); toast('Drag to rotate · scroll to explode · click a part · H for help'); };

// WebXR (VR headsets like Quest open it in their browser — free)
if (navigator.xr?.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then(ok => {
  if (!ok) return;
  const btn = VRButton.createButton(renderer); btn.id = 'vrBtn'; document.body.appendChild(btn);
  renderer.xr.addEventListener('sessionstart', () => { pivot.position.set(0, 1.4, -2.2); pivot.scale.setScalar(0.35); summon(); });
  renderer.xr.addEventListener('sessionend', () => { pivot.position.set(0, 0, 0); pivot.scale.setScalar(1); });
}).catch(() => {});

// PWA (works offline after first visit)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('./sw.js').catch(() => {});


// ---------------------------------------------------------------- guided tour (narrated walk through every part)
const tour = { on: false, i: -1, order: [], token: 0, switching: false };
function toggleTour(on = !tour.on) {
  tour.token++;
  if (!on) {
    if (!tour.on) return; tour.on = false; if ('speechSynthesis' in window) speechSynthesis.cancel();
    $('#tourBar').hidden = true; btnState('tour', false); select(-1); setExplode(0); return;
  }
  if (S.quiz) endQuiz(true); if (S.demo) toggleDemo(false);
  const parts = S.built.parts;
  tour.on = true; tour.i = -1; tour.order = parts.map((_, i) => i).filter(i => parts[i].desc);
  btnState('tour', true); $('#tourBar').hidden = false; if (!S.summoned) summon();
  select(-1); setExplode(0.5); settings.autoRotate = true;
  const d = models[S.idx]; $('#tourText').textContent = `${d.emoji || ''} ${d.name}`; $('#tourStep').textContent = 'Overview';
  const tk = tour.token; speak(`${d.name}. ${d.about || ''}`, () => tk === tour.token && tourStep(1));
}
function tourStep(dir) {
  if (!tour.on) return;
  tour.i = Math.max(0, tour.i + dir);
  if (tour.i >= tour.order.length) {
    select(-1); setExplode(0); $('#tourStep').textContent = 'Done!'; $('#tourText').textContent = 'Press Q to test yourself with a quiz';
    const tk = tour.token; speak('That is the end of the tour. Press Q for a quiz to test yourself.', () => tk === tour.token && toggleTour(false)); return;
  }
  const pi = tour.order[tour.i], p = S.built.parts[pi];
  select(pi);
  $('#tourText').textContent = p.name; $('#tourStep').textContent = `Part ${tour.i + 1} of ${tour.order.length}`;
  tour.token++; const tk = tour.token;
  speak(`${p.name}. ${p.desc} ${p.fact || ''}`, () => { if (tk === tour.token) setTimeout(() => tk === tour.token && tourStep(1), 700); });
}
$('#tourPrev').onclick = () => tourStep(-1);
$('#tourNext').onclick = () => tourStep(1);
$('#tourStop').onclick = () => toggleTour(false);

// ---------------------------------------------------------------- smart search across every model and part (offline)
const STOP = new Set('what is the a an of does do which where how in my and to for part parts show me find tell about who why are it its this that with on from can i you we by be as at or into make makes made used use called work works thing things there their they'.split(' '));
const stem = w => w.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s)$/, '');
const SYN = { electricity: ['electric', 'current', 'voltage', 'power'], breathe: ['breath', 'air', 'oxygen', 'lung'], breath: ['air', 'oxygen'], see: ['vision', 'light', 'eye'], food: ['digest', 'nutrient', 'eat'],
  think: ['brain', 'neuron'], energy: ['atp', 'respiration', 'power'], heart: ['blood', 'pump'], pump: ['heart'], fuel: ['petrol'], gas: ['petrol', 'exhaust'], spin: ['rotate', 'turn'], hot: ['heat', 'temperature'], sound: ['hear', 'noise'] };
function tokens(t) { return (t.toLowerCase().match(/[a-z0-9']+/g) || []).filter(w => w.length > 1 && !STOP.has(w)).map(stem); }
let index = null, df = null;
function buildIndex() {
  index = []; df = new Map();
  const add = e => { index.push(e); new Set([...e.nameT, ...e.textT]).forEach(w => df.set(w, (df.get(w) || 0) + 1)); };
  models.forEach((m, mi) => {
    add({ mi, pi: -1, name: m.name, text: m.about || '', nameT: tokens(m.name), textT: tokens(`${m.category || ''} ${m.about || ''}`), headT: tokens((m.about || '').split(' ').slice(0, 8).join(' ')) });
    (m.parts || []).forEach((p, pi) => add({ mi, pi, name: p.name, text: p.desc || '', nameT: tokens(p.name), textT: tokens(`${p.desc || ''} ${p.fact || ''}`), headT: tokens((p.desc || '').split(' ').slice(0, 7).join(' ')), modelT: tokens(m.name) }));
  });
}
function search(q) {
  if (!index) buildIndex();
  const base = tokens(q); if (!base.length) return [];
  const E = index.length, idf = w => Math.log(1 + E / (1 + (df.get(w) || 0)));
  const groups = base.map(w => [[w, 1], ...(SYN[w] || []).map(x => [stem(x), 0.55])]);
  const res = index.map(e => {
    let score = 0, hit = 0;
    for (const g of groups) {
      let best = 0;
      for (const [w, k] of g) {
        let sc = 0;
        if (k === 1) { if (e.nameT.includes(w)) sc += 6; else if (w.length > 3 && e.nameT.some(n => n.startsWith(w) || w.startsWith(n) && n.length > 3)) sc += 4; }
        if (e.textT.includes(w)) sc += 2; else if (w.length > 4 && e.textT.some(n => n.startsWith(w))) sc += 1;
        if (e.headT.includes(w)) sc += 1.5;
        if (e.modelT?.includes(w)) sc += 1;
        best = Math.max(best, sc * k * idf(w));
      }
      if (best > 0) hit++;
      score += best;
    }
    score *= Math.pow(hit / groups.length, 1.5);
    if (e.pi < 0) score *= 0.85;
    return { ...e, score };
  }).filter(e => e.score > 0).sort((a, b) => b.score - a.score);
  return res.slice(0, 8);
}
function goResult(r, speakIt = true) {
  closeDialogs(); if (!S.summoned) summon();
  if (r.mi !== S.idx) loadModel(r.mi);
  if (r.pi >= 0) { setExplode(Math.max(S.explodeT, 0.45)); select(r.pi, { speak: speakIt }); }
  else if (speakIt) speakPart(-1);
}
function openSearch() { toggleDlg('#searchDlg', true); renderSearch(); setTimeout(() => $('#searchIn').focus(), 50); }
function renderSearch() {
  const q = $('#searchIn').value.trim(), box = $('#searchRes');
  const r = q ? search(q) : [];
  box.innerHTML = '';
  if (!q) { box.innerHTML = '<p class="muted">Try: <em>what pumps blood</em>, <em>powerhouse of the cell</em>, <em>which part makes electricity</em>, <em>pollen</em>, <em>battery</em>, <em>magma</em>.</p>'; return; }
  if (!r.length) { box.innerHTML = '<p class="muted">No matches. Try different words.</p>'; return; }
  r.forEach(e => {
    const b = document.createElement('button'); b.className = 'res';
    const m = models[e.mi];
    b.innerHTML = `<span class="em">${m.emoji || '✨'}</span><span><b>${escapeHTML(e.name)}</b><small>${escapeHTML(e.pi >= 0 ? m.name : 'Model · ' + (m.category || ''))}</small><i>${escapeHTML((e.text || '').slice(0, 120))}${(e.text || '').length > 120 ? '…' : ''}</i></span>`;
    b.onclick = () => goResult(e);
    box.appendChild(b);
  });
}
$('#searchIn').addEventListener('input', renderSearch);
$('#searchIn').addEventListener('keydown', e => { if (e.key === 'Enter') { const r = search(e.target.value); if (r[0]) goResult(r[0]); } });

// ---------------------------------------------------------------- boot
buildPicker(); syncSettingsUI(); applyStyle();
const hashId = decodeURIComponent((location.hash.match(/m=([^&]+)/) || [])[1] || '');
const start = Math.max(0, models.findIndex(m => m.id === hashId));
loadModel(start, { morph: false, announce: false });
setScene();
if (new URLSearchParams(location.search).has('skip')) { $('#welcome').hidden = true; summon(); }
window.BlaiseVR = { S, models, loadModel, summon, setExplode, select, startQuiz, addModel, fromText, settings, cloud, tracker, startRebuild, reassemble, startGrab, moveGrab, endGrab, game, pickAt, onFrame: (...a) => tracker.onFrame(...a) };
