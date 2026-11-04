// BlaiseVR — hand tracking in a Web Worker, so heavy 3D rendering can never slow the camera down.
// Classic (non-module) worker on purpose: MediaPipe loads its WASM with importScripts(), which module workers lack.
let landmarker = null, detector = null, visionMod = null, filesetRef = null;
self.onmessage = async (e) => {
  const d = e.data;
  if (d.type === 'init') {
    try {
      const vision = visionMod = await import(d.url + '/vision_bundle.mjs');
      const fileset = filesetRef = await vision.FilesetResolver.forVisionTasks(d.url + '/wasm');
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
  if (d.type === 'initDetector') {
    // everyday-object detector (COCO: bottle, cup, phone, book, fruit…) for Mirror Mode
    try {
      const opts = delegate => ({ baseOptions: { modelAssetPath: d.model, delegate }, runningMode: 'VIDEO', scoreThreshold: 0.3, maxResults: 4, categoryAllowlist: d.allow });
      let delegate = 'GPU';
      try { detector = await visionMod.ObjectDetector.createFromOptions(filesetRef, opts('GPU')); }
      catch (err) { delegate = 'CPU'; detector = await visionMod.ObjectDetector.createFromOptions(filesetRef, opts('CPU')); }
      self.postMessage({ type: 'detReady', delegate });
    } catch (err) { self.postMessage({ type: 'detError', message: String((err && err.message) || err) }); }
    return;
  }
  if (d.type === 'frame') {
    const out = { type: 'result', ts: d.ts, landmarks: [], handednesses: [], objects: [] };
    try {
      if (landmarker) { const r = landmarker.detectForVideo(d.frame, d.ts); out.landmarks = r.landmarks || []; out.handednesses = r.handednesses || []; }
      if (detector && d.detect) {
        const W = d.frame.width, H = d.frame.height, r = detector.detectForVideo(d.frame, d.ts);
        out.objects = (r.detections || []).filter(o => o.boundingBox).map(o => ({ label: o.categories[0].categoryName, score: o.categories[0].score,
          x: o.boundingBox.originX / W, y: o.boundingBox.originY / H, w: o.boundingBox.width / W, h: o.boundingBox.height / H }));
      }
    } catch (err) { out.error = String((err && err.message) || err); }
    try { d.frame.close(); } catch (_) {}
    self.postMessage(out);
  }
};
