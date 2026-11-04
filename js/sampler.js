// BlaiseVR — shape sampler & model builder.
// Turns a model definition (parts made of simple shapes) into particle buffers:
// position, surface normal (for lighting), flow coordinate (for moving pulses), material and colour.
import * as THREE from 'three';

export const MAX_PARTS = 24;
export const TARGET_RADIUS = 2.2;
export const MATERIALS = { matte: 0, metal: 1, organic: 2, glass: 3, glow: 4, plastic: 5, rubber: 6 };
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

// cheap smooth 3D noise (sum of warped sines) — good for organic bumps, rock, brain folds
export function noise3(x, y, z) {
  const a = Math.sin(x * 1.7 + Math.sin(y * 2.3 + z * 1.1)) * Math.sin(y * 1.9 + Math.sin(z * 2.1 + x * 0.7)) * Math.sin(z * 1.3 + Math.sin(x * 2.7 + y * 0.9));
  const b = Math.sin(x * 3.9 + Math.sin(y * 4.3) + 1.7) * Math.sin(y * 4.1 + Math.sin(z * 3.7) + 0.4) * Math.sin(z * 4.7 + Math.sin(x * 3.1) + 2.2);
  return a * 0.7 + b * 0.3;
}

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
  if (s.rot) q.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(s.rot[0] * D2R, s.rot[1] * D2R, s.rot[2] * D2R)));
  return q;
}

function lathePrep(s) {
  if (s._lp) return s._lp;
  const p = s.pts.map(([r, y]) => [Math.max(0, r), y]); const seg = [];
  let L = 0, A = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const [r0, y0] = p[i], [r1, y1] = p[i + 1], len = Math.hypot(r1 - r0, y1 - y0);
    const area = Math.PI * (r0 + r1) * len * (s.arc ?? 1);
    seg.push({ r0, y0, r1, y1, len, area, L0: L }); L += len; A += area;
  }
  return (s._lp = { seg, L, A });
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
    case 'box': case 'rbox': { const [w, h, d] = s.s ?? [1, 1, 1]; return 2 * (w * h + w * d + h * d); }
    case 'cyl': {
      const r1 = r, r2 = s.r2 ?? r, h = s.h ?? 1;
      return (Math.PI * (r1 + r2) * Math.sqrt(h * h + (r1 - r2) ** 2) + (s.open ? 0 : Math.PI * (r1 * r1 + r2 * r2))) * (s.arc ?? 1);
    }
    case 'capsule': { const h = s.h ?? 1; return 2 * Math.PI * r * h + 4 * Math.PI * r * r; }
    case 'torus': return 4 * Math.PI * Math.PI * (s.R ?? 1) * r * (s.arc ?? 1);
    case 'disk': return Math.PI * (r * r - (s.r0 ?? 0) ** 2) * (s.arc ?? 1);
    case 'lathe': return lathePrep(s).A;
    case 'tube': return new THREE.CatmullRomCurve3(s.pts.map(p => vec(p)), !!s.closed).getLength() * 2 * Math.PI * r;
    case 'helix': { const turns = s.turns ?? 3, h = s.h ?? 4, RR = s.R ?? 1; return turns * Math.hypot(2 * Math.PI * RR, h / turns) * 2 * Math.PI * r; }
    case 'pts': return Math.max(0.05, (s.data?.length ?? 0) * 0.002);
    default: return 0.1;
  }
}
export function shapeWeight(s) { return Math.max(0.002, area(s) * (s.d ?? 1)); }

