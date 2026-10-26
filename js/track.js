/* =========================================================
   AGÁRRATE 3D · Vías por piezas
   Sin dependencias: se puede probar en Node.
   Ejes: Y hacia arriba. Rumbo h = 0 mira hacia +Z, h crece al girar a la izquierda.
   Peralte b > 0 = la vía se inclina hacia la derecha.
   ========================================================= */

export const STEP = 0.5;            // separación entre puntos de la vía (m)
export const DEG = Math.PI / 180;
export const PITCH_STEP = 25 * DEG; // cada pieza de subir/bajar cambia 25°
export const MAX_PITCH_LEVEL = 3;   // hasta 75°
export const HEART = 1.1;            // altura del pecho del pasajero sobre la vía
export const LIMIT_XZ = 260, LIMIT_Y = 95;

export const F = { CHAIN: 1, BOOST: 2, BRAKE: 4, STATION: 8, META: 16 };

const R_WIDE = 22, R_TIGHT = 13;

// Catálogo de piezas
export const PIECES = {
  straight: { name: 'Recta', L: 8 },
  curveL: { name: 'Curva', L: R_WIDE * Math.PI / 2, turn: 1, side: 'izq' },
  curveR: { name: 'Curva', L: R_WIDE * Math.PI / 2, turn: -1, side: 'der' },
  tightL: { name: 'Cerrada', L: R_TIGHT * Math.PI / 2, turn: 1, side: 'izq' },
  tightR: { name: 'Cerrada', L: R_TIGHT * Math.PI / 2, turn: -1, side: 'der' },
  up: { name: 'Subir', L: 16, pitch: 1 },
  down: { name: 'Bajar', L: 16, pitch: -1 },
  loop: { name: 'Looping', L: 80, inversion: true },
  rollL: { name: 'Tirabuzón', L: 26, roll: -1, inversion: true, side: 'izq' },
  rollR: { name: 'Tirabuzón', L: 26, roll: 1, inversion: true, side: 'der' },
  boost: { name: 'Turbo', L: 12 },
  brake: { name: 'Frenos', L: 8 },
  meta: { name: 'Meta', L: 16 }
};

export const STATION = { x: 0, y: 1.6, z: -10, L: 16 };

// ---------- vectores ----------
const tvec = (h, p) => [Math.sin(h) * Math.cos(p), Math.sin(p), Math.cos(h) * Math.cos(p)];
const ubase = (h, p) => [-Math.sin(h) * Math.sin(p), Math.cos(p), -Math.cos(h) * Math.sin(p)];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const smooth = u => u * u * (3 - 2 * u);
const lerp = (a, b, t) => a + (b - a) * t;
const normAngle = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; };

function bankedUp(h, p, b) {
  const T = tvec(h, p), U = ubase(h, p), R = cross(T, U);
  const c = Math.cos(b), s = Math.sin(b);
  return [U[0] * c + R[0] * s, U[1] * c + R[1] * s, U[2] * c + R[2] * s];
}

// Recorre una pieza a pasos pequeños sumando la dirección de avance
function integrate(st, L, fn, flags) {
  const N = Math.max(2, Math.ceil(L / STEP));
  const ds = L / N;
  let cx = st.x, cy = st.y, cz = st.z;
  const nodes = [];
  for (let i = 1; i <= N; i++) {
    const m = fn((i - 0.5) / N);
    const T = tvec(m.h, m.p);
    cx += T[0] * ds; cy += T[1] * ds; cz += T[2] * ds;
    const q = fn(i / N);
    const U = bankedUp(q.h, q.p, q.b), Ub = ubase(q.h, q.p);
    const off = q.off || [0, 0, 0];
    // El peralte gira la vía alrededor del pecho del pasajero (no del raíl): así no da tirones
    const hx = HEART * (Ub[0] - U[0]), hy = HEART * (Ub[1] - U[1]), hz = HEART * (Ub[2] - U[2]);
    nodes.push({ x: cx + off[0] + hx, y: cy + off[1] + hy, z: cz + off[2] + hz, ux: U[0], uy: U[1], uz: U[2], f: flags });
  }
  const e = fn(1);
  const eo = e.off || [0, 0, 0];
  return { nodes, end: { x: cx + eo[0], y: cy + eo[1], z: cz + eo[2], h: normAngle(e.h), pl: st.pl + (e.dpl || 0), b: normAngle(e.b), closed: !!e.closed } };
}

