// BlaiseVR — webcam hand tracking (MediaPipe, runs 100% on-device) + gesture classifier.
const VISION_VER = '0.10.18';
const VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VER}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.5);
export const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

export const SENSITIVITY = {
  strict:   { ext: 1.55, pinch: 0.24, snap: 0.2 },
  standard: { ext: 1.45, pinch: 0.3, snap: 0.24 },
  forgiving:{ ext: 1.32, pinch: 0.38, snap: 0.3 },
};

// Classify one hand's 21 landmarks into a pose.
export function classify(lm, sensName = 'standard') {
  const S = SENSITIVITY[sensName] || SENSITIVITY.standard;
  const w = lm[0], size = dist(w, lm[9]) || 1e-3;
  const fingers = [[8, 5], [12, 9], [16, 13], [20, 17]];
  const ratios = fingers.map(([tip, mcp]) => dist(lm[tip], w) / (dist(lm[mcp], w) || 1e-3));
  const ext = ratios.map(r => r > S.ext);
  const openness = ratios.reduce((a, r) => a + Math.min(1, Math.max(0, (r - 1.05) / 0.75)), 0) / 4;
  const pinchD = dist(lm[4], lm[8]) / size;
  const snapD = dist(lm[4], lm[12]) / size;
  const thumbOut = dist(lm[4], lm[5]) / size > 0.75;
  const thumbUp = thumbOut && lm[4].y < lm[3].y && lm[3].y < lm[2].y && (lm[2].y - lm[4].y) / size > 0.45;
  const n = ext.filter(Boolean).length;

  let pose = 'partial';
  // pinch = thumb on index tip while the index is still reaching out (in a fist the index is curled into the palm)
  if (pinchD < S.pinch && ratios[0] > 1.2) pose = 'pinch';
  else if (n === 0) pose = thumbUp ? 'thumb' : 'fist';
  else if (ext[0] && !ext[1] && !ext[2] && !ext[3]) pose = 'point';
  else if (ext[0] && ext[1] && !ext[2] && !ext[3]) pose = 'victory';
  else if (n >= 4 || (n === 3 && sensName === 'forgiving')) pose = 'open';

  // hand roll (twist): angle of index-MCP -> pinky-MCP line, folded to [-90°, 90°]
  let roll = Math.atan2(lm[17].y - lm[5].y, lm[17].x - lm[5].x);
  if (roll > Math.PI / 2) roll -= Math.PI; if (roll < -Math.PI / 2) roll += Math.PI;
  const palm = { x: (lm[0].x + lm[5].x + lm[17].x) / 3, y: (lm[0].y + lm[5].y + lm[17].y) / 3 };
  return { pose, openness, pinchD, snapD, roll, palm, tip: lm[8], wrist: w, size, ext, middleCurled: dist(lm[12], w) < dist(lm[9], w) * 1.35, S };
}

export class HandTracker {
  constructor(video, overlay) {
    this.video = video; this.overlay = overlay; this.ctx = overlay?.getContext('2d');
    this.running = false; this.onFrame = () => {}; this.sensitivity = 'standard';
    this._lastT = -1; this._snapArm = 0; this._lastSnap = 0;
  }
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera access (needs HTTPS or localhost).');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
    this.video.srcObject = stream; await this.video.play();
    if (!this.landmarker) {
      const vision = await import(/* @vite-ignore */ `${VISION_URL}/vision_bundle.mjs`);
      const fileset = await vision.FilesetResolver.forVisionTasks(`${VISION_URL}/wasm`);
      const opts = d => ({ baseOptions: { modelAssetPath: MODEL_URL, delegate: d }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
      try { this.landmarker = await vision.HandLandmarker.createFromOptions(fileset, opts('GPU')); }
      catch { this.landmarker = await vision.HandLandmarker.createFromOptions(fileset, opts('CPU')); }
    }
    this.running = true; this._loop();
  }
  stop() {
    this.running = false;
    this.video.srcObject?.getTracks().forEach(t => t.stop()); this.video.srcObject = null;
    this.ctx?.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }
  _loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this._loop());
    const v = this.video;
    if (v.readyState < 2 || v.currentTime === this._lastT) return;
    this._lastT = v.currentTime;
    let res; try { res = this.landmarker.detectForVideo(v, performance.now()); } catch { return; }
    const hands = (res.landmarks || []).map((lm, i) => ({ lm, side: res.handednesses?.[i]?.[0]?.categoryName, ...classify(lm, this.sensitivity) }));
    // snap: thumb touches middle finger, then flicks apart with middle curling into palm
    const now = performance.now(); let snap = false;
    const h0 = hands[0];
    if (h0) {
      if (h0.snapD < h0.S.snap && !h0.ext[0]) this._snapArm = now;
      else if (now - this._snapArm < 380 && h0.snapD > 0.55 && h0.middleCurled && now - this._lastSnap > 1200) { snap = true; this._lastSnap = now; this._snapArm = 0; }
    }
    this._draw(hands);
    this.onFrame({ hands, snap, t: now });
  }
  _draw(hands) {
    const c = this.ctx; if (!c) return;
    const W = this.overlay.width = this.overlay.clientWidth * 2 || 320, H = this.overlay.height = this.overlay.clientHeight * 2 || 240;
    c.clearRect(0, 0, W, H);
    hands.forEach((h, k) => {
      c.strokeStyle = k ? '#ff4fd8' : '#00f0ff'; c.lineWidth = 3; c.fillStyle = '#fff';
      for (const [a, b] of CONNECTIONS) { c.beginPath(); c.moveTo((1 - h.lm[a].x) * W, h.lm[a].y * H); c.lineTo((1 - h.lm[b].x) * W, h.lm[b].y * H); c.stroke(); }
      for (const p of h.lm) { c.beginPath(); c.arc((1 - p.x) * W, p.y * H, 3, 0, 7); c.fill(); }
    });
  }
}
