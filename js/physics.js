/* =========================================================
   AGÁRRATE 3D · Física del tren, fuerzas G y notas
   ========================================================= */
import { F, PIECES } from './track.js';

export const G = 9.81;
const DT = 1 / 240;
const CAR_GAP = 3.2, CARS = 3;
const CHAIN_V = 6, STATION_V = 2.5, BOOST_ACC = 9, BOOST_MAX = 38, BRAKE_V = 7;
export const LIMITS = { vertMax: 5.5, vertMin: -1.6, lat: 1.8 };

// Prepara los arrays que usa la simulación
export function prepare(nodes) {
  const n = nodes.length;
  const A = k => new Float64Array(n);
  const px = A(), py = A(), pz = A(), s = A(), tx = A(), ty = A(), tz = A();
  const ux = A(), uy = A(), uz = A(), rx = A(), ry = A(), rz = A(), kx = A(), ky = A(), kz = A();
  const fl = new Uint8Array(n);
  for (let i = 0; i < n; i++) { px[i] = nodes[i].x; py[i] = nodes[i].y; pz[i] = nodes[i].z; fl[i] = nodes[i].f || 0; }
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1], pz[i] - pz[i - 1]);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let x = px[b] - px[a], y = py[b] - py[a], z = pz[b] - pz[a];
    const L = Math.hypot(x, y, z) || 1; tx[i] = x / L; ty[i] = y / L; tz[i] = z / L;
    // arriba ortogonal a la tangente
    let u0 = nodes[i].ux, u1 = nodes[i].uy, u2 = nodes[i].uz;
    const d = u0 * tx[i] + u1 * ty[i] + u2 * tz[i];
    u0 -= d * tx[i]; u1 -= d * ty[i]; u2 -= d * tz[i];
    const UL = Math.hypot(u0, u1, u2) || 1; ux[i] = u0 / UL; uy[i] = u1 / UL; uz[i] = u2 / UL;
    rx[i] = ty[i] * uz[i] - tz[i] * uy[i]; ry[i] = tz[i] * ux[i] - tx[i] * uz[i]; rz[i] = tx[i] * uy[i] - ty[i] * ux[i];
  }
  // Las fuerzas G se miden en el pecho del pasajero ("línea del corazón"), 1,1 m por encima de la vía
  const HEART = 1.1;
  const hx = A(), hy = A(), hz = A(), hs = A(), htx = A(), hty = A(), htz = A(), rho = A();
  for (let i = 0; i < n; i++) { hx[i] = px[i] + ux[i] * HEART; hy[i] = py[i] + uy[i] * HEART; hz[i] = pz[i] + uz[i] * HEART; }
  for (let i = 1; i < n; i++) hs[i] = hs[i - 1] + Math.hypot(hx[i] - hx[i - 1], hy[i] - hy[i - 1], hz[i] - hz[i - 1]);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let x = hx[b] - hx[a], y = hy[b] - hy[a], z = hz[b] - hz[a];
    const L = Math.hypot(x, y, z) || 1; htx[i] = x / L; hty[i] = y / L; htz[i] = z / L;
    rho[i] = (hs[b] - hs[a]) / ((s[b] - s[a]) || 1);
  }
  // curvatura del recorrido del pecho (cambio de dirección por metro), suavizada
  const cx = A(), cy = A(), cz = A();
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const ds = hs[b] - hs[a] || 1;
    cx[i] = (htx[b] - htx[a]) / ds; cy[i] = (hty[b] - hty[a]) / ds; cz[i] = (htz[b] - htz[a]) / ds;
  }
  for (let i = 0; i < n; i++) {
    let sx = 0, sy = 0, sz = 0, c = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) { sx += cx[j]; sy += cy[j]; sz += cz[j]; c++; }
    kx[i] = sx / c; ky[i] = sy / c; kz[i] = sz / c;
  }
  return { n, px, py, pz, s, tx, ty, tz, ux, uy, uz, rx, ry, rz, kx, ky, kz, fl, rho, len: s[n - 1] };
}

