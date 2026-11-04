// BlaiseVR — shape sampler & model builder
// Turns a model definition (parts made of simple shapes) into particle buffers.
import * as THREE from 'three';

export const MAX_PARTS = 24;
export const TARGET_RADIUS = 2.2;
const D2R = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

// ---------- helpers ----------
export function rng(seed = 1) { // mulberry32
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = Math.random;
function gauss() { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function randDir(out) {
  const z = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - z * z);
  return out.set(s * Math.cos(a), z, s * Math.sin(a));
}
const vec = (a, d = 0) => new THREE.Vector3(a?.[0] ?? d, a?.[1] ?? d, a?.[2] ?? d);

function shapeQuat(s) {
  const q = new THREE.Quaternion();
  if (s.axis) {
    let ax;
    if (s.axis === 'x') ax = new THREE.Vector3(1, 0, 0);
    else if (s.axis === 'z') ax = new THREE.Vector3(0, 0, 1);
    else if (s.axis === 'y') ax = UP.clone();
    else ax = vec(s.axis).normalize();
    q.setFromUnitVectors(UP, ax);
  }
  if (s.rot) {
    const e = new THREE.Euler(s.rot[0] * D2R, s.rot[1] * D2R, s.rot[2] * D2R);
    q.premultiply(new THREE.Quaternion().setFromEuler(e));
  }
  return q;
}

// ---------- area estimates (decide how many particles each shape gets) ----------
function area(s) {
  const r = s.r ?? 0.5;
  switch (s.t) {
    case 'sphere': return 4 * Math.PI * r * r;
    case 'ellipsoid': {
      const [a, b, c] = Array.isArray(s.r) ? s.r : [r, r, r]; const p = 1.6;
      return 4 * Math.PI * Math.pow((Math.pow(a * b, p) + Math.pow(a * c, p) + Math.pow(b * c, p)) / 3, 1 / p);
    }
    case 'box': { const [w, h, d] = s.s ?? [1, 1, 1]; return 2 * (w * h + w * d + h * d); }
    case 'cyl': {
      const r1 = r, r2 = s.r2 ?? r, h = s.h ?? 1;
      const side = Math.PI * (r1 + r2) * Math.sqrt(h * h + (r1 - r2) ** 2);
      return side + (s.open ? 0 : Math.PI * (r1 * r1 + r2 * r2));
    }
    case 'torus': return 4 * Math.PI * Math.PI * (s.R ?? 1) * r * (s.arc ?? 1);
    case 'disk': return Math.PI * (r * r - (s.r0 ?? 0) ** 2);
    case 'tube': {
      const c = new THREE.CatmullRomCurve3(s.pts.map(p => vec(p)), !!s.closed);
      return c.getLength() * 2 * Math.PI * r;
    }
    case 'helix': {
      const turns = s.turns ?? 3, h = s.h ?? 4, Rr = s.R ?? 1;
      return turns * Math.hypot(2 * Math.PI * Rr, h / turns) * 2 * Math.PI * r;
    }
    case 'pts': return Math.max(0.05, (s.data?.length ?? 0) * 0.002);
    default: return 0.1;
  }
}
export function shapeWeight(s) { return Math.max(0.002, area(s) * (s.d ?? 1)); }

// ---------- sampling one shape: pushes n points into arr (local -> world) ----------
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();
export function sampleShape(s, n, push) {
  const q = shapeQuat(s), c = vec(s.c), jit = s.j ?? 0;
  const r = s.r ?? 0.5;
  const emit = (x, y, z, rgb) => {
    tmp.set(x, y, z).applyQuaternion(q).add(c);
    if (jit) tmp.x += gauss() * jit, tmp.y += gauss() * jit, tmp.z += gauss() * jit;
    push(tmp.x, tmp.y, tmp.z, rgb);
  };
  let tries = 0;
  for (let i = 0; i < n; i++) {
    switch (s.t) {
      case 'sphere': {
        randDir(tmp2);
        if (s.mask && tries < n * 30) { tries++; if (!s.mask(tmp2.x, tmp2.y, tmp2.z)) { i--; continue; } }
        let rr = r;
        if (s.v) { const r0 = s.r0 ?? 0; rr = Math.cbrt(R() * (r ** 3 - r0 ** 3) + r0 ** 3); }
        emit(tmp2.x * rr, tmp2.y * rr, tmp2.z * rr); break;
      }
      case 'ellipsoid': {
        const [a, b, cc] = Array.isArray(s.r) ? s.r : [r, r, r];
        randDir(tmp2); const k = s.v ? Math.cbrt(R()) : 1;
        emit(tmp2.x * a * k, tmp2.y * b * k, tmp2.z * cc * k); break;
      }
      case 'box': {
        const [w, h, d] = s.s ?? [1, 1, 1];
        if (s.v) { emit((R() - .5) * w, (R() - .5) * h, (R() - .5) * d); break; }
        const A = [w * h, w * h, w * d, w * d, h * d, h * d], tot = A.reduce((x, y) => x + y);
        let u = R() * tot, f = 0; while (u > A[f]) u -= A[f++];
        const a = R() - .5, b = R() - .5, sg = f % 2 ? .5 : -.5;
        if (f < 2) emit(a * w, b * h, sg * d);
        else if (f < 4) emit(a * w, sg * h, b * d);
        else emit(sg * w, a * h, b * d);
        break;
      }
      case 'cyl': {
        const r1 = r, r2 = s.r2 ?? r, h = s.h ?? 1, th = R() * Math.PI * 2;
        if (s.v) { const u = R(); const rr = (r1 + (r2 - r1) * u) * Math.sqrt(R()); emit(rr * Math.cos(th), (u - .5) * h, rr * Math.sin(th)); break; }
        const side = Math.PI * (r1 + r2) * Math.sqrt(h * h + (r1 - r2) ** 2);
        const caps = s.open ? 0 : Math.PI * (r1 * r1 + r2 * r2);
        const u = R() * (side + caps);
        if (u < side) { const t = R(); const rr = r1 + (r2 - r1) * t; emit(rr * Math.cos(th), (t - .5) * h, rr * Math.sin(th)); }
        else {
          const top = (u - side) > Math.PI * r1 * r1; const rr = (top ? r2 : r1) * Math.sqrt(R());
          emit(rr * Math.cos(th), top ? h / 2 : -h / 2, rr * Math.sin(th));
        }
        break;
      }
      case 'torus': {
        const RR = s.R ?? 1, th = R() * Math.PI * 2 * (s.arc ?? 1) + (s.start ?? 0) * D2R, ph = R() * Math.PI * 2;
        const rr = RR + r * Math.cos(ph);
        emit(rr * Math.cos(th), r * Math.sin(ph), rr * Math.sin(th)); break;
      }
      case 'disk': {
        const r0 = s.r0 ?? 0, th = R() * Math.PI * 2;
        const rr = Math.sqrt(R() * (r * r - r0 * r0) + r0 * r0);
        emit(rr * Math.cos(th), 0, rr * Math.sin(th)); break;
      }
      case 'tube': {
        if (!s._curve) s._curve = new THREE.CatmullRomCurve3(s.pts.map(p => vec(p)), !!s.closed);
        const t = R(); s._curve.getPointAt(t, tmp2); s._curve.getTangentAt(t, tmp3);
        tubeOffset(tmp2, tmp3, r, emit); break;
      }
      case 'helix': {
        const turns = s.turns ?? 3, h = s.h ?? 4, RR = s.R ?? 1, ph0 = s.phase ?? 0;
        const t = R(), a = ph0 + t * turns * Math.PI * 2;
        tmp2.set(RR * Math.cos(a), (t - .5) * h, RR * Math.sin(a));
        tmp3.set(-RR * Math.sin(a) * turns * Math.PI * 2, h, RR * Math.cos(a) * turns * Math.PI * 2).normalize();
        tubeOffset(tmp2, tmp3, r, emit); break;
      }
      case 'pts': {
        const d = s.data; if (!d?.length) { emit(0, 0, 0); break; }
        const p = d[i < d.length && n <= d.length ? Math.floor(i * d.length / n) : Math.floor(R() * d.length)];
        const jj = n > d.length ? (s.j ?? 0.01) : 0;
        emit(p[0] + gauss() * jj, p[1] + gauss() * jj, p[2] + gauss() * jj, p.length >= 6 ? p : null); break;
      }
      default: emit(0, 0, 0);
    }
  }
}
const nrm = new THREE.Vector3(), bin = new THREE.Vector3();
function tubeOffset(p, t, r, emit) {
  nrm.crossVectors(t, Math.abs(t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP).normalize();
  bin.crossVectors(t, nrm).normalize();
  const ph = R() * Math.PI * 2, cr = Math.cos(ph) * r, sr = Math.sin(ph) * r;
  emit(p.x + nrm.x * cr + bin.x * sr, p.y + nrm.y * cr + bin.y * sr, p.z + nrm.z * cr + bin.z * sr);
}

// ---------- build a whole model ----------
export function buildModel(def, N) {
  const parts = (def.parts || []).filter(p => p && (p.shapes?.length)).slice(0, MAX_PARTS);
  if (!parts.length) throw new Error('Model has no parts with shapes');
  const weights = parts.map(p => p.shapes.reduce((a, s) => a + shapeWeight(s), 0) * (p.d ?? 1));
  const totalW = weights.reduce((a, b) => a + b, 0);
  const minPer = Math.min(500, Math.floor(N / parts.length / 3));
  let counts = weights.map(w => Math.max(minPer, Math.floor(N * w / totalW)));
  // fix totals to exactly N
  let sum = counts.reduce((a, b) => a + b, 0);
  while (sum !== N) {
    const big = counts.indexOf(Math.max(...counts));
    const diff = N - sum; const step = Math.sign(diff) * Math.min(Math.abs(diff), Math.max(1, Math.floor(counts[big] * 0.5)));
    counts[big] += step; sum += step;
  }

  const pos = new Float32Array(N * 3), part = new Float32Array(N), col = new Float32Array(N * 3);
  let k = 0;
  const color = new THREE.Color(), c2 = new THREE.Color();
  parts.forEach((p, pi) => {
    const sw = p.shapes.map(shapeWeight), st = sw.reduce((a, b) => a + b, 0);
    let left = counts[pi];
    p.shapes.forEach((s, si) => {
      const n = si === p.shapes.length - 1 ? left : Math.max(1, Math.round(counts[pi] * sw[si] / st));
      left -= n;
      color.set(s.color || p.color || '#66ddff');
      sampleShape(s, Math.max(0, n), (x, y, z, rgb) => {
        if (k >= N) return;
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; part[k] = pi;
        const b = rgb ? 1 : 0.72 + Math.random() * 0.45;
        if (rgb) c2.setRGB(rgb[3], rgb[4], rgb[5]); else c2.copy(color).multiplyScalar(b);
        col[k * 3] = c2.r; col[k * 3 + 1] = c2.g; col[k * 3 + 2] = c2.b; k++;
      });
    });
  });
  // pad any shortfall by duplicating random points
  for (; k < N; k++) {
    const j = Math.floor(Math.random() * Math.max(1, k));
    pos.copyWithin(k * 3, j * 3, j * 3 + 3); col.copyWithin(k * 3, j * 3, j * 3 + 3); part[k] = part[j];
  }

  // normalise: centre on bounding box, scale to TARGET_RADIUS
  const box = new THREE.Box3();
  for (let i = 0; i < N; i++) box.expandByPoint(tmp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
  const center = box.getCenter(new THREE.Vector3());
  let maxR = 0;
  for (let i = 0; i < N; i++) maxR = Math.max(maxR, tmp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).sub(center).length());
  const scale = TARGET_RADIUS / (maxR || 1);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (pos[i * 3] - center.x) * scale;
    pos[i * 3 + 1] = (pos[i * 3 + 1] - center.y) * scale;
    pos[i * 3 + 2] = (pos[i * 3 + 2] - center.z) * scale;
  }
  const xf = v => vec(v).sub(center).multiplyScalar(scale);

  // per-part centroid, explode offset, anims
  const cent = parts.map(() => new THREE.Vector3()), cnt = new Array(parts.length).fill(0);
  for (let i = 0; i < N; i++) { const pi = part[i]; cent[pi].x += pos[i * 3]; cent[pi].y += pos[i * 3 + 1]; cent[pi].z += pos[i * 3 + 2]; cnt[pi]++; }
  cent.forEach((c, i) => c.divideScalar(cnt[i] || 1));
  const explodeK = def.explode ?? 1;
  const meta = parts.map((p, i) => {
    let ex;
    if (p.ex) ex = vec(p.ex).multiplyScalar(explodeK);
    else {
      const c = cent[i].clone(), L = c.length();
      ex = L < 0.12 ? new THREE.Vector3() : c.multiplyScalar(0.6).add(c.clone().normalize().multiplyScalar(0.45)).multiplyScalar(explodeK);
    }
    const anims = (Array.isArray(p.anim) ? p.anim : p.anim ? [p.anim] : []).map(a => ({
      type: a.type, axis: vec(a.axis || [0, 1, 0]).normalize(), speed: a.speed ?? 1,
      amp: a.type === 'bob' ? (a.amp ?? 0.1) * scale : (a.amp ?? 0.05), freq: a.freq ?? 1, phase: a.phase ?? 0,
    }));
    const pivot = p.pivot ? xf(p.pivot) : (p.anim && (Array.isArray(p.anim) ? p.anim[0] : p.anim).pivot ? xf((Array.isArray(p.anim) ? p.anim[0] : p.anim).pivot) : cent[i].clone());
    return {
      name: p.name || `Part ${i + 1}`, desc: p.desc || '', fact: p.fact || '', color: p.color || '#66ddff',
      centroid: cent[i], explode: ex, pivot, anims, count: cnt[i],
    };
  });

  // auto-exposure: thin/small models pack particles densely and would blow out in additive mode
  const allPts = parts.every(p => p.shapes.every(s => s.t === 'pts'));
  const gain = allPts ? 0.8 : Math.min(1.1, Math.max(0.45, Math.pow(totalW * scale * scale / 45, 0.4)));
  return { def, N, positions: pos, part, colors: col, parts: meta, scale, center, gain };
}

// scatter cloud used for the dissolved / idle state
export function makeScatter(N) {
  const a = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    randDir(tmp); const r = 3 + Math.pow(R(), 0.6) * 5;
    a[i * 3] = tmp.x * r * 1.3; a[i * 3 + 1] = tmp.y * r * 0.7; a[i * 3 + 2] = tmp.z * r;
  }
  return a;
}
