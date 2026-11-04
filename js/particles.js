// BlaiseVR — GPU particle cloud. One draw call; per-part transforms come in as uniforms.
import * as THREE from 'three';
import { MAX_PARTS, makeScatter } from './sampler.js';

const vert = /* glsl */`
uniform float uTime, uForm, uMorph, uSize, uPR, uHasSel, uDim, uCutOn, uSolid, uGain;
uniform vec4 uCut;
uniform vec4 uQ[${MAX_PARTS}];
uniform vec4 uP[${MAX_PARTS}];
uniform vec4 uT[${MAX_PARTS}];
attribute vec3 aPrev;
attribute vec3 aScatter;
attribute float aPart;
attribute vec3 aColor;
attribute vec4 aRnd;
varying vec3 vColor;
varying float vAlpha;
vec3 qrot(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
void main(){
  int i = int(aPart + 0.5);
  vec4 Q = uQ[i]; vec4 P = uP[i]; vec4 T = uT[i];
  float m = smoothstep(aRnd.y*0.45, aRnd.y*0.45 + 0.55, uMorph);
  vec3 home = mix(aPrev, position, m);
  // mid-morph swirl so particles visibly fly between shapes
  home += (1.0 - abs(2.0*m - 1.0)) * 0.6 * vec3(sin(aRnd.x*31.0), cos(aRnd.z*17.0), sin(aRnd.w*23.0));
  vec3 p = home - P.xyz; p *= P.w; p = qrot(Q, p); p += P.xyz + T.xyz;

  float ang = uTime*0.08*(0.4 + aRnd.z);
  vec3 sc = aScatter;
  sc.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * sc.xz;
  float tt = uTime*0.35 + aRnd.x*6.2831;
  sc += 0.25*vec3(sin(tt*1.3), cos(tt*1.7), sin(tt*1.1));
  float f = smoothstep(aRnd.x*0.5, aRnd.x*0.5 + 0.5, uForm);
  vec3 pos = mix(sc, p, f);
  pos += 0.006*f*vec3(sin(uTime*2.0 + aRnd.w*40.0), cos(uTime*2.3 + aRnd.z*40.0), sin(uTime*1.7 + aRnd.x*40.0));

  float st = T.w;
  float bright = 1.0;
  if (st > 1.5) bright = 1.45; else if (st > 0.5) bright = 1.3; else if (uHasSel > 0.5) bright = uDim;
  vAlpha = 1.0;
  if (uCutOn > 0.5 && f > 0.5) {
    float d = dot(p, uCut.xyz) - uCut.w;
    if (d > 0.0) vAlpha = 0.0;
    else if (d > -0.05) bright *= 2.2;   // glowing cross-section edge
  }
  vColor = aColor * bright * mix(0.55, 1.0, f) * (uSolid > 0.5 ? 1.0 : uGain);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float sz = uSize * (0.55 + aRnd.z) * uPR * (st > 1.5 ? 1.35 : 1.0) * mix(0.7, 1.0, f) * (uSolid > 0.5 ? 1.7 : 1.0);
  gl_PointSize = vAlpha < 0.5 || bright < 0.01 ? 0.0 : sz * (300.0 / max(0.1, -mv.z));
}`;

const frag = /* glsl */`
uniform float uSolid;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5 || vAlpha < 0.01) discard;
  if (uSolid > 0.5) {
    vec3 n = vec3(c*2.0, sqrt(max(0.0, 1.0 - 4.0*d*d)));
    float l = max(dot(n, normalize(vec3(-0.4, 0.6, 0.7))), 0.0)*0.85 + 0.25;
    gl_FragColor = vec4(vColor * l, 1.0);
    return;
  }
  float a = smoothstep(0.5, 0.0, d); a *= a;
  gl_FragColor = vec4(vColor * a * 0.62, a);
}`;

export class ParticleCloud {
  constructor(N) {
    this.N = N;
    this.group = new THREE.Group();
    this.uniforms = {
      uTime: { value: 0 }, uForm: { value: 0 }, uMorph: { value: 1 }, uSize: { value: 0.06 },
      uPR: { value: Math.min(window.devicePixelRatio || 1, 2) }, uHasSel: { value: 0 }, uDim: { value: 0.28 },
      uCutOn: { value: 0 }, uGain: { value: 1 }, uCut: { value: new THREE.Vector4(1, 0, 0, 0) }, uSolid: { value: 0 },
      uQ: { value: Array.from({ length: MAX_PARTS }, () => new THREE.Vector4(0, 0, 0, 1)) },
      uP: { value: Array.from({ length: MAX_PARTS }, () => new THREE.Vector4(0, 0, 0, 1)) },
      uT: { value: Array.from({ length: MAX_PARTS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this._allocate(N);
  }
  _allocate(N) {
    this.N = N;
    if (this.points) { this.group.remove(this.points); this.geometry.dispose(); }
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3); this.prev = new Float32Array(N * 3);
    this.partAttr = new Float32Array(N); this.color = new Float32Array(N * 3);
    const rnd = new Float32Array(N * 4); for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aPrev', new THREE.BufferAttribute(this.prev, 3));
    g.setAttribute('aScatter', new THREE.BufferAttribute(makeScatter(N), 3));
    g.setAttribute('aPart', new THREE.BufferAttribute(this.partAttr, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    this.geometry = g;
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.uniforms.uSize.value = 0.055 * Math.sqrt(150000 / N);
    this.model = null;
  }
  setModel(model, morph = true) {
    if (model.N !== this.N) this._allocate(model.N);
    if (morph && this.model) this.prev.set(this.pos); else this.prev.set(model.positions);
    this.pos.set(model.positions);
    this.partAttr.set(model.part);
    this.baseColors = model.colors;
    this.color.set(model.colors);
    for (const k of ['position', 'aPrev', 'aPart', 'aColor']) this.geometry.getAttribute(k).needsUpdate = true;
    this.model = model; this.uniforms.uGain.value = model.gain ?? 1;
    this.uniforms.uMorph.value = morph ? 0 : 1;
    // pick sample: a few thousand indices spread across every part
    const step = Math.max(1, Math.floor(this.N / 7000));
    this.pickIdx = []; for (let i = 0; i < this.N; i += step) this.pickIdx.push(i);
  }
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
  setSolid(on) {
    this.uniforms.uSolid.value = on ? 1 : 0;
    this.material.blending = on ? THREE.NormalBlending : THREE.AdditiveBlending;
    this.material.depthWrite = on; this.material.transparent = !on;
    this.material.needsUpdate = true;
  }
  // states: array of {q:Quaternion, pivot:Vector3, scale, t:Vector3, hl}
  applyPartStates(states) {
    const U = this.uniforms;
    states.forEach((s, i) => {
      U.uQ.value[i].set(s.q.x, s.q.y, s.q.z, s.q.w);
      U.uP.value[i].set(s.pivot.x, s.pivot.y, s.pivot.z, s.scale);
      U.uT.value[i].set(s.t.x, s.t.y, s.t.z, s.hl);
    });
  }
  // CPU mirror of the shader's part transform, used for picking & labels
  transformPoint(i, states, out) {
    const pi = this.partAttr[i], s = states[pi];
    out.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]).sub(s.pivot).multiplyScalar(s.scale).applyQuaternion(s.q).add(s.pivot).add(s.t);
    return pi;
  }
}