function locate(T, s) {
  if (s <= 0) return [0, 0];
  if (s >= T.len) return [T.n - 2, 1];
  let lo = 0, hi = T.n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T.s[m] <= s) lo = m; else hi = m; }
  return [lo, (s - T.s[lo]) / ((T.s[lo + 1] - T.s[lo]) || 1)];
}

// Posición y orientación en un punto de la vía (para dibujar)
export function frameAt(T, s) {
  const [i, f] = locate(T, s), j = i + 1, g = 1 - f;
  const L = (a, b) => a[i] * g + a[j] * f;
  return {
    x: L(T.px, null), y: L(T.py), z: L(T.pz),
    tx: L(T.tx), ty: L(T.ty), tz: L(T.tz),
    ux: L(T.ux), uy: L(T.uy), uz: L(T.uz),
    rx: L(T.rx), ry: L(T.ry), rz: L(T.rz),
    kx: L(T.kx), ky: L(T.ky), kz: L(T.kz), rho: L(T.rho), fl: T.fl[f < 0.5 ? i : j]
  };
}
function lerpArr(a, i, j, g, f) { return a[i] * g + a[j] * f; }
function sample(T, s, key) { const [i, f] = locate(T, s); return lerpArr(T[key], i, i + 1, 1 - f, f); }
function flagAt(T, s) { const [i, f] = locate(T, s); return T.fl[f < 0.5 ? i : i + 1]; }

export function createRide(T, opts) {
  opts = opts || {};
  return {
    T, s: 12.5, v: 0, t: 0, mode: 'track', acc: 0, ignoreSusto: !!opts.ignoreSusto,
    vert: 1, lat: 0, vertS: 1, latS: 0, susto: 0,
    stats: { maxV: 0, maxVert: 1, minVert: 1, maxLat: 0, latSum: 0, airtime: 0, inversions: 0, maxY: 0, boostT: 0 },
    inverted: false, airRun: 0, stuckT: 0, events: [], result: null,
    fly: null, onChain: false, boosting: false
  };
}

function finish(r, ok, reason) {
  if (r.result) return;
  r.result = { ok, reason, t: r.t };
  r.events.push({ type: ok ? 'finish' : 'fail', reason });
}

export function carS(r, k) { return r.s - k * CAR_GAP; }

