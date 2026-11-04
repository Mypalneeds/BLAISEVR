// BlaiseVR — webcam hand tracking (MediaPipe, 100% on-device) + a smarter gesture engine:
//  • One-Euro filtering for steady cursors   • pose voting + hysteresis so signs don't flicker
//  • 13 hand signs + swipes + snap            • stable left/right hand identity
//  • lighting / distance hints                • personal calibration
const VISION_VER = '0.10.18';
const VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VER}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const DET_URL = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';
export const MIRROR_OBJECTS = ['bottle', 'cup', 'wine glass', 'cell phone', 'book', 'apple', 'orange', 'banana', 'bowl', 'vase', 'remote', 'mouse', 'scissors', 'toothbrush', 'teddy bear', 'clock', 'laptop', 'keyboard', 'donut', 'sports ball'];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.5);
export const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

export const SENSITIVITY = {
  strict:   { ext: 1.55, pinch: 0.24, snap: 0.2 },
  standard: { ext: 1.45, pinch: 0.3, snap: 0.24 },
  forgiving:{ ext: 1.32, pinch: 0.38, snap: 0.3 },
};
export const POSES = {
  fist: '✊', open: '✋', partial: '🖐', point: '☝️', pinch: '🤏', ok: '👌', victory: '✌️', three: '3️⃣',
  rock: '🤘', shaka: '🤙', thumb: '👍', thumbdown: '👎',
};

// ---------- One-Euro filter: smooth when still, responsive when moving ----------
export class OneEuro {
  constructor(minCutoff = 1.4, beta = 0.04, dCutoff = 1) { this.mc = minCutoff; this.b = beta; this.dc = dCutoff; this.x = null; this.dx = 0; this.t = 0; }
  static a(cut, dt) { const r = 2 * Math.PI * cut * dt; return r / (r + 1); }
  f(v, t) {
    if (this.x === null) { this.x = v; this.t = t; return v; }
    const dt = Math.max(1e-3, (t - this.t) / 1000); this.t = t;
    const dx = (v - this.x) / dt; this.dx += OneEuro.a(this.dc, dt) * (dx - this.dx);
    this.x += OneEuro.a(this.mc + this.b * Math.abs(this.dx), dt) * (v - this.x); return this.x;
  }
}

// ---------- classify one hand's 21 landmarks ----------
export function classify(lm, sensName = 'standard', prevPose = null, calib = null) {
  const S = { ...(SENSITIVITY[sensName] || SENSITIVITY.standard), ...(sensName === 'custom' && calib ? calib : {}) };
  const w = lm[0], size = dist(w, lm[9]) || 1e-3;
  const fingers = [[8, 5], [12, 9], [16, 13], [20, 17]];
  const ratios = fingers.map(([tip, mcp]) => dist(lm[tip], w) / (dist(lm[mcp], w) || 1e-3));
  const ext = ratios.map(r => r > S.ext);
  const openness = ratios.reduce((a, r) => a + Math.min(1, Math.max(0, (r - 1.05) / 0.75)), 0) / 4;
  const pinchD = dist(lm[4], lm[8]) / size;
  const snapD = dist(lm[4], lm[12]) / size;
  const thumbOut = dist(lm[4], lm[5]) / size > 0.6 && dist(lm[4], lm[17]) / size > 1.0;
  const thumbVert = (lm[2].y - lm[4].y) / size;  // + = thumb tip above its base
  const thumbUp = thumbOut && lm[4].y < lm[3].y && lm[3].y < lm[2].y && thumbVert > 0.45;
  const thumbDown = thumbOut && lm[4].y > lm[3].y && lm[3].y > lm[2].y && thumbVert < -0.45;
  const n = ext.filter(Boolean).length;
  const pinchTh = S.pinch * (prevPose === 'pinch' || prevPose === 'ok' ? 1.35 : 1);   // easier to keep a pinch than to start one

  let pose = 'partial';
  if (pinchD < pinchTh && ext[1] && ext[2] && ext[3]) pose = 'ok';
  else if (pinchD < pinchTh && ratios[0] > 1.2) pose = 'pinch';
  else if (n === 0) pose = thumbUp ? 'thumb' : thumbDown ? 'thumbdown' : 'fist';
  else if (ext[0] && !ext[1] && !ext[2] && !ext[3]) pose = 'point';
  else if (ext[0] && ext[1] && !ext[2] && !ext[3]) pose = 'victory';
  else if (ext[0] && ext[1] && ext[2] && !ext[3]) pose = 'three';
  else if (ext[0] && !ext[1] && !ext[2] && ext[3]) pose = 'rock';
  else if (!ext[0] && !ext[1] && !ext[2] && ext[3] && thumbOut) pose = 'shaka';
  else if (n >= 4 || (n === 3 && sensName === 'forgiving')) pose = 'open';

  let roll = Math.atan2(lm[17].y - lm[5].y, lm[17].x - lm[5].x);
  if (roll > Math.PI / 2) roll -= Math.PI; if (roll < -Math.PI / 2) roll += Math.PI;
  const palm = { x: (lm[0].x + lm[5].x + lm[17].x) / 3, y: (lm[0].y + lm[5].y + lm[17].y) / 3 };
  const pinchPt = { x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 };
  return { pose, openness, pinchD, snapD, roll, palm, tip: lm[8], pinchPt, wrist: w, size, ext, ratios, middleCurled: dist(lm[12], w) < dist(lm[9], w) * 1.35, S };
}

