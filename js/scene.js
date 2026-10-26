/* =========================================================
   AGÁRRATE 3D · Escena (Three.js)
   ========================================================= */
import * as THREE from 'three';
import { OrbitControls } from '../lib/OrbitControls.js';
import { F, STATION } from './track.js';
import { frameAt, carS } from './physics.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const COLORS = {
  red: { rail: 0xff3b4e, spine: 0xc92a3b },
  blue: { rail: 0x2f7cff, spine: 0x1d56c2 },
  green: { rail: 0x1fcf7a, spine: 0x14955a },
  gold: { rail: 0xffc21e, spine: 0xd4910a },
  purple: { rail: 0xa45cff, spine: 0x7433d1 }
};

let renderer, scene, camera, controls, sun, sky;
let trackGroup = null, cursor = null, ghost = null, ghostT = 0, stations = null, obstacleGroup = null;
let train = [], particles = null, pData = [];
let isMobile = false;
let camMode = 'build', rideCam = 'pov', camUp = V(0, 1, 0), chasePos = null;
let focusGoal = null;
let trackColor = 'red';
let demoAngle = 0, demoCenter = V(0, 20, 40), demoRadius = 120;

// ---------- Arranque ----------
export function init(canvas) {
  isMobile = matchMedia('(pointer: coarse)').matches;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 2 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe6ff, 260, 1100);
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);
  camera.position.set(-50, 45, -40);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.12;
  controls.maxPolarAngle = Math.PI * 0.485; controls.minDistance = 6; controls.maxDistance = 320;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.target.set(0, 4, 10);

  // cielo
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(0x2f86e8) }, bottom: { value: new THREE.Color(0xd8ecff) } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vW; void main(){ float h = normalize(vW).y; float t = pow(clamp(h * 1.4 + 0.08, 0.0, 1.0), 0.6); gl_FragColor = vec4(mix(bottom, top, t), 1.0); \n#include <colorspace_fragment>\n }',
    side: THREE.BackSide, depthWrite: false, fog: false
  });
  sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), skyMat);
  sky.renderOrder = -1;
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x5d7f3e, 1.1));
  sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.set(80, 140, 50);
  sun.castShadow = true;
  const sm = isMobile ? 1024 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  const sc = sun.shadow.camera; sc.left = -130; sc.right = 130; sc.top = 130; sc.bottom = -130; sc.near = 10; sc.far = 450;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
  scene.add(sun); scene.add(sun.target);

  buildGround();
  buildDecor();

  particles = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.6, vertexColors: true, transparent: true }));
  particles.frustumCulled = false;
  scene.add(particles);

  train = [0, 1, 2].map(i => buildCar(i === 0));
  train.forEach(c => scene.add(c));
  cursor = buildCursor(); scene.add(cursor);
  resize();
}

export function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