export function startState() {
  return { x: STATION.x, y: STATION.y, z: STATION.z + STATION.L, h: 0, pl: 0, b: 0, closed: false };
}

export function stationNodes() {
  const st = { x: STATION.x, y: STATION.y, z: STATION.z, h: 0, pl: 0, b: 0 };
  const r = integrate(st, STATION.L, () => ({ h: 0, p: 0, b: 0 }), F.STATION);
  r.nodes.unshift({ x: st.x, y: st.y, z: st.z, ux: 0, uy: 1, uz: 0, f: F.STATION });
  return r.nodes;
}

// Curvatura máxima (1/m) de una curva con el giro suavizado
export function curvePeakK(type) { const P = PIECES[type]; return 1.5 * (Math.PI / 2) / P.L; }

// ¿Se puede poner esta pieza aquí? (reglas de forma, no de choques)
export function shapeCheck(type, st) {
  const P = PIECES[type];
  if (!P) return 'tipo';
  if (st.closed) return 'cerrada';
  if (P.turn && Math.abs(st.pl) > 1) return 'curva_pendiente';
  if (P.pitch && Math.abs(st.pl + P.pitch) > MAX_PITCH_LEVEL) return 'pendiente_max';
  if ((type === 'loop' || P.roll) && st.pl !== 0) return 'plano';
  if ((type === 'loop' || P.roll) && Math.abs(st.b) > 5 * DEG) return 'sin_peralte';
  if (type === 'meta' && st.pl !== 0) return 'meta_plana';
  return null;
}

/* Genera los puntos de una pieza.
   spec = { t: tipo, c: cadena (0/1), bk: peralte manual en grados (null = automático), ab: peralte automático calculado } */
export function genPiece(spec, st) {
  const P = PIECES[spec.t];
  const err = shapeCheck(spec.t, st);
  if (err) return { error: err };
  const h0 = st.h, p0 = st.pl * PITCH_STEP, b0 = st.b;
  let flags = spec.c ? F.CHAIN : 0;
  const manual = spec.bk !== null && spec.bk !== undefined;
  const B = manual ? spec.bk * DEG : 0;
  const bankTo = (u, target) => lerp(b0, target, smooth(u));

  if (P.turn) {
    const dir = P.turn;
    // giro suave: la curva empieza y acaba recta (el giro se reparte con smoothstep)
    let bankFn;
    if (manual) bankFn = u => bankTo(u, B);
    else {
      const peak = (spec.ab || 0) * DEG * -dir; // curva a la derecha => peralte positivo
      const tp = Math.tan(peak);
      bankFn = u => {
        const w = 4 * u * (1 - u);              // 0 en los extremos, 1 en el centro
        const base = lerp(b0, 0, smooth(Math.min(1, u / 0.25)));
        return base + Math.atan(tp * w);
      };
    }
    return integrate(st, P.L, u => ({ h: h0 + dir * (Math.PI / 2) * smooth(u), p: p0, b: bankFn(u) }), flags);
  }
  if (P.pitch) {
    const target = manual ? B : 0;
    return integrate(st, P.L, u => ({ h: h0, p: p0 + P.pitch * PITCH_STEP * u, b: bankTo(u, target), dpl: P.pitch }), flags);
  }
  if (spec.t === 'loop') {
    const a = 0.35, side = 3.2;
    const R0 = cross(tvec(h0, 0), ubase(h0, 0));
    return integrate(st, P.L, u => {
      const k = side * smooth(u);
      return { h: h0, p: 2 * Math.PI * (u - a * Math.sin(2 * Math.PI * u) / (2 * Math.PI)), b: 0, off: [R0[0] * k, R0[1] * k, R0[2] * k] };
    }, flags);
  }
  if (P.roll) {
    // tirabuzón: la vía da una vuelta completa alrededor del pasajero
    return integrate(st, P.L, u => ({ h: h0, p: p0, b: b0 + P.roll * 2 * Math.PI * smooth(u) }), flags);
  }
  if (spec.t === 'boost') flags |= F.BOOST;
  if (spec.t === 'brake') flags |= F.BRAKE;
  if (spec.t === 'meta') {
    return integrate(st, P.L, u => ({ h: h0, p: p0, b: bankTo(u, 0), closed: true }), F.META);
  }
  const target = manual ? B : 0;
  return integrate(st, P.L, u => ({ h: h0, p: p0, b: bankTo(u, target) }), flags);
}