function stepOnce(r) {
  const T = r.T;
  if (r.mode === 'fly') {
    const f = r.fly;
    f.vy -= G * DT; f.x += f.vx * DT; f.y += f.vy * DT; f.z += f.vz * DT; r.t += DT;
    if (f.y <= 0.6) { f.y = 0.6; r.mode = 'crashed'; finish(r, false, 'end'); r.events.push({ type: 'crash' }); }
    return;
  }
  if (r.mode !== 'track') return;
  r.t += DT;
  let a = 0, chain = false, station = false;
  for (let k = 0; k < CARS; k++) {
    const sk = Math.max(0, carS(r, k));
    a += -G * sample(T, sk, 'ty') / CARS;
    const fl = flagAt(T, sk);
    if (fl & F.CHAIN) chain = true;
    if (fl & F.STATION) station = true;
  }
  const ff = flagAt(T, Math.max(0, r.s));
  const v = r.v, sg = v > 0 ? 1 : v < 0 ? -1 : 0;
  a -= sg * (0.12 + 0.00085 * v * v);
  r.boosting = false;
  if (ff & F.BOOST && v < BOOST_MAX && !r.done) { a += BOOST_ACC; r.boosting = true; r.stats.boostT += DT; }
  if (ff & F.BRAKE && v > BRAKE_V) a -= 14;
  if (ff & F.META) {
    if (!r.done) { r.done = true; }
    if (Math.abs(v) < 0.4) { r.v = 0; if (!r.result) finish(r, true, 'meta'); return; }
    const left = Math.max(0.5, T.len - r.s - 1.5);
    a = -sg * Math.max(6.5, v * v / (2 * left));
  }
  r.onChain = false;
  if ((chain && !r.done) || (station && !r.done && r.s < 30)) {
    const target = chain ? CHAIN_V : STATION_V;
    if (r.v < target) {
      r.onChain = chain;
      r.v += (target - r.v) * Math.min(1, 6 * DT) + 0.5 * DT;
      a = 0;
    }
  }
  r.v += a * DT;
  r.s += r.v * DT;

  // fin de la vía sin meta: ¡sale volando!
  if (r.s > T.len) {
    const fr = frameAt(T, T.len);
    r.mode = 'fly';
    r.fly = { x: fr.x, y: fr.y, z: fr.z, vx: fr.tx * r.v, vy: fr.ty * r.v, vz: fr.tz * r.v };
    r.events.push({ type: 'launch' });
    return;
  }
  // vuelve hacia atrás hasta la estación
  if (r.s < 6 && r.v < 0 && r.t > 2) { r.s = 6; r.v = 0; finish(r, false, 'stall'); r.mode = 'stopped'; return; }

  // Fuerzas G en el vagón del medio
  const sm = Math.max(0, carS(r, 1));
  const fr = frameAt(T, sm);
  const vm = r.v * fr.rho, v2 = vm * vm;
  const fx = v2 * fr.kx + a * fr.tx, fy = v2 * fr.ky + a * fr.ty + G, fz = v2 * fr.kz + a * fr.tz;
  r.vert = (fx * fr.ux + fy * fr.uy + fz * fr.uz) / G;
  r.lat = (fx * fr.rx + fy * fr.ry + fz * fr.rz) / G;
  const k = Math.min(1, DT / 0.08);
  r.vertS += (r.vert - r.vertS) * k; r.latS += (r.lat - r.latS) * k;

  const st = r.stats;
  const sp = Math.abs(r.v);
  if (sp > st.maxV) st.maxV = sp;
  if (!station) {
    if (r.vertS > st.maxVert) st.maxVert = r.vertS;
    if (r.vertS < st.minVert) st.minVert = r.vertS;
    if (Math.abs(r.latS) > st.maxLat) st.maxLat = Math.abs(r.latS);
    st.latSum += Math.abs(r.latS) * DT;
  }
  const yF = sample(T, Math.max(0, r.s), 'py');
  if (yF > st.maxY) st.maxY = yF;

  // airtime (sensación de flotar)
  if (r.vertS < 0.25 && sp > 3 && !station && !r.done) {
    st.airtime += DT; r.airRun += DT;
    if (r.airRun > 0.35 && !r.airEvent) { r.airEvent = true; r.events.push({ type: 'airtime' }); }
  } else { r.airRun = 0; r.airEvent = false; }

  // vueltas boca abajo
  if (!r.inverted && fr.uy < -0.3) { r.inverted = true; st.inversions++; r.events.push({ type: 'inversion', n: st.inversions }); }
  if (r.inverted && fr.uy > 0.2) r.inverted = false;

  // susto: si las fuerzas pasan de lo aguantable, los pasajeros se marean
  let add = 0;
  if (r.vertS > LIMITS.vertMax) add += (r.vertS - LIMITS.vertMax + 0.5) * 0.9;
  if (r.vertS < LIMITS.vertMin) add += (LIMITS.vertMin - r.vertS + 0.5) * 1.2;
  if (Math.abs(r.latS) > LIMITS.lat) add += (Math.abs(r.latS) - LIMITS.lat + 0.4) * 1.2;
  if (add > 0) r.susto += add * DT; else r.susto = Math.max(0, r.susto - 0.06 * DT);
  if (r.susto >= 1 && !r.ignoreSusto) { r.susto = 1; finish(r, false, 'vomit'); r.mode = 'stopped'; return; }

  // atascado
  if (r.v < -0.5 && !station) { r.backT = (r.backT || 0) + DT; if (r.backT > 3) { finish(r, false, 'stall'); r.mode = 'stopped'; return; } }
  if (sp < 0.2 && !r.onChain && !station && !r.done) { r.stuckT += DT; if (r.stuckT > 2) { finish(r, false, 'stall'); r.mode = 'stopped'; } }
  else r.stuckT = 0;
  if (r.t > 300) { finish(r, false, 'time'); r.mode = 'stopped'; }
}

