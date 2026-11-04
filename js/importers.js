// BlaiseVR — turn anything into a particle model: .json, .glb/.gltf, .obj, .stl, images and typed text.
import * as THREE from 'three';
import { MAX_PARTS } from './sampler.js';

const PALETTE = ['#00e5ff', '#ff4fd8', '#ffd23f', '#44ff99', '#ff7a3d', '#9b7bff', '#ff3b5c', '#66aaff', '#c6ff4d', '#ffffff', '#ff9ecf', '#33ffd6'];

// ---------- JSON (BlaiseVR / TakeApart-style simple format) ----------
export function fromJSON(text, fileName = 'model.json') {
  const def = JSON.parse(text);
  if (!Array.isArray(def.parts) || !def.parts.length) throw new Error('JSON needs a "parts" array. See docs/MODELS.md');
  def.id = def.id || 'custom-' + fileName.replace(/\W+/g, '-').toLowerCase();
  def.name = def.name || fileName.replace(/\.json$/i, '');
  def.emoji = def.emoji || '✨'; def.category = def.category || 'Custom';
  def.parts.forEach((p, i) => {
    if (!Array.isArray(p.shapes)) throw new Error(`Part ${i + 1} ("${p.name || '?'}") needs a "shapes" array`);
    p.color = p.color || PALETTE[i % PALETTE.length];
  });
  return def;
}

// ---------- 3D files ----------
function meshArea(geo) {
  const pos = geo.attributes.position, idx = geo.index; let a = 0;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  const tri = idx ? idx.count / 3 : pos.count / 3;
  const step = Math.max(1, Math.floor(tri / 4000));
  for (let t = 0; t < tri; t += step) {
    const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    A.fromBufferAttribute(pos, i0); B.fromBufferAttribute(pos, i1); C.fromBufferAttribute(pos, i2);
    a += B.sub(A).cross(C.sub(A)).length() * 0.5 * step;
  }
  return a;
}
function meshesToDef(root, name) {
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse(o => { if (o.isMesh && o.geometry?.attributes?.position) meshes.push(o); });
  if (!meshes.length) throw new Error('No meshes found in that file');
  // world-space area per mesh
  const items = meshes.map(m => {
    const s = new THREE.Vector3(); m.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
    return { m, area: meshArea(m.geometry) * Math.abs(s.x * s.y + s.y * s.z + s.x * s.z) / 3 };
  }).sort((a, b) => b.area - a.area);
  let groups = items.slice(0, MAX_PARTS - 1).map(it => [it]);
  if (items.length > MAX_PARTS - 1) groups.push(items.slice(MAX_PARTS - 1));
  const total = items.reduce((a, b) => a + b.area, 0) || 1;
  return import('three/addons/math/MeshSurfaceSampler.js').then(({ MeshSurfaceSampler }) => {
    const v = new THREE.Vector3(), nv = new THREE.Vector3(), nm = new THREE.Matrix3();
    const parts = groups.map((g, gi) => {
      const data = [];
      g.forEach(({ m, area }) => {
        const n = Math.max(150, Math.round(36000 * area / total));
        const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
        const sampler = new MeshSurfaceSampler(new THREE.Mesh(geo)).build();
        nm.getNormalMatrix(m.matrixWorld);
        for (let i = 0; i < n; i++) { sampler.sample(v, nv); v.applyMatrix4(m.matrixWorld); nv.applyMatrix3(nm).normalize(); data.push([v.x, v.y, v.z, -1, 0, 0, nv.x, nv.y, nv.z]); }
      });
      const m0 = g[0].m, mat = Array.isArray(m0.material) ? m0.material[0] : m0.material;
      let color = PALETTE[gi % PALETTE.length];
      if (mat?.color) { const c = mat.color.clone(); const hsl = {}; c.getHSL(hsl); if (hsl.s > 0.15 && hsl.l > 0.12) { c.setHSL(hsl.h, Math.max(0.6, hsl.s), Math.min(0.65, Math.max(0.45, hsl.l))); color = '#' + c.getHexString(); } }
      const label = g.length > 1 ? `Other parts (${g.length})` : (m0.name || m0.parent?.name || `Part ${gi + 1}`).replace(/[_\-.]+/g, ' ').trim();
      return { name: label || `Part ${gi + 1}`, color, mat: mat?.metalness > 0.5 ? 'metal' : 'plastic', shapes: [{ t: 'pts', data }], desc: `Mesh "${label}" from your file.` };
    });
    return { id: 'file-' + name.replace(/\W+/g, '-').toLowerCase(), name: name.replace(/\.\w+$/, ''), emoji: '📦', category: 'Imported', about: `Imported from ${name}. Each mesh in the file became a part you can explode, select and pull out.`, parts };
  });
}
export async function from3DFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const buf = await file.arrayBuffer();
  if (ext === 'glb' || ext === 'gltf') {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
    return meshesToDef(gltf.scene, file.name);
  }
  if (ext === 'obj') {
    const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
    return meshesToDef(new OBJLoader().parse(new TextDecoder().decode(buf)), file.name);
  }
  if (ext === 'stl') {
    const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
    const geo = new STLLoader().parse(buf); const g = new THREE.Group(); const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial()); m.name = file.name.replace(/\.\w+$/, ''); g.add(m);
    return meshesToDef(g, file.name);
  }
  throw new Error('Unsupported 3D format: .' + ext);
}

