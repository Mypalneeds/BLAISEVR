// BlaiseVR — hand tracking in a Web Worker, so heavy 3D rendering can never slow the camera down.
// Classic (non-module) worker on purpose: MediaPipe loads its WASM with importScripts(), which module workers lack.
let landmarker = null;
self.onmessage = async (e) => {
  const d = e.data;
  if (d.type === 'init') {
    try {
      const vision = await import(d.url + '/vision_bundle.mjs');
      const fileset = await vision.FilesetResolver.forVisionTasks(d.url + '/wasm');
      const opts = delegate => ({
        baseOptions: { modelAssetPath: d.model, delegate }, runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      let delegate = 'GPU';
      try { landmarker = await vision.HandLandmarker.createFromOptions(fileset, opts('GPU')); }
      catch (err) { delegate = 'CPU'; landmarker = await vision.HandLandmarker.createFromOptions(fileset, opts('CPU')); }
      self.postMessage({ type: 'ready', delegate });
    } catch (err) {
      self.postMessage({ type: 'error', message: String((err && err.message) || err) });
    }
    return;
  }
  if (d.type === 'frame') {
    const out = { type: 'result', ts: d.ts, landmarks: [], handednesses: [] };
    try {
      if (landmarker) { const r = landmarker.detectForVideo(d.frame, d.ts); out.landmarks = r.landmarks || []; out.handednesses = r.handednesses || []; }
    } catch (err) { out.error = String((err && err.message) || err); }
    try { d.frame.close(); } catch (_) {}
    self.postMessage(out);
  }
};