// ---------- sampling one shape ----------
// push(x,y,z, nx,ny,nz, flowT, rgb|null). A zero normal = volume point (unlit glow).
const P = new THREE.Vector3(), Nn = new THREE.Vector3(), T2 = new THREE.Vector3(), T3 = new THREE.Vector3();
export function sampleShape(s, n, push) {
  const q = shapeQuat(s), c = vec(s.c), jit = s.j ?? 0, r = s.r ?? 0.5;
  const amp = s.n ?? 0, nf = s.nf ?? 4, ridge = s.nt === 'ridge';
  const nz = (x, y, z) => { const v = noise3(x * nf, y * nf, z * nf); return ridge ? 1 - Math.abs(v) * 2 : v; };
  const emit = (x, y, z, nx, ny, nz2, ft = -1, rgb = null) => {
    P.set(x, y, z); Nn.set(nx, ny, nz2);
    if (amp && (nx || ny || nz2)) { // displace along normal & tilt the normal by the noise gradient
      const e = 0.02, h0 = nz(x, y, z);
      const gx = (nz(x + e, y, z) - h0) / e, gy = (nz(x, y + e, z) - h0) / e, gz = (nz(x, y, z + e) - h0) / e;
      P.addScaledVector(Nn, h0 * amp);
      Nn.x -= gx * amp * 0.9; Nn.y -= gy * amp * 0.9; Nn.z -= gz * amp * 0.9; Nn.normalize();
    }
    P.applyQuaternion(q).add(c); Nn.applyQuaternion(q);
    if (jit) P.x += gauss() * jit, P.y += gauss() * jit, P.z += gauss() * jit;
    push(P.x, P.y, P.z, Nn.x, Nn.y, Nn.z, ft, rgb);
  };
  let tries = 0;
  for (let i = 0; i < n; i++) {
    switch (s.t) {
      case 'sphere': {
        randDir(T2);
        if (s.mask && tries < n * 30) { tries++; if (!s.mask(T2.x, T2.y, T2.z)) { i--; continue; } }
        if (s.v) { const r0 = s.r0 ?? 0, rr = Math.cbrt(R() * (r ** 3 - r0 ** 3) + r0 ** 3); emit(T2.x * rr, T2.y * rr, T2.z * rr, 0, 0, 0); }
        else emit(T2.x * r, T2.y * r, T2.z * r, T2.x, T2.y, T2.z, (Math.atan2(T2.z, T2.x) / Math.PI + 1) / 2);
        break;
      }
      case 'ellipsoid': {
        const [a, b, cc] = Array.isArray(s.r) ? s.r : [r, r, r];
        randDir(T2);
        if (s.mask && tries < n * 30) { tries++; if (!s.mask(T2.x, T2.y, T2.z)) { i--; continue; } }
        if (s.v) { const k = Math.cbrt(R()); emit(T2.x * a * k, T2.y * b * k, T2.z * cc * k, 0, 0, 0); }
        else { T3.set(T2.x / a, T2.y / b, T2.z / cc).normalize(); emit(T2.x * a, T2.y * b, T2.z * cc, T3.x, T3.y, T3.z, (T2.y + 1) / 2); }
        break;
      }
      case 'box': case 'rbox': {
        const [w, h, d] = s.s ?? [1, 1, 1];
        if (s.v) { emit((R() - .5) * w, (R() - .5) * h, (R() - .5) * d, 0, 0, 0); break; }
        const A = [w * h, w * h, w * d, w * d, h * d, h * d], tot = A.reduce((x, y) => x + y);
        let u = R() * tot, f = 0; while (u > A[f]) u -= A[f++];
        const a = R() - .5, b = R() - .5, sg = f % 2 ? .5 : -.5;
        let x, y, z, nx = 0, ny = 0, nzz = 0;
        if (f < 2) { x = a * w; y = b * h; z = sg * d; nzz = Math.sign(sg); }
        else if (f < 4) { x = a * w; y = sg * h; z = b * d; ny = Math.sign(sg); }
        else { x = sg * w; y = a * h; z = b * d; nx = Math.sign(sg); }
        if (s.t === 'rbox') { // round the edges: project onto an inner box + radius
          const rad = Math.min(s.rad ?? 0.1, w / 2, h / 2, d / 2) * 0.999;
          const ix = w / 2 - rad, iy = h / 2 - rad, iz = d / 2 - rad;
          const cx = Math.max(-ix, Math.min(ix, x)), cy = Math.max(-iy, Math.min(iy, y)), cz = Math.max(-iz, Math.min(iz, z));
          T3.set(x - cx, y - cy, z - cz); if (T3.lengthSq() < 1e-9) T3.set(nx, ny, nzz); T3.normalize();
          x = cx + T3.x * rad; y = cy + T3.y * rad; z = cz + T3.z * rad; nx = T3.x; ny = T3.y; nzz = T3.z;
        }
        emit(x, y, z, nx, ny, nzz, (x / w + 0.5)); break;
      }
      case 'cyl': {
        const r1 = r, r2 = s.r2 ?? r, h = s.h ?? 1, th = R() * Math.PI * 2 * (s.arc ?? 1) + (s.start ?? 0) * D2R;
        const ct = Math.cos(th), st = Math.sin(th);
        if (s.v) { const u = R(); const rr = (r1 + (r2 - r1) * u) * Math.sqrt(R()); emit(rr * ct, (u - .5) * h, rr * st, 0, 0, 0, u); break; }
        const side = Math.PI * (r1 + r2) * Math.sqrt(h * h + (r1 - r2) ** 2);
        const caps = s.open ? 0 : Math.PI * (r1 * r1 + r2 * r2);
        const u = R() * (side + caps);
        if (u < side) { const t = R(); const rr = r1 + (r2 - r1) * t; T3.set(ct, (r1 - r2) / h, st).normalize(); emit(rr * ct, (t - .5) * h, rr * st, T3.x, T3.y, T3.z, t); }
        else { const top = (u - side) > Math.PI * r1 * r1; const rr = (top ? r2 : r1) * Math.sqrt(R()); emit(rr * ct, top ? h / 2 : -h / 2, rr * st, 0, top ? 1 : -1, 0, top ? 1 : 0); }
        break;
      }
      case 'capsule': {
        const h = s.h ?? 1, sideA = 2 * Math.PI * r * h, capA = 4 * Math.PI * r * r;
        if (R() < sideA / (sideA + capA)) { const th = R() * Math.PI * 2, t = R(); emit(r * Math.cos(th), (t - .5) * h, r * Math.sin(th), Math.cos(th), 0, Math.sin(th), t); }
        else { randDir(T2); const off = T2.y > 0 ? h / 2 : -h / 2; emit(T2.x * r, T2.y * r + off, T2.z * r, T2.x, T2.y, T2.z, T2.y > 0 ? 1 : 0); }
        break;
      }
      case 'torus': {
        const RR = s.R ?? 1, th = R() * Math.PI * 2 * (s.arc ?? 1) + (s.start ?? 0) * D2R, ph = R() * Math.PI * 2;
        const rr = RR + r * Math.cos(ph);
        emit(rr * Math.cos(th), r * Math.sin(ph), rr * Math.sin(th), Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th), (th / (Math.PI * 2)) % 1);
        break;
      }
      case 'disk': {
        const r0 = s.r0 ?? 0, th = R() * Math.PI * 2 * (s.arc ?? 1) + (s.start ?? 0) * D2R;
        const rr = Math.sqrt(R() * (r * r - r0 * r0) + r0 * r0), side = R() < 0.5 ? 1 : -1;
        emit(rr * Math.cos(th), 0, rr * Math.sin(th), 0, side, 0, (rr - r0) / (r - r0 || 1)); break;
      }
      case 'lathe': { // profile [[radius, y], ...] revolved around y
        const L = lathePrep(s); let u = R() * L.A, k = 0; while (k < L.seg.length - 1 && u > L.seg[k].area) u -= L.seg[k++].area;
        const g = L.seg[k], t = R(), rr = g.r0 + (g.r1 - g.r0) * t, y = g.y0 + (g.y1 - g.y0) * t;
        const th = R() * Math.PI * 2 * (s.arc ?? 1) + (s.start ?? 0) * D2R, ct = Math.cos(th), st = Math.sin(th);
        const dr = g.r1 - g.r0, dy = g.y1 - g.y0; T3.set(dy * ct, -dr, dy * st).normalize();
        emit(rr * ct, y, rr * st, T3.x, T3.y, T3.z, (g.L0 + g.len * t) / L.L); break;
      }
      case 'tube': {
        if (!s._curve) s._curve = new THREE.CatmullRomCurve3(s.pts.map(p => vec(p)), !!s.closed);
        const t = R(); s._curve.getPointAt(t, T2); s._curve.getTangentAt(t, T3);
        tubeOffset(T2, T3, r, t, emit); break;
      }
      case 'helix': {
        const turns = s.turns ?? 3, h = s.h ?? 4, RR = s.R ?? 1, ph0 = s.phase ?? 0;
        const t = R(), a = ph0 + t * turns * Math.PI * 2;
        T2.set(RR * Math.cos(a), (t - .5) * h, RR * Math.sin(a));
        T3.set(-RR * Math.sin(a) * turns * Math.PI * 2, h, RR * Math.cos(a) * turns * Math.PI * 2).normalize();
        tubeOffset(T2, T3, r, t, emit); break;
      }
      case 'pts': {
        const d = s.data; if (!d?.length) { emit(0, 0, 0, 0, 0, 0); break; }
        const p = d[i < d.length && n <= d.length ? Math.floor(i * d.length / n) : Math.floor(R() * d.length)];
        const jj = n > d.length ? (s.j ?? 0.01) : 0;
        const hasN = p.length >= 9;
        emit(p[0] + gauss() * jj, p[1] + gauss() * jj, p[2] + gauss() * jj, hasN ? p[6] : 0, hasN ? p[7] : 0, hasN ? p[8] : 0, -1, p.length >= 6 && p[3] >= 0 ? p : null); break;
      }
      default: emit(0, 0, 0, 0, 0, 0);
    }
  }
}
const nrm = new THREE.Vector3(), bin = new THREE.Vector3(), tmpA = new THREE.Vector3(1, 0, 0);
function tubeOffset(p, t, r, ft, emit) {
  nrm.crossVectors(t, Math.abs(t.y) > 0.9 ? tmpA : UP).normalize();
  bin.crossVectors(t, nrm).normalize();
  const ph = R() * Math.PI * 2, cs = Math.cos(ph), sn = Math.sin(ph);
  const ox = nrm.x * cs + bin.x * sn, oy = nrm.y * cs + bin.y * sn, oz = nrm.z * cs + bin.z * sn;
  emit(p.x + ox * r, p.y + oy * r, p.z + oz * r, ox, oy, oz, ft);
}