// ---------- Choques ----------
function hashKey(x, y, z) { return ((Math.floor(x / 4) * 73856093) ^ (Math.floor(y / 4) * 19349663) ^ (Math.floor(z / 4) * 83492791)); }

export function makeIndex(nodes) {
  const map = new Map();
  nodes.forEach((n, i) => {
    const k = hashKey(n.x, n.y, n.z);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(i);
  });
  return map;
}

function near(index, nodes, x, y, z, r, maxIdx) {
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    const list = index.get(hashKey(x + dx * 4, y + dy * 4, z + dz * 4));
    if (!list) continue;
    for (const i of list) {
      if (i > maxIdx) continue;
      const n = nodes[i];
      if ((n.x - x) ** 2 + (n.y - y) ** 2 + (n.z - z) ** 2 < r * r) return true;
    }
  }
  return false;
}

// Comprueba que los puntos nuevos no se metan en el suelo, árboles u otra vía
export function validate(newNodes, existing, index, level) {
  const maxIdx = existing.length - 1 - 24; // los últimos 12 m sí pueden estar cerca
  const obstacles = (level && level.obstacles) || [];
  for (let i = 0; i < newNodes.length; i++) {
    const n = newNodes[i];
    if (Math.abs(n.x) > LIMIT_XZ || Math.abs(n.z) > LIMIT_XZ || n.y > LIMIT_Y) return 'limite';
    if (n.y < 1.0) return 'suelo';
    if (n.uy < -0.2 && n.y < 3.6) return 'suelo';
    for (const o of obstacles) {
      if ((n.x - o.x) ** 2 + (n.z - o.z) ** 2 < (o.r + 1.6) ** 2 && n.y < o.h + 1.5) return 'arbol';
    }
    // andén de la estación
    if (n.y < 5 && n.x > 1.2 && n.x < 8.5 && n.z > STATION.z - 2 && n.z < STATION.z + STATION.L + 2) return 'estacion';
    if (i >= 6 && maxIdx > 0 && near(index, existing, n.x, n.y, n.z, 2.6, maxIdx)) return 'choque';
  }
  return null;
}

// ---------- Montar el circuito entero a partir de la lista de piezas ----------
export function build(specs, level) {
  const nodes = stationNodes();
  const pieces = [];
  let st = startState();
  for (let k = 0; k < specs.length; k++) {
    const g = genPiece(specs[k], st);
    if (g.error) return { nodes, pieces, end: st, broken: k, error: g.error };
    const start = nodes.length;
    for (const n of g.nodes) { n.pi = k; nodes.push(n); }
    pieces.push({ start, end: nodes.length - 1, t: specs[k].t });
    st = g.end;
  }
  return { nodes, pieces, end: st };
}

// Prueba a añadir una pieza: devuelve los puntos o el motivo por el que no cabe
export function tryAdd(built, spec, level, index) {
  const g = genPiece(spec, built.end);
  if (g.error) return { error: g.error };
  const idx = index || makeIndex(built.nodes);
  const err = validate(g.nodes, built.nodes, idx, level);
  if (err) return { error: err, nodes: g.nodes };
  return { nodes: g.nodes, end: g.end };
}

export const ERRORS = {
  cerrada: 'Ya has puesto la meta. Deshaz la meta para seguir construyendo.',
  curva_pendiente: 'Las curvas solo se pueden poner con la vía plana o poco inclinada.',
  pendiente_max: 'No se puede inclinar más.',
  plano: 'Para esta pieza la vía tiene que estar plana (ni subiendo ni bajando).',
  sin_peralte: 'Para esta pieza la vía tiene que estar sin peralte.',
  meta_plana: 'La meta tiene que ir en plano.',
  suelo: '¡Se mete en el suelo! Sube antes la vía.',
  arbol: 'Hay un árbol en medio.',
  choque: 'Chocaría con otra parte de la vía.',
  estacion: 'Choca con la estación.',
  limite: 'Te sales del parque.',
  presupuesto: 'No te quedan piezas en este reto.'
};