// ---------- images → 3D relief, parts = colour groups (k-means) ----------
export async function fromImage(file) {
  const url = URL.createObjectURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const maxD = 260, k = Math.min(1, maxD / Math.max(img.width, img.height));
  const W = Math.round(img.width * k), H = Math.round(img.height * k);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, W, H); URL.revokeObjectURL(url);
  const px = cx.getImageData(0, 0, W, H).data;
  const pts = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; if (px[i + 3] < 128) continue;
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255, lum = 0.299 * r + 0.587 * g + 0.114 * b;
    pts.push([(x - W / 2) / maxD * 4, -(y - H / 2) / maxD * 4, lum * 0.6, r, g, b]);
  }
  // k-means on colour
  const K = 6; let cents = Array.from({ length: K }, () => pts[Math.floor(Math.random() * pts.length)].slice(3));
  const assign = new Int16Array(pts.length);
  for (let it = 0; it < 8; it++) {
    for (let i = 0; i < pts.length; i += 1) { let best = 0, bd = 1e9; for (let c = 0; c < K; c++) { const d = (pts[i][3] - cents[c][0]) ** 2 + (pts[i][4] - cents[c][1]) ** 2 + (pts[i][5] - cents[c][2]) ** 2; if (d < bd) { bd = d; best = c; } } assign[i] = best; }
    const acc = Array.from({ length: K }, () => [0, 0, 0, 0]);
    pts.forEach((p, i) => { const a = acc[assign[i]]; a[0] += p[3]; a[1] += p[4]; a[2] += p[5]; a[3]++; });
    cents = acc.map((a, c) => a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : cents[c]);
  }
  const groups = Array.from({ length: K }, () => []);
  pts.forEach((p, i) => groups[assign[i]].push(p));
  const hex = c => '#' + c.map(v => Math.round(Math.min(1, v) * 255).toString(16).padStart(2, '0')).join('');
  const parts = groups.filter(g => g.length > 30).map((g, i) => {
    const c = cents[assign[pts.indexOf(g[0])]];
    return { name: `Colour layer ${i + 1}`, color: hex(c), shapes: [{ t: 'pts', data: g, j: 0.008 }], ex: [0, 0, (i - 2.5) * 0.6], desc: `All the pixels close to ${hex(c)}. Explode to separate the image into colour layers floating in depth.` };
  });
  return { id: 'img-' + file.name.replace(/\W+/g, '-'), name: file.name.replace(/\.\w+$/, ''), emoji: '🖼️', category: 'Imported', about: 'Your image turned into a 3D relief: brighter pixels float forward. Each colour group is a separate part.', explode: 1, parts };
}

// ---------- text → particles, one part per character ----------
export function fromText(text) {
  text = (text || 'BlaiseVR').slice(0, 40);
  const lines = text.split(/\\n|\n/).slice(0, 3);
  const fs = 110, font = `900 ${fs}px "Space Grotesk", system-ui, sans-serif`;
  const cv = document.createElement('canvas'); const cx = cv.getContext('2d', { willReadFrequently: true }); cx.font = font;
  const W = Math.ceil(Math.max(...lines.map(l => cx.measureText(l).width))) + 20, LH = fs * 1.1, H = Math.ceil(LH * lines.length) + 20;
  cv.width = W; cv.height = H;
  const chars = []; // {line, x0, x1, ch}
  lines.forEach((l, li) => { let x = 10; for (const ch of l) { const w = cx.measureText(ch).width; if (ch.trim()) chars.push({ li, x0: x, x1: x + w, ch }); x += w; } });
  const use = chars.slice(0, MAX_PARTS);
  const parts = use.map((c, i) => ({ name: `"${c.ch}"`, color: `hsl(${(i * 360 / use.length) | 0},95%,60%)`, data: [], desc: `The letter "${c.ch}" — position ${i + 1} of your text.` }));
  const scale = 4.4 / Math.max(W, H * 1.2);
  use.forEach((c, i) => {
    cx.clearRect(0, 0, W, H); cx.font = font; cx.fillStyle = '#fff'; cx.textBaseline = 'top';
    cx.fillText(c.ch, c.x0, 10 + c.li * LH);
    const x0 = Math.max(0, Math.floor(c.x0) - 4), x1 = Math.min(W, Math.ceil(c.x1) + 4);
    const d = cx.getImageData(x0, 0, x1 - x0, H).data;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < x1 - x0; x += 2) {
      if (d[(y * (x1 - x0) + x) * 4 + 3] > 128) for (const z of [-0.12, 0.12]) parts[i].data.push([(x + x0 - W / 2) * scale, -(y - H / 2) * scale, z, -1, 0, 0, 0, 0, Math.sign(z)]);
    }
  });
  // hsl -> hex for the colour parser
  const tmpC = new THREE.Color();
  return {
    id: 'text-' + text.replace(/\W+/g, '-').toLowerCase(), name: `Text: ${text.replace(/\n/g, ' ')}`, emoji: '🔤', category: 'Text', about: 'Your words, built from particles. Every letter is its own part — open your hand to scatter them.',
    parts: parts.filter(p => p.data.length).map((p, i) => ({ name: p.name, color: '#' + tmpC.setStyle(p.color).getHexString(), mat: 'plastic', desc: p.desc, shapes: [{ t: 'pts', data: p.data, j: 0.004 }], anim: { type: 'bob', axis: [0, 1, 0], amp: 0.06, freq: 0.5, phase: i * 0.5 } })),
  };
}