export class HandTracker {
  constructor(video, overlay) {
    this.video = video; this.overlay = overlay; this.ctx = overlay?.getContext('2d');
    this.running = false; this.onFrame = () => {}; this.onHint = () => {}; this.sensitivity = 'standard'; this.calib = null;
    this._snapArm = 0; this._lastSnap = 0; this._lastSwipe = 0;
    this.slots = { Left: this._slot(), Right: this._slot() };
    this._lightCv = document.createElement('canvas'); this._lightCv.width = 32; this._lightCv.height = 24;
    this._lastLight = 0; this._lastHintAt = {}; this._noHandSince = performance.now();
    this.fps = 0; this._fc = 0; this._fpsT = performance.now(); this.mode = '—';
  }
  _slot() { return { hist: [], pose: null, since: 0, f: { tx: new OneEuro(), ty: new OneEuro(), px: new OneEuro(1, 0.03), py: new OneEuro(1, 0.03), qx: new OneEuro(), qy: new OneEuro(), sz: new OneEuro(0.8, 0.01) }, moves: [] }; }
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera access (needs HTTPS or localhost).');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: 'user' }, audio: false });
    this.video.srcObject = stream; await this.video.play();
    if (!this.worker && !this.landmarker) {
      // 1st choice: a background worker (keeps tracking fast while the 3D scene renders)
      try { await this._startWorker(); }
      catch (err) {
        console.warn('Hand-tracking worker unavailable, using main thread:', err);
        this.worker?.terminate(); this.worker = null;
        const vision = await import(/* @vite-ignore */ `${VISION_URL}/vision_bundle.mjs`);
        const fileset = await vision.FilesetResolver.forVisionTasks(`${VISION_URL}/wasm`);
        const opts = d => ({ baseOptions: { modelAssetPath: MODEL_URL, delegate: d }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
        try { this.landmarker = await vision.HandLandmarker.createFromOptions(fileset, opts('GPU')); this.mode = 'main · GPU'; }
        catch { this.landmarker = await vision.HandLandmarker.createFromOptions(fileset, opts('CPU')); this.mode = 'main · CPU'; }
      }
    }
    this.running = true; this._busy = false; this._schedule();
  }
  _startWorker() {
    return new Promise((resolve, reject) => {
      if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') return reject(new Error('no worker support'));
      const w = new Worker(new URL('./handWorker.js', import.meta.url));
      const to = setTimeout(() => reject(new Error('worker init timeout')), 20000);
      w.onmessage = e => {
        const d = e.data;
        if (d.type === 'ready') { clearTimeout(to); this.worker = w; this.mode = 'worker · ' + d.delegate; resolve(); }
        else if (d.type === 'error') { clearTimeout(to); w.terminate(); reject(new Error(d.message)); }
        else if (d.type === 'result') { this._busy = false; if (this.running) this._process(d, performance.now()); }
        else if (d.type === 'detReady') { this.objects = true; this.detMode = d.delegate; this._detRes?.(); }
        else if (d.type === 'detError') { this._detRej?.(new Error(d.message)); }
      };
      w.onerror = e => { clearTimeout(to); reject(new Error(e.message || 'worker error')); };
      w.postMessage({ type: 'init', url: VISION_URL, model: MODEL_URL });
    });
  }
  // load the everyday-object detector (used by Mirror Mode) — once, on demand
  async enableObjects() {
    if (this.objects) return;
    if (this.worker) {
      await new Promise((res, rej) => { this._detRes = res; this._detRej = rej; this.worker.postMessage({ type: 'initDetector', model: DET_URL, allow: MIRROR_OBJECTS }); });
    } else {
      const vision = await import(/* @vite-ignore */ `${VISION_URL}/vision_bundle.mjs`);
      const fileset = await vision.FilesetResolver.forVisionTasks(`${VISION_URL}/wasm`);
      const opts = d => ({ baseOptions: { modelAssetPath: DET_URL, delegate: d }, runningMode: 'VIDEO', scoreThreshold: 0.3, maxResults: 4, categoryAllowlist: MIRROR_OBJECTS });
      try { this.detector = await vision.ObjectDetector.createFromOptions(fileset, opts('GPU')); this.detMode = 'GPU'; }
      catch { this.detector = await vision.ObjectDetector.createFromOptions(fileset, opts('CPU')); this.detMode = 'CPU'; }
      this.objects = true;
    }
  }
  stop() {
    this.running = false;
    this.video.srcObject?.getTracks().forEach(t => t.stop()); this.video.srcObject = null;
    this.ctx?.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }
  _schedule() {
    if (!this.running) return;
    if (this.video.requestVideoFrameCallback) this.video.requestVideoFrameCallback(() => { this._tick(); this._schedule(); });
    else requestAnimationFrame(() => { this._tick(); this._schedule(); });
  }
  _hint(kind, msg, every = 8000) { const now = performance.now(); if (now - (this._lastHintAt[kind] || 0) > every) { this._lastHintAt[kind] = now; this.onHint(kind, msg); } }
  async _tick() {
    const v = this.video;
    const now = performance.now();
    if (v.readyState < 2 || (this._busy && now - (this._sentAt || 0) < 1500)) return;   // one frame in flight at a time (+ watchdog)
    if (now - this._lastLight > 2000) this._checkLight(now);
    if (this.worker) {
      this._busy = true; this._sentAt = now;
      try { const frame = await createImageBitmap(v); this.worker.postMessage({ type: 'frame', frame, ts: now, detect: !!(this.objects && this.wantObjects) }, [frame]); }
      catch { this._busy = false; }
      this._sentAt = now;
    } else if (this.landmarker) {
      let res; try { res = this.landmarker.detectForVideo(v, now); } catch { return; }
      if (this.detector && this.wantObjects) {
        try { const r = this.detector.detectForVideo(v, now + 0.01), W = v.videoWidth, H = v.videoHeight;
          res = { ...res, objects: (r.detections || []).filter(o => o.boundingBox).map(o => ({ label: o.categories[0].categoryName, score: o.categories[0].score, x: o.boundingBox.originX / W, y: o.boundingBox.originY / H, w: o.boundingBox.width / W, h: o.boundingBox.height / H })) };
        } catch {}
      }
      this._process(res, now);
    }
  }
  _checkLight(now) {
    this._lastLight = now;
    try {
      const c = this._lightCv.getContext('2d', { willReadFrequently: true }); c.drawImage(this.video, 0, 0, 32, 24);
      const d = c.getImageData(0, 0, 32, 24).data; let L = 0; for (let i = 0; i < d.length; i += 4) L += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      this.light = L / (d.length / 4) / 255;
      if (this.light < 0.18) this._hint('dark', '💡 It\'s quite dark — turn on a light or face a window for better tracking');
    } catch {}
  }
  _process(res, now) {
    this._fc++; if (now - this._fpsT > 1000) { this.fps = this._fc; this._fc = 0; this._fpsT = now; }
    const raw = (res.landmarks || []).map((lm, i) => ({ lm, side: res.handednesses?.[i]?.[0]?.categoryName || (i ? 'Left' : 'Right') }));
    if (raw.length === 2 && raw[0].side === raw[1].side) raw[1].side = raw[0].side === 'Left' ? 'Right' : 'Left';
    const hands = raw.map(h => {
      const slot = this.slots[h.side];
      const c = classify(h.lm, this.sensitivity, slot.pose, this.calib);
      // time-based voting over the last ~200 ms: a pose must dominate before it counts (works at any FPS)
      if (slot.hist.length && now < slot.hist[slot.hist.length - 1].t) slot.hist = [];   // clock jumped back (tab switch etc.)
      slot.hist.push({ t: now, p: c.pose }); while (slot.hist.length > 2 && now - slot.hist[0].t > 200) slot.hist.shift();
      const tally = {}; slot.hist.forEach(e => tally[e.p] = (tally[e.p] || 0) + 1);
      const [top, cnt] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
      const agree = cnt / slot.hist.length;
      if (!slot.pose || (top !== slot.pose && agree >= 0.6)) { slot.pose = top; slot.since = now; }
      const F = slot.f;
      const tip = { x: F.tx.f(c.tip.x, now), y: F.ty.f(c.tip.y, now) }, palm = { x: F.px.f(c.palm.x, now), y: F.py.f(c.palm.y, now) };
      const pinchPt = { x: F.qx.f(c.pinchPt.x, now), y: F.qy.f(c.pinchPt.y, now) }, size = F.sz.f(c.size, now);
      slot.moves.push({ t: now, x: palm.x, y: palm.y }); while (slot.moves.length && now - slot.moves[0].t > 320) slot.moves.shift();
      this._latest = c;
      return { ...c, raw: c.pose, pose: slot.pose, holdMs: now - slot.since, agree, tip, palm, pinchPt, size, lm: h.lm, side: h.side, slot };
    });
    for (const side of ['Left', 'Right']) if (!hands.some(h => h.side === side)) { const s = this.slots[side]; s.hist = []; s.pose = null; s.moves = []; Object.values(s.f).forEach(f => f.x = null); }

    let snap = false, swipe = null;
    const h0 = hands[0];
    if (h0) {
      if (h0.snapD < h0.S.snap && !h0.ext[0]) this._snapArm = now;
      else if (now - this._snapArm < 400 && h0.snapD > 0.55 && h0.middleCurled && now - this._lastSnap > 1200) { snap = true; this._lastSnap = now; this._snapArm = 0; }
      const M = h0.slot.moves;
      if (hands.length === 1 && (h0.pose === 'open' || h0.pose === 'partial') && M.length > 2 && now - this._lastSwipe > 900) {
        const dx = M[M.length - 1].x - M[0].x, dy = M[M.length - 1].y - M[0].y;
        if (Math.abs(dx) > 0.26 && Math.abs(dx) > Math.abs(dy) * 2.2) { swipe = dx < 0 ? 'right' : 'left'; this._lastSwipe = now; M.length = 0; }
      }
      if (h0.size < 0.07) this._hint('far', '🖐 Move your hand a little closer to the camera', 10000);
      else if (h0.size > 0.42) this._hint('close', '🖐 Move your hand a little further from the camera', 10000);
      this._noHandSince = now;
    } else if (now - this._noHandSince > 12000) this._hint('nohand', '👋 Raise your hand in front of the camera — snap 🫰 or make a fist ✊ to start', 20000);

    this._draw(hands);
    this.onFrame({ hands, snap, swipe, t: now, objects: res.objects || [] });
  }
  _draw(hands) {
    const c = this.ctx; if (!c) return;
    const W = this.overlay.width = this.overlay.clientWidth * 2 || 320, H = this.overlay.height = this.overlay.clientHeight * 2 || 240;
    c.clearRect(0, 0, W, H);
    hands.forEach(h => {
      c.strokeStyle = h.side === 'Left' ? '#ff4fd8' : '#00f0ff'; c.lineWidth = 3; c.fillStyle = '#fff';
      for (const [a, b] of CONNECTIONS) { c.beginPath(); c.moveTo((1 - h.lm[a].x) * W, h.lm[a].y * H); c.lineTo((1 - h.lm[b].x) * W, h.lm[b].y * H); c.stroke(); }
      for (const p of h.lm) { c.beginPath(); c.arc((1 - p.x) * W, p.y * H, 3, 0, 7); c.fill(); }
      c.font = '600 26px system-ui'; c.fillText(POSES[h.pose] || '', (1 - h.lm[0].x) * W - 14, h.lm[0].y * H + 34);
    });
  }
  // ---------- calibration: record your open hand, fist and pinch, set thresholds just for you ----------
  async calibrate() {
    const out = [];
    const end = performance.now() + 1400;
    while (performance.now() < end) {
      await new Promise(r => setTimeout(r, 60));
      const c = this._latest; this._latest = null; if (!c) continue;
      out.push({ ratio: c.ratios.reduce((a, b) => a + b) / 4, pinchD: c.pinchD });
    }
    if (out.length < 4) return null;
    const med = k => { const v = out.map(o => o[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
    return { ratio: med('ratio'), pinchD: med('pinchD') };
  }
}
