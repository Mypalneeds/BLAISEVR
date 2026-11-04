// BlaiseVR — ambient occlusion bake (no imports, so it can run inside a Web Worker).
// ---------- ambient occlusion bake ----------
// For every surface particle, look at nearby particles in front of its surface (along the normal).
// Crevices, joints and places where parts touch get darker — the contact shadows that make things look solid.
export function bakeAO(pos, nor, N, radius = 0.16) {
  const CAP = 14; // max occluders sampled per grid cell keeps dense models fast
  const ao = new Float32Array(N).fill(1);
  const stride = Math.max(1, Math.round(N / 30000));            // occluders: a ~30k subset is plenty
  const inv = 1 / radius, G = 96, half = G / 2;
  const keyOf = (x, y, z) => ((Math.floor(x * inv) + half) * G + (Math.floor(y * inv) + half)) * G + (Math.floor(z * inv) + half);
  const occ = []; for (let i = 0; i < N; i += stride) occ.push(i);
  const keys = new Float64Array(occ.length); occ.forEach((i, k) => keys[k] = keyOf(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
  const order = Array.from(occ.keys()).sort((a, b) => keys[a] - keys[b]);
  const cells = new Map();
  for (let k = 0; k < order.length; k++) { const key = keys[order[k]]; const c = cells.get(key); if (c) c[1] = k + 1; else cells.set(key, [k, k + 1]); }
  const R2 = radius * radius;
  for (let i = 0; i < N; i++) {
    const nx = nor[i * 3], ny = nor[i * 3 + 1], nz = nor[i * 3 + 2];
    if (!nx && !ny && !nz) continue;
    const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
    const cx = Math.floor(px * inv) + half, cy = Math.floor(py * inv) + half, cz = Math.floor(pz * inv) + half;
    let blocked = 0, total = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const c = cells.get(((cx + dx) * G + (cy + dy)) * G + (cz + dz)); if (!c) continue;
      const st = Math.max(1, Math.ceil((c[1] - c[0]) / CAP));
      for (let k = c[0] + (i % st); k < c[1]; k += st) {
        const j = occ[order[k]]; if (j === i) continue;
        const vx = pos[j * 3] - px, vy = pos[j * 3 + 1] - py, vz = pos[j * 3 + 2] - pz, d2 = vx * vx + vy * vy + vz * vz;
        if (d2 > R2 || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), cs = (vx * nx + vy * ny + vz * nz) / d, w = (1 - d / radius) * st;
        total += w; if (cs > 0.3) blocked += w * cs;
      }
    }
    if (total > 0) ao[i] = 1 - Math.min(0.85, Math.pow((blocked / total) * 2.6, 0.85));
  }
  return ao;
}

