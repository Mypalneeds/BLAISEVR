// BlaiseVR — GPU particle cloud. One draw call; per-part transforms, flows and lighting in the shader.
// Styles: 0 = glow (lit light-particles), 1 = realistic (shaded solid surfaces), 2 = x-ray (edges only).
import * as THREE from 'three';
import { MAX_PARTS, makeScatter } from './sampler.js';

const vert = /* glsl */`
uniform float uTime, uForm, uMorph, uSize, uPR, uHasSel, uDim, uCutOn, uStyle, uGain, uSolidSize, uPass;
uniform vec4 uCut;
uniform vec4 uQ[${MAX_PARTS}];
uniform vec4 uP[${MAX_PARTS}];
uniform vec4 uT[${MAX_PARTS}];
uniform vec4 uF[${MAX_PARTS}];
attribute vec3 aPrev;
attribute vec3 aScatter;
attribute float aPart;
attribute vec3 aColor;
attribute vec3 aNormal;
attribute float aFlow;
attribute float aMat;
attribute float aAO;
attribute vec4 aRnd;
varying vec3 vColor;
varying float vAlpha;
varying float vShade;
varying vec3 vN;
vec3 qrot(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
void main(){
  int i = int(aPart + 0.5);
  vec4 Q = uQ[i]; vec4 P = uP[i]; vec4 T = uT[i]; vec4 F = uF[i];
  float m = smoothstep(aRnd.y*0.45, aRnd.y*0.45 + 0.55, uMorph);
  vec3 home = mix(aPrev, position, m);
  home += (1.0 - abs(2.0*m - 1.0)) * 0.6 * vec3(sin(aRnd.x*31.0), cos(aRnd.z*17.0), sin(aRnd.w*23.0));
  vec3 p = home - P.xyz; p *= P.w; p = qrot(Q, p); p += P.xyz + T.xyz;

  float ang = uTime*0.08*(0.4 + aRnd.z);
  vec3 sc = aScatter;
  sc.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * sc.xz;
  float tt = uTime*0.35 + aRnd.x*6.2831;
  sc += 0.25*vec3(sin(tt*1.3), cos(tt*1.7), sin(tt*1.1));
  float f = smoothstep(aRnd.x*0.5, aRnd.x*0.5 + 0.5, uForm);
  vec3 pos = mix(sc, p, f);
  if (uStyle < 0.5) pos += 0.006*f*vec3(sin(uTime*2.0 + aRnd.w*40.0), cos(uTime*2.3 + aRnd.z*40.0), sin(uTime*1.7 + aRnd.x*40.0));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);

  // ---------- lighting ----------
  float hasN = step(0.0001, dot(aNormal, aNormal));
  vec3 N = normalize(normalMatrix * qrot(Q, aNormal + vec3(0.0, 1e-6, 0.0)));
  vec3 V = normalize(-mv.xyz);
  int mt = int(aMat + 0.5);
  float kd = 0.9, ks = 0.12, sh = 16.0, kr = 0.22, wrap = 0.0, env = 0.0;
  if (mt == 1)      { kd = 0.42; ks = 1.1;  sh = 70.0; kr = 0.25; env = 0.75; }   // metal
  else if (mt == 2) { kd = 0.85; ks = 0.28; sh = 14.0; kr = 0.5;  wrap = 0.55; }  // organic
  else if (mt == 3) { kd = 0.18; ks = 1.3;  sh = 90.0; kr = 1.1; }                // glass
  else if (mt == 5) { kd = 0.82; ks = 0.6;  sh = 40.0; kr = 0.2; }                // plastic
  else if (mt == 6) { kd = 0.65; ks = 0.04; sh = 6.0;  kr = 0.08; }               // rubber
  float ndv = dot(N, V);
  if (ndv < 0.0 && uStyle > 0.5 && uStyle < 1.5) { N = -N; ndv = -ndv; }            // two-sided in solid view
  vec3 L1 = normalize(vec3(-0.45, 0.75, 0.6)), L2 = normalize(vec3(0.75, -0.15, 0.35)), L3 = normalize(vec3(0.1, 0.2, -1.0));
  float dif = max((dot(N, L1) + wrap) / (1.0 + wrap), 0.0);
  float fil = max(dot(N, L2), 0.0) * 0.32;
  float bck = max(dot(N, L3), 0.0) * 0.25;
  float spec = pow(max(dot(reflect(-L1, N), V), 0.0), sh) * ks;
  float rim = pow(1.0 - clamp(abs(ndv), 0.0, 1.0), 3.0) * kr;
  vec3 Rv = reflect(-V, N);
  vec3 envc = mix(vec3(0.08, 0.07, 0.06), vec3(0.75, 0.85, 1.0), smoothstep(-0.4, 0.6, Rv.y)) * env;
  vec3 alb = aColor;
  float ao = aAO;
  vec3 lit = alb * (0.16 * ao + dif * kd * mix(0.3, 1.0, ao) + (fil + bck) * ao) + vec3(spec) * ao + alb * rim * ao + envc * mix(vec3(1.0), alb, 0.55) * ao;
  if (mt == 2) lit += vec3(0.25, 0.04, 0.02) * pow(1.0 - abs(ndv), 2.0) * 0.6;    // subsurface-ish warm rim
  if (mt == 4 || hasN < 0.5) lit = alb * (mt == 4 ? 1.35 : 0.95);
  float back = hasN > 0.5 ? smoothstep(-0.4, 0.3, ndv) : 1.0;

  float glassy = (mt == 3 || hasN < 0.5) ? 1.0 : 0.0;
  bool solidPass = uStyle > 0.5 && uStyle < 1.5 && uPass < 1.5;
  vec3 col;
  if (uPass > 1.5) col = (lit * 0.55 + alb * 0.15) * (0.35 + pow(1.0 - clamp(abs(ndv), 0.0, 1.0), 2.0) * 0.9) * (hasN < 0.5 ? 0.45 : 1.0);
  else if (uStyle < 0.5) col = mix(alb, lit * 1.1, 0.7) * mix(0.3, 1.0, back) * uGain * 0.62;
  else if (uStyle < 1.5) col = lit;
  else {
    float edge = hasN > 0.5 ? pow(1.0 - clamp(abs(ndv), 0.0, 1.0), 2.2) : 0.25;
    col = mix(vec3(0.3, 0.8, 1.0), alb, 0.45) * (0.05 + edge * 1.25) * uGain * (mt == 4 ? 2.0 : 1.0);
  }
  // ---------- flow pulses (blood, current, air, magma…) ----------
  if (aFlow >= 0.0 && F.y > 0.0) {
    float w = fract(aFlow * F.z - uTime * F.x + aRnd.w * 0.03);
    float pl = smoothstep(0.78, 1.0, w);
    col = col * (1.0 + F.y * pl) + vec3(0.6, 0.55, 0.45) * F.y * pl * (uStyle > 0.5 && uStyle < 1.5 ? 0.35 : 0.12);
  }

  float st = T.w;
  float bright = 1.0;
  if (st > 1.5) bright = 1.4; else if (st > 0.5) bright = 1.25; else if (uHasSel > 0.5) bright = uDim * (uStyle > 0.5 && uStyle < 1.5 ? 1.6 : 1.0);
  vAlpha = 1.0;
  if (uCutOn > 0.5 && f > 0.5) {
    float d = dot(p, uCut.xyz) - uCut.w;
    if (d > 0.0) vAlpha = 0.0;
    else if (d > -0.05) bright *= 2.0;
  }
  float fogK = uStyle > 0.5 && uStyle < 1.5 ? 1.0 : mix(1.0, 0.6, smoothstep(6.0, 13.0, -mv.z));
  vColor = col * bright * mix(0.55, 1.0, f) * fogK;
  if (solidPass) { vec3 x = vColor * 1.02; x = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); float lum = dot(x, vec3(0.299, 0.587, 0.114)); vColor = clamp(mix(vec3(lum), x, 1.22), 0.0, 1.0); }
  vShade = solidPass ? 1.0 : 0.0;
  vN = hasN > 0.5 ? N : vec3(0.0);
  float skip = (uPass > 0.5 && uPass < 1.5 && glassy > 0.5) || (uPass > 1.5 && glassy < 0.5) ? 1.0 : 0.0;
  gl_Position = projectionMatrix * mv;
  float base = solidPass ? mix(uSize, uSolidSize * 1.22, f) * (0.85 + aRnd.z * 0.3) : uSize * (0.55 + aRnd.z) * (uPass > 1.5 ? 1.15 : 1.0);
  float sz = base * uPR * (st > 1.5 && uStyle < 0.5 ? 1.35 : 1.0) * mix(0.7, 1.0, f);
  gl_PointSize = (vAlpha < 0.5 || bright < 0.01 || skip > 0.5 || st > 2.5) ? 0.0 : sz * (300.0 / max(0.1, -mv.z));
}`;