// ---------- build a whole model ----------
export function buildModel(def, N) {
  const parts = (def.parts || []).filter(p => p && (p.shapes?.length)).slice(0, MAX_PARTS);
  if (!parts.length) throw new Error('Model has no parts with shapes');
  const weights = parts.map(p => p.shapes.reduce((a, s) => a + shapeWeight(s), 0) * (p.d ?? 1));
  const totalW = weights.reduce((a, b) => a + b, 0);
  const minPer = Math.min(500, Math.floor(N / parts.length / 3));
  const counts = weights.map(w => Math.max(minPer, Math.floor(N * w / totalW)));
  let sum = counts.reduce((a, b) => a + b, 0);
  while (sum !== N) {
    const big = counts.indexOf(Math.max(...counts));
    const diff = N - sum; const step = Math.sign(diff) * Math.min(Math.abs(diff), Math.max(1, Math.floor(counts[big] * 0.5)));
    counts[big] += step; sum += step;
  }

  const pos = new Float32Array(N * 3), part = new Float32Array(N), col = new Float32Array(N * 3);
  const nor = new Float32Array(N * 3), flow = new Float32Array(N).fill(-1), mat = new Float32Array(N);
  let k = 0;
  const color = new THREE.Color(), c2 = new THREE.Color();
  parts.forEach((p, pi) => {
    const sw = p.shapes.map(shapeWeight), st = sw.reduce((a, b) => a + b, 0);
    let left = counts[pi];
    p.shapes.forEach((s, si) => {
      const n = si === p.shapes.length - 1 ? left : Math.max(1, Math.round(counts[pi] * sw[si] / st));
      left -= n;
      color.set(s.color || p.color || '#66ddff');
      const m = MATERIALS[s.mat || p.mat] ?? 0, hasFlow = !!(p.flow || s.flow) && s.flow !== false;
      const vary = s.vary ?? p.vary ?? 0.24;
      sampleShape(s, Math.max(0, n), (x, y, z, nx, ny, nz, ft, rgb) => {
        if (k >= N) return;
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; part[k] = pi;
        nor[k * 3] = nx; nor[k * 3 + 1] = ny; nor[k * 3 + 2] = nz;
        flow[k] = hasFlow ? ft : -1; mat[k] = m;
        if (rgb) c2.setRGB(rgb[3], rgb[4], rgb[5]); else c2.copy(color).multiplyScalar(1 - vary / 2 + Math.random() * vary);
        col[k * 3] = c2.r; col[k * 3 + 1] = c2.g; col[k * 3 + 2] = c2.b; k++;
      });
    });
  });
  for (; k < N; k++) { // pad any shortfall by duplicating random points
    const j = Math.floor(Math.random() * Math.max(1, k));
    pos.copyWithin(k * 3, j * 3, j * 3 + 3); col.copyWithin(k * 3, j * 3, j * 3 + 3); nor.copyWithin(k * 3, j * 3, j * 3 + 3);
    part[k] = part[j]; flow[k] = flow[j]; mat[k] = mat[j];
  }

  // normalise: centre on bounding box, scale to TARGET_RADIUS
  const box = new THREE.Box3(), tmp = new THREE.Vector3();
  for (let i = 0; i < N; i++) box.expandByPoint(tmp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
  const center = box.getCenter(new THREE.Vector3());
  let maxR = 0;
  for (let i = 0; i < N; i++) maxR = Math.max(maxR, tmp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).sub(center).length());
  const scale = TARGET_RADIUS / (maxR || 1);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (pos[i * 3] - center.x) * scale; pos[i * 3 + 1] = (pos[i * 3 + 1] - center.y) * scale; pos[i * 3 + 2] = (pos[i * 3 + 2] - center.z) * scale;
  }
  const xf = v => vec(v).sub(center).multiplyScalar(scale);
  const ao = new Float32Array(N).fill(1); // baked later in a worker (see ao.js)

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
    const animList = Array.isArray(p.anim) ? p.anim : p.anim ? [p.anim] : [];
    const anims = animList.map(a => ({
      type: a.type, axis: vec(a.axis || [0, 1, 0]).normalize(), speed: a.speed ?? 1,
      amp: a.type === 'bob' ? (a.amp ?? 0.1) * scale : (a.amp ?? 0.05), freq: a.freq ?? 1, phase: a.phase ?? 0,
    }));
    const pv = p.pivot || animList[0]?.pivot;
    const f = p.flow === true ? {} : p.flow;
    return {
      name: p.name || `Part ${i + 1}`, desc: p.desc || '', fact: p.fact || '', color: p.color || '#66ddff',
      centroid: cent[i], explode: ex, pivot: pv ? xf(pv) : cent[i].clone(), anims, count: cnt[i],
      flow: f ? { speed: f.speed ?? 0.6, strength: f.strength ?? 1.6, k: f.k ?? 3 } : null,
    };
  });

  // auto-exposure (thin models pack particles densely and blow out in glow mode) & solid point size
  const normArea = totalW * scale * scale;
  const allPts = parts.every(p => p.shapes.every(s => s.t === 'pts'));
  const gain = allPts ? 0.8 : Math.min(1.1, Math.max(0.45, Math.pow(normArea / 45, 0.4)));
  const solidSize = Math.min(0.22, Math.max(0.035, Math.sqrt(normArea / N) * 4.2));
  return { def, N, positions: pos, part, colors: col, normals: nor, flow, mat, ao, parts: meta, scale, center, gain, solidSize };
}

// scatter cloud used for the dissolved / idle state
export function makeScatter(N) {
  const a = new Float32Array(N * 3), t = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    randDir(t); const r = 3 + Math.pow(R(), 0.6) * 5;
    a[i * 3] = t.x * r * 1.3; a[i * 3 + 1] = t.y * r * 0.7; a[i * 3 + 2] = t.z * r;
  }
  return a;
}