export function step(r, dt) {
  r.acc += Math.min(dt, 0.1);
  while (r.acc >= DT) {
    r.acc -= DT;
    if (r.mode === 'stopped' || r.mode === 'crashed' || (r.result && r.result.ok)) { r.acc = 0; break; }
    stepOnce(r);
  }
}

// Simula de golpe (para notas, peralte automático y tests)
export function simulate(T, opts) {
  const r = createRide(T, opts);
  let guard = 0;
  while (!r.result && r.mode === 'track' && guard++ < 400000) stepOnce(r);
  while (r.mode === 'fly' && guard++ < 500000) stepOnce(r);
  return r;
}

// Velocidad aproximada al final de la vía (para calcular el peralte automático)
export function endSpeed(T) {
  const r = createRide(T, { ignoreSusto: true });
  let guard = 0;
  while (r.mode === 'track' && !r.result && guard++ < 400000) stepOnce(r);
  if (r.mode === 'fly' || r.s >= T.len - 0.5) return Math.max(3, r.fly ? Math.hypot(r.fly.vx, r.fly.vy, r.fly.vz) : r.v);
  // no llega: estimación por energía
  let maxY = 0; for (let i = 0; i < T.n; i++) maxY = Math.max(maxY, T.py[i]);
  const dy = maxY - T.py[T.n - 1];
  return Math.max(3, Math.sqrt(Math.max(0, 2 * G * dy * 0.85)) + 2);
}

// ---------- Datos del circuito ----------
export function trackMetrics(T, specs) {
  let maxY = 0, maxDrop = 0, top = T.py[0], low = T.py[0], drops = 0, counted = false;
  for (let i = 0; i < T.n; i++) {
    const y = T.py[i];
    if (y > maxY) maxY = y;
    if (y > top) { top = y; low = y; counted = false; }
    if (y < low) low = y;
    if (top - low > maxDrop) maxDrop = top - low;
    if (!counted && top - y > 6) { drops++; counted = true; }
    if (counted && y > low + 4) { top = y; low = y; counted = false; }
  }
  let turn = 0;
  const types = new Set();
  for (const sp of specs) {
    const P = PIECES[sp.t];
    if (P.turn) turn += 90;
    types.add(sp.t.replace(/[LR]$/, ''));
    if (sp.c) types.add('chain');
  }
  return { length: T.len, maxY, maxDrop, drops, turn, variety: types.size, pieces: specs.length };
}

// ---------- Notas (0 a 10) ----------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function ratings(stats, m, duration) {
  const kmh = stats.maxV * 3.6;
  const inv = Math.min(stats.inversions, 8);
  const meanLat = duration > 0 ? stats.latSum / duration : 0;
  let intensity = 0.03 * kmh + 0.6 * Math.max(0, stats.maxVert - 1) + 1.6 * stats.maxLat + 0.3 * inv + 1.2 * Math.max(0, -stats.minVert);
  let nausea = 2.6 * stats.maxLat + 9 * meanLat + 0.35 * inv + 0.35 * Math.max(0, stats.maxVert - 3.5);
  let excitement = 0.02 * kmh + 0.6 * inv + 0.7 * Math.min(stats.airtime, 5) + 0.0015 * Math.min(m.length, 1500)
    + 0.03 * Math.min(m.maxDrop, 70) + 0.1 * Math.min(m.variety, 10) + 0.002 * Math.min(m.turn, 1440);
  intensity = clamp(intensity, 0, 10); nausea = clamp(nausea, 0, 10);
  if (intensity > 8) excitement -= (intensity - 8) * 1.3;
  if (nausea > 6.5) excitement -= (nausea - 6.5) * 0.9;
  excitement = clamp(excitement, 0, 10);
  const r1 = x => Math.round(x * 10) / 10;
  return { excitement: r1(excitement), intensity: r1(intensity), nausea: r1(nausea) };
}

export function ratingWord(x) {
  if (x < 2) return 'Muy baja';
  if (x < 4) return 'Baja';
  if (x < 6) return 'Media';
  if (x < 8) return 'Alta';
  if (x < 9.5) return 'Muy alta';
  return '¡Extrema!';
}