// ---------- Suelo y decorado ----------
function grassTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#6fbf4e'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) {
    const g = 150 + Math.random() * 60 | 0;
    x.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${g},${50 + Math.random() * 30 | 0},0.35)`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  x.strokeStyle = 'rgba(255,255,255,0.16)'; x.lineWidth = 3; x.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(150, 150);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function buildGround() {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }));
  g.rotation.x = -Math.PI / 2; g.receiveShadow = true;
  scene.add(g);
  const far = new THREE.Mesh(new THREE.CircleGeometry(3000, 48), new THREE.MeshStandardMaterial({ color: 0x5fa845, roughness: 1 }));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.05; scene.add(far);
  // camino de entrada al parque
  const path = new THREE.Mesh(new THREE.PlaneGeometry(5, 60), new THREE.MeshStandardMaterial({ color: 0xd9c49a, roughness: 1 }));
  path.rotation.x = -Math.PI / 2; path.position.set(9, 0.02, -30); path.receiveShadow = true; scene.add(path);
}

function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

function treeMeshes(count) {
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 1, 6).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x7a5232, flatShading: true }), count);
  const leaf = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x3f9d3a, flatShading: true }), count);
  trunk.castShadow = leaf.castShadow = true;
  return { trunk, leaf };
}
function placeTree(t, i, x, z, h, r, colorJitter) {
  const m = new THREE.Matrix4();
  m.compose(V(x, 0, z), new THREE.Quaternion(), V(1, h * 0.45, 1)); t.trunk.setMatrixAt(i, m);
  m.compose(V(x, h * 0.62, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, colorJitter * 6, 0)), V(r, h * 0.45, r)); t.leaf.setMatrixAt(i, m);
  t.leaf.setColorAt(i, new THREE.Color().setHSL(0.28 + colorJitter * 0.06, 0.55, 0.32 + colorJitter * 0.08));
}

function buildDecor() {
  const R = rnd(42);
  const N = isMobile ? 160 : 260;
  const t = treeMeshes(N);
  for (let i = 0; i < N; i++) {
    const a = R() * Math.PI * 2, d = 285 + R() * 260;
    placeTree(t, i, Math.cos(a) * d, Math.sin(a) * d, 7 + R() * 9, 2.5 + R() * 2.5, R());
  }
  scene.add(t.trunk, t.leaf);
  // montañas
  const mMat = new THREE.MeshStandardMaterial({ color: 0x7d93b3, flatShading: true, roughness: 1 });
  const snow = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2 + R() * 0.2, d = 820 + R() * 300, h = 120 + R() * 200, r = 140 + R() * 120;
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mMat);
    m.position.set(Math.cos(a) * d, h / 2 - 5, Math.sin(a) * d); m.rotation.y = R() * 3;
    scene.add(m);
    if (h > 220) { const s = new THREE.Mesh(new THREE.ConeGeometry(r * 0.28, h * 0.28, 7), snow); s.position.set(m.position.x, h - h * 0.14 - 5, m.position.z); s.rotation.y = m.rotation.y; scene.add(s); }
  }
  // nubes
  const cMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, emissive: 0x99aabb, emissiveIntensity: 0.25 });
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(8 + R() * 8, 1), cMat);
      s.position.set(k * 10 - 20 + R() * 4, R() * 4, R() * 8); g.add(s);
    }
    const a = R() * Math.PI * 2, d = 200 + R() * 500;
    g.position.set(Math.cos(a) * d, 130 + R() * 90, Math.sin(a) * d);
    g.scale.y = 0.55;
    scene.add(g);
  }
}

export function setObstacles(list) {
  if (obstacleGroup) { scene.remove(obstacleGroup); obstacleGroup = null; }
  if (!list || !list.length) return;
  obstacleGroup = new THREE.Group();
  const t = treeMeshes(list.length);
  list.forEach((o, i) => placeTree(t, i, o.x, o.z, o.h, o.r * 1.1, (i * 0.37) % 1));
  obstacleGroup.add(t.trunk, t.leaf);
  scene.add(obstacleGroup);
}

// ---------- Vía ----------
function frames(nodes) {
  const n = nodes.length, P = [], T = [], U = [], R = [];
  for (let i = 0; i < n; i++) P.push(V(nodes[i].x, nodes[i].y, nodes[i].z));
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    const t = b.clone().sub(a).normalize();
    let u = V(nodes[i].ux, nodes[i].uy, nodes[i].uz);
    const r = new THREE.Vector3().crossVectors(t, u).normalize();
    u = new THREE.Vector3().crossVectors(r, t).normalize();
    T.push(t); U.push(u); R.push(r);
  }
  return { P, T, U, R };
}

function tube(fr, i0, i1, offR, offU, radius, segs, mat) {
  const count = i1 - i0 + 1;
  if (count < 2) return null;
  const pos = new Float32Array(count * segs * 3), nor = new Float32Array(count * segs * 3), idx = [];
  const c = V(0, 0, 0), d = V(0, 0, 0);
  for (let k = 0; k < count; k++) {
    const i = i0 + k, P = fr.P[i], R = fr.R[i], U = fr.U[i];
    c.copy(P).addScaledVector(R, offR).addScaledVector(U, offU);
    for (let s = 0; s < segs; s++) {
      const a = s / segs * Math.PI * 2;
      d.copy(R).multiplyScalar(Math.cos(a)).addScaledVector(U, Math.sin(a));
      const o = (k * segs + s) * 3;
      pos[o] = c.x + d.x * radius; pos[o + 1] = c.y + d.y * radius; pos[o + 2] = c.z + d.z * radius;
      nor[o] = d.x; nor[o + 1] = d.y; nor[o + 2] = d.z;
    }
  }
  for (let k = 0; k < count - 1; k++) for (let s = 0; s < segs; s++) {
    const a = k * segs + s, b = k * segs + (s + 1) % segs, c2 = a + segs, d2 = b + segs;
    idx.push(a, c2, b, b, c2, d2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
  return m;
}

function basisMatrix(P, T, U, R, sx, sy, sz) {
  const m = new THREE.Matrix4().makeBasis(R.clone().negate(), U, T);
  m.scale(V(sx || 1, sy || 1, sz || 1));
  m.setPosition(P);
  return m;
}

function textSign(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect(8, 8, 496, 112, 30); x.fill();
  x.lineWidth = 12; x.strokeStyle = color; x.stroke();
  x.fillStyle = '#1e2433'; x.font = '900 72px "Lilita One", "Baloo 2", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
  return m;
}

function stationMesh(P, T, label, color) {
  const g = new THREE.Group();
  const heading = Math.atan2(T.x, T.z);
  g.position.set(P.x, 0, P.z); g.rotation.y = heading;
  const top = P.y - 0.25;
  const stone = new THREE.MeshStandardMaterial({ color: 0xc9ced8, roughness: 0.9 });
  const plat = new THREE.Mesh(new THREE.BoxGeometry(4.2, top, 17), stone);
  plat.position.set(-3.4, top / 2, 0); plat.castShadow = plat.receiveShadow = true; g.add(plat);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 17), new THREE.MeshStandardMaterial({ color: 0xffd43b }));
  edge.position.set(-1.45, top + 0.06, 0); g.add(edge);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4b5563 });
  [[-5.1, -7.5], [-5.1, 7.5], [1.6, -7.5], [1.6, 7.5]].forEach(([x, z]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, P.y + 4.6, 8), postMat);
    p.position.set(x, (P.y + 4.6) / 2, z); p.castShadow = true; g.add(p);
  });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.35, 18), new THREE.MeshStandardMaterial({ color }));
  roof.position.set(-1.75, P.y + 4.7, 0); roof.castShadow = true; g.add(roof);
  for (let k = -3; k <= 3; k++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(7.65, 0.37, 1.2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    s.position.set(-1.75, P.y + 4.7, k * 2.6); g.add(s);
  }
  const sign = textSign(label, '#' + color.toString(16).padStart(6, '0'));
  sign.position.set(-1.75, P.y + 6.1, 0); sign.rotation.y = -Math.PI / 2; g.add(sign);
  const sign2 = sign.clone(); sign2.rotation.y = Math.PI / 2; sign2.position.x += 0.01; g.add(sign2);
  return g;
}

export function setTrackColor(c) { trackColor = COLORS[c] ? c : 'red'; }

export function setTrack(built) {
  if (trackGroup) {
    scene.remove(trackGroup);
    trackGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  trackGroup = new THREE.Group();
  const nodes = built.nodes, fr = frames(nodes), n = nodes.length;
  const col = COLORS[trackColor];
  const railMat = new THREE.MeshStandardMaterial({ color: col.rail, roughness: 0.35, metalness: 0.4 });
  const spineMat = new THREE.MeshStandardMaterial({ color: col.spine, roughness: 0.5, metalness: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xaab4c3, roughness: 0.4, metalness: 0.6 });
  [-0.55, 0.55].forEach(o => { const m = tube(fr, 0, n - 1, o, 0, 0.085, 6, nodes[0].f & F.STATION ? railMat : railMat); if (m) trackGroup.add(m); });
  const sp = tube(fr, 0, n - 1, 0, -0.38, 0.2, 8, spineMat); if (sp) trackGroup.add(sp);

  // cadena (tramos)
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.6, metalness: 0.7 });
  let i = 0;
  while (i < n) {
    if (nodes[i].f & F.CHAIN) { let j = i; while (j + 1 < n && (nodes[j + 1].f & F.CHAIN)) j++; const m = tube(fr, Math.max(0, i - 1), j, 0, -0.12, 0.07, 5, chainMat); if (m) trackGroup.add(m); i = j + 1; }
    else i++;
  }
  // traviesas
  const tieIdx = []; for (let k = 0; k < n; k += 2) tieIdx.push(k);
  const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(1.35, 0.1, 0.22), steel, tieIdx.length);
  tieIdx.forEach((k, j) => {
    const P = fr.P[k].clone().addScaledVector(fr.U[k], -0.12);
    ties.setMatrixAt(j, basisMatrix(P, fr.T[k], fr.U[k], fr.R[k]));
  });
  ties.castShadow = true; trackGroup.add(ties);

  // aletas de turbo y frenos
  const fins = [];
  for (let k = 0; k < n; k += 2) if (nodes[k].f & (F.BOOST | F.BRAKE | F.META)) fins.push(k);
  if (fins.length) {
    const finMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.3, 0.8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222 }), fins.length);
    fins.forEach((k, j) => {
      const P = fr.P[k].clone().addScaledVector(fr.U[k], 0.02);
      finMesh.setMatrixAt(j, basisMatrix(P, fr.T[k], fr.U[k], fr.R[k]));
      finMesh.setColorAt(j, new THREE.Color(nodes[k].f & F.BOOST ? 0xffc21e : 0xff4757));
    });
    trackGroup.add(finMesh);
  }

  // soportes (no debajo de loopings ni tramos boca abajo)
  const sup = [];
  for (let k = 8; k < n; k += 12) {
    if (nodes[k].f & (F.STATION | F.META)) continue;
    if (fr.U[k].y < 0.45) continue;
    const base = fr.P[k].clone().addScaledVector(fr.U[k], -0.45);
    if (base.y < 1.2) continue;
    sup.push(base);
  }
  if (sup.length) {
    const sMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 1, 8).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xf1f4f8, roughness: 0.5, metalness: 0.2 }), sup.length * 2);
    const m = new THREE.Matrix4();
    sup.forEach((b, j) => {
      m.compose(V(b.x, 0, b.z), new THREE.Quaternion(), V(1, b.y, 1)); sMesh.setMatrixAt(j * 2, m);
      m.compose(V(b.x, 0, b.z), new THREE.Quaternion(), V(2.2, 0.3, 2.2)); sMesh.setMatrixAt(j * 2 + 1, m);
    });
    sMesh.castShadow = true; trackGroup.add(sMesh);
  }

  // estaciones
  const startMid = Math.floor(STATION.L / 2 / 0.5);
  trackGroup.add(stationMesh(fr.P[startMid], fr.T[startMid], 'SALIDA', 0x2f7cff));
  const metaIdx = []; for (let k = 0; k < n; k++) if (nodes[k].f & F.META) metaIdx.push(k);
  if (metaIdx.length) { const k = metaIdx[Math.floor(metaIdx.length / 2)]; trackGroup.add(stationMesh(fr.P[k], fr.T[k], 'META', 0x20bf6b)); }

  scene.add(trackGroup);

  // cursor al final de la vía
  const e = n - 1;
  cursor.visible = !built.end.closed;
  cursor.matrix.copy(basisMatrix(fr.P[e], fr.T[e], fr.U[e], fr.R[e]));
  cursor.matrixAutoUpdate = false;
  focusGoal = fr.P[e].clone();
  return { end: fr.P[e].clone() };
}

function buildCursor() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x2ee59d, transparent: true, opacity: 0.85, depthTest: false });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 16), mat);
  cone.rotation.x = Math.PI / 2; cone.position.set(0, 1.2, 2.2); g.add(cone);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 8, 32), mat);
  ring.position.set(0, 1.2, 0.4); g.add(ring);
  g.renderOrder = 10;
  g.userData.ring = ring; g.userData.cone = cone;
  return g;
}

export function showGhost(nodes, ok) {
  if (ghost) { scene.remove(ghost); ghost.geometry.dispose(); ghost = null; }
  if (!nodes || nodes.length < 2) return;
  const fr = frames(nodes);
  ghost = tube(fr, 0, nodes.length - 1, 0, 0, 0.35, 8, new THREE.MeshBasicMaterial({ color: ok ? 0x2ee59d : 0xff3040, transparent: true, opacity: 0.55, depthTest: false }));
  ghost.renderOrder = 11; ghost.castShadow = false;
  scene.add(ghost); ghostT = 1.6;
}

// ---------- Tren ----------
function buildCar(front) {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xe8453c, roughness: 0.4, metalness: 0.2 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffd43b, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e2433, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.75, 2.7), red); body.position.y = 0.62; body.castShadow = true; g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.14, 2.72), yellow); stripe.position.y = 0.7; g.add(stripe);
  if (front) {
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 0.9), yellow); nose.position.set(0, 0.55, 1.6); nose.rotation.x = -0.35; nose.castShadow = true; g.add(nose);
  }
  const wheel = new THREE.BoxGeometry(0.3, 0.35, 0.5);
  [[-0.7, -0.9], [0.7, -0.9], [-0.7, 0.9], [0.7, 0.9]].forEach(([x, z]) => { const w = new THREE.Mesh(wheel, dark); w.position.set(x, 0.15, z); g.add(w); });
  const skins = [0xffcc99, 0xe0a878, 0x8d5a3b, 0xf2c6a0];
  const shirts = [0x2f7cff, 0x20bf6b, 0xffffff, 0xa45cff, 0xff9f43, 0x1e2433];
  g.userData.arms = [];
  [-0.55, 0.55].forEach((z, row) => {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 0.18), dark); seat.position.set(0, 1.25, z - 0.35); g.add(seat);
    [-0.38, 0.38].forEach((x, k) => {
      const shirt = new THREE.MeshStandardMaterial({ color: shirts[(row * 2 + k + (front ? 0 : 3)) % shirts.length] });
      const skin = new THREE.MeshStandardMaterial({ color: skins[(row + k * 2 + (front ? 1 : 0)) % skins.length] });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.3), shirt); torso.position.set(x, 1.25, z - 0.1); g.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skin); head.position.set(x, 1.72, z - 0.08); g.add(head);
      if (row === 1) { torso.userData.front = head.userData.front = true; }
      const armGeo = new THREE.BoxGeometry(0.12, 0.55, 0.12).translate(0, 0.25, 0);
      [-1, 1].forEach(side => {
        const arm = new THREE.Mesh(armGeo, skin); arm.position.set(x + side * 0.24, 1.4, z - 0.05);
        if (row === 1) arm.userData.front = true;
        arm.rotation.z = -side * 0.25; arm.rotation.x = 1.2; g.add(arm); g.userData.arms.push({ arm, side });
      });
    });
  });
  // barra de seguridad
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0xc0c7d2, metalness: 0.8, roughness: 0.3 }));
  bar.position.set(0, 1.18, 0.75); g.add(bar);
  g.matrixAutoUpdate = false;
  return g;
}

function placeCar(car, f) {
  const P = V(f.x, f.y, f.z), T = V(f.tx, f.ty, f.tz), U = V(f.ux, f.uy, f.uz), R = V(f.rx, f.ry, f.rz);
  car.matrix.copy(basisMatrix(P, T, U, R));
  car.matrixWorldNeedsUpdate = true;
}

function setArms(car, up, t) {
  for (const { arm, side } of car.userData.arms) {
    const target = up ? 0.15 + Math.sin(t * 9 + side) * 0.12 : 1.25;
    arm.rotation.x += (target - arm.rotation.x) * 0.15;
    arm.rotation.z = -side * (up ? 0.45 : 0.2);
  }
}

// Coloca el tren según la simulación
export function updateTrain(ride, t) {
  const T = ride.T;
  const up = ride.mode === 'fly' || ride.vertS < 0.4 || ride.vertS > 3 || ride.inverted || ride.boosting;
  if (ride.fly) {
    const f = ride.fly, sp = Math.hypot(f.vx, f.vy, f.vz) || 1;
    const Tv = V(f.vx / sp, f.vy / sp, f.vz / sp);
    train.forEach((car, k) => {
      const P = V(f.x, f.y, f.z).addScaledVector(Tv, -k * 3.2);
      P.y = Math.max(0.6, P.y);
      const R = new THREE.Vector3().crossVectors(Tv, V(0, 1, 0)).normalize();
      const U = new THREE.Vector3().crossVectors(R, Tv).normalize();
      if (ride.mode === 'crashed') { U.applyAxisAngle(Tv, 1.2 + k); R.crossVectors(Tv, U); }
      car.matrix.copy(basisMatrix(P, Tv, U, R)); car.matrixWorldNeedsUpdate = true;
      setArms(car, true, t);
    });
    return;
  }
  train.forEach((car, k) => {
    const s = Math.max(0.2, carS(ride, k));
    placeCar(car, frameAt(T, s));
    setArms(car, up, t + k);
  });
}

export function parkTrain(T) {
  train.forEach((car, k) => { placeCar(car, frameAt(T, Math.max(0.2, 12.5 - k * 3.2))); setArms(car, false, 0); car.userData.arms.forEach(a => a.arm.rotation.x = 1.25); });
}

export function trainVisible(v) { train.forEach(c => c.visible = v); }

// ---------- Partículas ----------
export function burst(x, y, z, count, colors, speed) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, sp = speed * (0.4 + Math.random() * 0.6);
    pData.push({ x, y, z, vx: Math.cos(a) * Math.cos(b) * sp, vy: Math.abs(Math.sin(b)) * sp + speed * 0.3, vz: Math.sin(a) * Math.cos(b) * sp, life: 1.5 + Math.random(), c: new THREE.Color(colors[i % colors.length]) });
  }
}
function updateParticles(dt) {
  pData = pData.filter(p => (p.life -= dt) > 0);
  for (const p of pData) { p.vy -= 12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.1) { p.y = 0.1; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; } }
  const pos = new Float32Array(pData.length * 3), col = new Float32Array(pData.length * 3);
  pData.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; col[i * 3] = p.c.r; col[i * 3 + 1] = p.c.g; col[i * 3 + 2] = p.c.b; });
  particles.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  particles.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

// ---------- Cámaras ----------
export function setCamMode(mode) {
  camMode = mode;
  if (mode !== 'ride') train[0].traverse(o => { if (o.userData.front) o.visible = true; });
  controls.enabled = mode === 'build' || (mode === 'ride' && rideCam === 'orbit');
  cursor.visible = mode === 'build' && cursor.visible;
  if (mode !== 'ride') { camera.up.set(0, 1, 0); camera.fov = 55; camera.updateProjectionMatrix(); }
  chasePos = null;
}
export function cycleRideCam() {
  rideCam = rideCam === 'pov' ? 'chase' : rideCam === 'chase' ? 'orbit' : 'pov';
  camera.up.set(0, 1, 0); chasePos = null;
  controls.enabled = rideCam === 'orbit';
  if (rideCam === 'orbit') { camera.fov = 55; camera.updateProjectionMatrix(); }
  return rideCam;
}
export function getRideCam() { return rideCam; }
export function setCursorVisible(v) { cursor.visible = v; }

export function focusOn(p, jump) {
  if (!p) return;
  const delta = p.clone().sub(controls.target);
  if (jump) { controls.target.copy(p); camera.position.add(delta); focusGoal = null; }
  else focusGoal = p.clone();
}
export function resetView(center, size) {
  const c = center || V(0, 5, 20), d = Math.max(40, (size || 60) * 1.1);
  controls.target.copy(c);
  camera.position.set(c.x - d * 0.75, c.y + d * 0.6, c.z - d * 0.55);
  focusGoal = null;
}

export function setDemo(center, radius) { demoCenter = center.clone(); demoRadius = radius; }

let lastP = null;
export function render(dt, opts) {
  opts = opts || {};
  const t = performance.now() / 1000;
  // cursor que late
  if (cursor.visible) { const s = 1 + Math.sin(t * 5) * 0.12; cursor.userData.ring.scale.setScalar(s); cursor.userData.cone.position.z = 2.2 + Math.sin(t * 5) * 0.3; }
  if (ghost) { ghostT -= dt; ghost.material.opacity = Math.max(0, Math.min(0.55, ghostT)); if (ghostT <= 0) { scene.remove(ghost); ghost.geometry.dispose(); ghost = null; } }

  if (camMode === 'build') {
    if (focusGoal) {
      const k = 1 - Math.exp(-dt * 4);
      const delta = focusGoal.clone().sub(controls.target).multiplyScalar(k);
      controls.target.add(delta); camera.position.add(delta);
      if (focusGoal.distanceTo(controls.target) < 0.05) focusGoal = null;
    }
    controls.update();
  } else if (camMode === 'demo') {
    demoAngle += dt * 0.07;
    camera.position.set(demoCenter.x + Math.cos(demoAngle) * demoRadius, demoCenter.y + demoRadius * 0.38, demoCenter.z + Math.sin(demoAngle) * demoRadius);
    camera.lookAt(demoCenter);
  } else if (camMode === 'ride' && opts.ride) {
    const ride = opts.ride, T = ride.T;
    let P, Tv, U;
    if (ride.fly) {
      const f = ride.fly, sp = Math.hypot(f.vx, f.vy, f.vz) || 1;
      P = V(f.x, f.y, f.z); Tv = V(f.vx / sp, f.vy / sp, f.vz / sp); U = V(0, 1, 0);
    } else {
      const fr = frameAt(T, Math.max(0.2, ride.s));
      P = V(fr.x, fr.y, fr.z); Tv = V(fr.tx, fr.ty, fr.tz); U = V(fr.ux, fr.uy, fr.uz);
    }
    const speed = Math.abs(ride.v);
    const pov = rideCam === 'pov' && ride.mode !== 'crashed';
    train[0].traverse(o => { if (o.userData.front) o.visible = !pov; });
    if (pov) {
      camUp.lerp(U, 1 - Math.exp(-dt * 10)).normalize();
      const eye = P.clone().addScaledVector(U, 1.75).addScaledVector(Tv, 0.45);
      camera.position.copy(eye);
      camera.up.copy(camUp);
      camera.lookAt(eye.clone().addScaledVector(Tv, 10).addScaledVector(U, -0.6));
      const fov = Math.min(92, 68 + speed * 0.6);
      if (Math.abs(camera.fov - fov) > 0.3) { camera.fov += (fov - camera.fov) * 0.1; camera.updateProjectionMatrix(); }
    } else if (rideCam === 'chase' || ride.mode === 'crashed') {
      const back = ride.fly ? P.clone() : (() => { const f = frameAt(T, Math.max(0.2, carS(ride, 2))); return V(f.x, f.y, f.z); })();
      const want = back.clone().addScaledVector(Tv, -11).add(V(0, 5, 0));
      if (want.y < 2) want.y = 2;
      if (!chasePos) chasePos = want.clone();
      chasePos.lerp(want, 1 - Math.exp(-dt * 3.5));
      camera.position.copy(chasePos);
      camera.up.set(0, 1, 0);
      camera.lookAt(P);
      if (Math.abs(camera.fov - 60) > 0.3) { camera.fov += (60 - camera.fov) * 0.1; camera.updateProjectionMatrix(); }
    } else {
      // órbita libre siguiendo al tren
      if (lastP) { const d = P.clone().sub(lastP); controls.target.add(d); camera.position.add(d); }
      controls.update();
    }
    lastP = P;
  }
  // la sombra sigue a lo que se mira
  const tgt = camMode === 'build' || camMode === 'demo' ? (camMode === 'demo' ? demoCenter : controls.target) : camera.position;
  sun.position.set(tgt.x + 80, 140, tgt.z + 50); sun.target.position.set(tgt.x, 0, tgt.z); sun.target.updateMatrixWorld();
  sky.position.copy(camera.position);
  updateParticles(dt);
  renderer.render(scene, camera);
}

export function resetRideCamState() { lastP = null; chasePos = null; camUp.set(0, 1, 0); }
export function getControls() { return controls; }
export { THREE };