const frag = /* glsl */`
varying vec3 vColor;
varying float vAlpha;
varying float vShade;
varying vec3 vN;
void main(){
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (vAlpha < 0.01) discard;
  if (vShade > 0.5) {
    // surface splat: each particle is a small disc lying on the surface, so it looks like an ellipse from the side
    vec2 q = vec2(c.x, -c.y) * 2.0; float r2 = dot(q, q);
    float l = length(vN.xy);
    if (l > 0.001) { float nz = max(abs(vN.z), 0.28); vec2 nd = vN.xy / l; float par = dot(q, nd); vec2 perp = q - par * nd; r2 = dot(perp, perp) + par * par / (nz * nz); }
    if (r2 > 1.0) discard;
    gl_FragColor = vec4(vColor * (1.0 - 0.18 * r2), 1.0); return;
  }
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d); a *= a;
  gl_FragColor = vec4(vColor * a, a);
}`;

export class ParticleCloud {
  constructor(N) {
    this.N = N;
    this.group = new THREE.Group();
    const arr = (x, y, z, w) => Array.from({ length: MAX_PARTS }, () => new THREE.Vector4(x, y, z, w));
    this.uniforms = {
      uTime: { value: 0 }, uForm: { value: 0 }, uMorph: { value: 1 }, uSize: { value: 0.06 }, uSolidSize: { value: 0.08 },
      uPR: { value: Math.min(window.devicePixelRatio || 1, 2) }, uHasSel: { value: 0 }, uDim: { value: 0.28 },
      uCutOn: { value: 0 }, uGain: { value: 1 }, uStyle: { value: 0 }, uPass: { value: 0 }, uCut: { value: new THREE.Vector4(1, 0, 0, 0) },
      uQ: { value: arr(0, 0, 0, 1) }, uP: { value: arr(0, 0, 0, 1) }, uT: { value: arr(0, 0, 0, 0) }, uF: { value: arr(0, 0, 0, 0) },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.glassMaterial = new THREE.ShaderMaterial({
      uniforms: { ...this.uniforms, uPass: { value: 2 } }, vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this._allocate(N);
  }
  _allocate(N) {
    this.N = N;
    if (this.points) { this.group.remove(this.points, this.glassPoints); this.geometry.dispose(); this.glassGeometry?.dispose(); }
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3); this.prev = new Float32Array(N * 3);
    this.partAttr = new Float32Array(N); this.color = new Float32Array(N * 3);
    this.normal = new Float32Array(N * 3); this.flow = new Float32Array(N); this.mat = new Float32Array(N); this.ao = new Float32Array(N).fill(1);
    const rnd = new Float32Array(N * 4); for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aPrev', new THREE.BufferAttribute(this.prev, 3));
    g.setAttribute('aScatter', new THREE.BufferAttribute(makeScatter(N), 3));
    g.setAttribute('aPart', new THREE.BufferAttribute(this.partAttr, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    g.setAttribute('aNormal', new THREE.BufferAttribute(this.normal, 3));
    g.setAttribute('aFlow', new THREE.BufferAttribute(this.flow, 1));
    g.setAttribute('aMat', new THREE.BufferAttribute(this.mat, 1));
    g.setAttribute('aAO', new THREE.BufferAttribute(this.ao, 1));
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    this.geometry = g;
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    const gg = new THREE.BufferGeometry();   // same attribute buffers, its own draw range
    for (const [k, v] of Object.entries(g.attributes)) gg.setAttribute(k, v);
    gg.boundingSphere = g.boundingSphere; this.glassGeometry = gg;
    this.glassPoints = new THREE.Points(gg, this.glassMaterial);
    this.glassPoints.frustumCulled = false; this.glassPoints.renderOrder = 2;
    this.glassPoints.visible = this.uniforms.uStyle.value === 1;
    this.group.add(this.points, this.glassPoints);
    this.uniforms.uSize.value = 0.055 * Math.sqrt(150000 / N);
    this.model = null;
  }
  setModel(model, morph = true) {
    if (model.N !== this.N) this._allocate(model.N);
    if (morph && this.model) this.prev.set(this.pos); else this.prev.set(model.positions);
    this.pos.set(model.positions); this.partAttr.set(model.part);
    this.baseColors = model.colors; this.color.set(model.colors);
    this.normal.set(model.normals); this.flow.set(model.flow); this.mat.set(model.mat); this.ao.set(model.ao);
    for (const k of ['position', 'aPrev', 'aPart', 'aColor', 'aNormal', 'aFlow', 'aMat', 'aAO']) this.geometry.getAttribute(k).needsUpdate = true;
    this.model = model; this._ranges();
    this.uniforms.uGain.value = model.gain ?? 1;
    this.uniforms.uSolidSize.value = model.solidSize ?? 0.08;
    this.uniforms.uMorph.value = morph ? 0 : 1;
    model.parts.forEach((p, i) => { const F = this.uniforms.uF.value[i]; if (p.flow) F.set(p.flow.speed, p.flow.strength, p.flow.k, 0); else F.set(0, 0, 0, 0); });
    for (let i = model.parts.length; i < MAX_PARTS; i++) this.uniforms.uF.value[i].set(0, 0, 0, 0);
    const step = Math.max(1, Math.floor(this.N / 7000));
    this.pickIdx = []; for (let i = 0; i < this.N; i += step) this.pickIdx.push(i);
  }
  setAO(ao) { this.ao.set(ao); this.geometry.getAttribute('aAO').needsUpdate = true; }
  setFlowOn(on) { if (!this.model) return; this.model.parts.forEach((p, i) => { const F = this.uniforms.uF.value[i]; if (p.flow && on) F.set(p.flow.speed, p.flow.strength, p.flow.k, 0); else F.y = 0; }); }
  setColorMode(mode) {
    if (!this.model) return;
    const c = this.color, b = this.baseColors, N = this.N, col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      if (mode === 'parts') { c[i * 3] = b[i * 3]; c[i * 3 + 1] = b[i * 3 + 1]; c[i * 3 + 2] = b[i * 3 + 2]; continue; }
      const y = this.pos[i * 3 + 1], p = this.partAttr[i];
      if (mode === 'heat') col.setHSL(0.66 - (y + 2.2) / 4.4 * 0.66, 1, 0.55);
      else if (mode === 'rainbow') col.setHSL((p * 0.137) % 1, 0.9, 0.6);
      else if (mode === 'ice') col.setHSL(0.52 + Math.random() * 0.06, 0.9, 0.55 + Math.random() * 0.2);
      else if (mode === 'gold') col.setHSL(0.1 + Math.random() * 0.04, 1, 0.5 + Math.random() * 0.15);
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    }
    this.geometry.getAttribute('aColor').needsUpdate = true;
  }
  // 'glow' | 'real' | 'xray'
  _ranges() {
    const N = this.N, gs = this.model?.glassStart ?? N, solid = this.uniforms.uStyle.value === 1;
    this.geometry.setDrawRange(0, solid ? gs : N);
    this.glassGeometry?.setDrawRange(gs, N - gs);
    if (this.glassPoints) this.glassPoints.visible = solid && gs < N;
  }
  setPixelRatio(pr) { this.uniforms.uPR.value = pr; }
  setStyle(style) {
    const solid = style === 'real';
    this.uniforms.uStyle.value = style === 'real' ? 1 : style === 'xray' ? 2 : 0;
    this.uniforms.uPass.value = solid ? 1 : 0; this._ranges();
    this.material.blending = solid ? THREE.NormalBlending : THREE.AdditiveBlending;
    this.material.depthWrite = solid; this.material.transparent = !solid;
    this.material.needsUpdate = true;
  }
  applyPartStates(states) {
    const U = this.uniforms;
    states.forEach((s, i) => {
      U.uQ.value[i].set(s.q.x, s.q.y, s.q.z, s.q.w);
      U.uP.value[i].set(s.pivot.x, s.pivot.y, s.pivot.z, s.scale);
      U.uT.value[i].set(s.t.x, s.t.y, s.t.z, s.hl);
    });
  }
  transformPoint(i, states, out) {
    const pi = this.partAttr[i], s = states[pi];
    if (!s) { out.set(0, 0, 1e6); return -1; }
    out.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]).sub(s.pivot).multiplyScalar(s.scale).applyQuaternion(s.q).add(s.pivot).add(s.t);
    return pi;
  }
}
