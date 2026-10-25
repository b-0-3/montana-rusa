/* =========================================================
   AGÁRRATE · Motor del juego (física y vías)
   Sin DOM: se puede ejecutar también en Node para tests.
   ========================================================= */
(function (root) {
  'use strict';

  // ---------- Constantes del mundo ----------
  const W = 1600, H = 900, GROUND = 860;
  const GRAV = 520;          // gravedad en px/s²
  const MU = 0.014;          // rozamiento de las ruedas
  const DRAG = 0.00010;      // resistencia del aire
  const BOOST_ACC = 470;     // empuje del turbo
  const BOOST_MAX_V = 1250;  // el turbo deja de empujar a esta velocidad
  const SNAP_DIST = 38;      // distancia para "enganchar" una vía a otra
  const JOIN_EPS = 2.5;      // dos extremos a menos de esto están unidos
  const SPACING = 6;         // separación entre puntos de una vía
  const G_LIMIT = 5;         // a partir de aquí los pasajeros lo pasan mal
  const BOOST_COST = 2;      // el turbo gasta el doble de presupuesto
  const PX_PER_M = 40;       // 40 px = 1 metro
  const DT = 1 / 240;        // paso fijo de la simulación
  const MAX_TIME = 45;       // tiempo máximo de un recorrido

  // ---------- Geometría básica ----------
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function polyLen(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
    return L;
  }

  function resample(pts, spacing) {
    if (pts.length < 2) return pts.map(p => ({ x: p.x, y: p.y }));
    const out = [{ x: pts[0].x, y: pts[0].y }];
    let prev = { x: pts[0].x, y: pts[0].y };
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const cur = pts[i];
      let d = dist(prev, cur);
      while (acc + d >= spacing && d > 0) {
        const t = (spacing - acc) / d;
        const np = { x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t };
        out.push(np);
        prev = np; d = dist(prev, cur); acc = 0;
      }
      acc += d; prev = { x: cur.x, y: cur.y };
    }
    const last = pts[pts.length - 1];
    if (dist(out[out.length - 1], last) > spacing * 0.35) out.push({ x: last.x, y: last.y });
    else out[out.length - 1] = { x: last.x, y: last.y };
    return out;
  }

  function smooth(pts, r, passes) {
    let p = pts;
    for (let k = 0; k < passes; k++) {
      const q = p.map(o => ({ x: o.x, y: o.y }));
      for (let i = 1; i < p.length - 1; i++) {
        const rr = Math.min(r, i, p.length - 1 - i);
        let sx = 0, sy = 0, n = 0;
        for (let j = i - rr; j <= i + rr; j++) { sx += p[j].x; sy += p[j].y; n++; }
        q[i] = { x: sx / n, y: sy / n };
      }
      p = q;
    }
    return p;
  }

  // Limpia un trazo hecho con el dedo: lo suaviza y reparte los puntos
  function cleanStroke(raw) {
    const clamped = raw.map(p => ({
      x: Math.max(0, Math.min(W, p.x)),
      y: Math.max(8, Math.min(GROUND - 8, p.y))
    }));
    let pts = resample(clamped, 4);
    if (pts.length < 3) return pts;
    pts = smooth(pts, 4, 3);
    return resample(pts, SPACING);
  }

  // ---------- Piezas de vía ----------
  let pieceId = 1;

  function buildPiece(pts, kind, opts) {
    opts = opts || {};
    const n = pts.length;
    const x = new Float64Array(n), y = new Float64Array(n), s = new Float64Array(n);
    const tx = new Float64Array(n), ty = new Float64Array(n), k = new Float64Array(n);
    for (let i = 0; i < n; i++) { x[i] = pts[i].x; y[i] = pts[i].y; }
    for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      const dx = x[b] - x[a], dy = y[b] - y[a];
      const L = Math.hypot(dx, dy) || 1;
      tx[i] = dx / L; ty[i] = dy / L;
    }
    // Curvatura = cuánto gira la vía por cada px recorrido
    const th = new Float64Array(n);
    for (let i = 0; i < n; i++) th[i] = Math.atan2(ty[i], tx[i]);
    const raw = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2);
      let d = th[b] - th[a];
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const ds = s[b] - s[a];
      raw[i] = ds > 0 ? d / ds : 0;
    }
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2);
      let sum = 0;
      for (let j = a; j <= b; j++) sum += raw[j];
      k[i] = sum / (b - a + 1);
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      if (x[i] < minX) minX = x[i]; if (x[i] > maxX) maxX = x[i];
      if (y[i] < minY) minY = y[i]; if (y[i] > maxY) maxY = y[i];
    }
    return {
      id: pieceId++, kind, fixed: !!opts.fixed, lockA: !!opts.lockA, lockB: !!opts.lockB,
      n, x, y, s, tx, ty, k, len: s[n - 1], minX, minY, maxX, maxY,
      pts: pts.map(p => ({ x: p.x, y: p.y })),
      cost: opts.cost || 0
    };
  }

  function locate(p, s) {
    if (s <= 0) return { i: 0, f: 0 };
    if (s >= p.len) return { i: p.n - 2, f: 1 };
    let lo = 0, hi = p.n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p.s[m] <= s) lo = m; else hi = m; }
    const seg = p.s[lo + 1] - p.s[lo] || 1;
    return { i: lo, f: (s - p.s[lo]) / seg };
  }

  function sampleAt(p, s) {
    const { i, f } = locate(p, s);
    const j = i + 1, g = 1 - f;
    let tx = p.tx[i] * g + p.tx[j] * f, ty = p.ty[i] * g + p.ty[j] * f;
    const L = Math.hypot(tx, ty) || 1;
    return {
      x: p.x[i] * g + p.x[j] * f, y: p.y[i] * g + p.y[j] * f,
      tx: tx / L, ty: ty / L, k: p.k[i] * g + p.k[j] * f
    };
  }

  // Extremos de una pieza. "out" = dirección hacia fuera de la vía.
  function endpoint(p, end) {
    if (end === 'A') return { x: p.x[0], y: p.y[0], out: { x: -p.tx[0], y: -p.ty[0] } };
    const n = p.n - 1;
    return { x: p.x[n], y: p.y[n], out: { x: p.tx[n], y: p.ty[n] } };
  }

  function isEndFree(state, p, end) {
    const e = endpoint(p, end);
    for (const q of state.pieces) {
      if (q === p) continue;
      if (dist(e, endpoint(q, 'A')) < JOIN_EPS || dist(e, endpoint(q, 'B')) < JOIN_EPS) return false;
    }
    return true;
  }

  function findFreeEnd(state, pt, maxD, exclude) {
    let best = null, bd = maxD;
    for (const p of state.pieces) {
      for (const end of ['A', 'B']) {
        if (end === 'A' && p.lockA) continue;
        if (end === 'B' && p.lockB) continue;
        if (exclude && exclude.piece === p && exclude.end === end) continue;
        const e = endpoint(p, end);
        const d = dist(pt, e);
        if (d < bd && isEndFree(state, p, end)) { bd = d; best = { piece: p, end, x: e.x, y: e.y, out: e.out }; }
      }
    }
    return best;
  }

  // Une suavemente el principio de un trazo a un extremo existente
  function blendStart(pts, anchor) {
    const total = polyLen(pts);
    const L = Math.min(80, total * 0.45);
    let acc = 0, k = 1;
    for (; k < pts.length; k++) { acc += dist(pts[k - 1], pts[k]); if (acc >= L) break; }
    k = Math.min(k, pts.length - 1);
    const P0 = { x: anchor.x, y: anchor.y }, D = anchor.out, Pk = pts[k];
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    let Tx = b.x - a.x, Ty = b.y - a.y; const TL = Math.hypot(Tx, Ty) || 1; Tx /= TL; Ty /= TL;
    const h = dist(P0, Pk) * 0.45;
    const C1 = { x: P0.x + D.x * h, y: P0.y + D.y * h };
    const C2 = { x: Pk.x - Tx * h, y: Pk.y - Ty * h };
    const m = Math.max(4, Math.ceil(dist(P0, Pk) / 3));
    const bez = [];
    for (let i = 0; i < m; i++) {
      const t = i / m, u = 1 - t;
      bez.push({
        x: u * u * u * P0.x + 3 * u * u * t * C1.x + 3 * u * t * t * C2.x + t * t * t * Pk.x,
        y: u * u * u * P0.y + 3 * u * u * t * C1.y + 3 * u * t * t * C2.y + t * t * t * Pk.y
      });
    }
    return bez.concat(pts.slice(k));
  }

  // ---------- Obstáculos ----------
  function insideObstacle(o, x, y, pad) {
    pad = pad || 0;
    if (o.shape === 'circle') return Math.hypot(x - o.x, y - o.y) < o.r + pad;
    return x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad;
  }

  // ---------- Estado de un nivel ----------
  function createState(level) {
    const pieces = [];
    const toPts = arr => arr.map(p => ({ x: p[0], y: p[1] }));
    const start = buildPiece(resample(toPts(level.start), SPACING), 'start', { fixed: true, lockA: true });
    pieces.push(start);
    pieces.push(buildPiece(resample(toPts(level.goal), SPACING), 'goal', { fixed: true, lockB: true }));
    (level.fixed || []).forEach(f => pieces.push(buildPiece(resample(toPts(f), SPACING), 'track', { fixed: true })));
    return { level, pieces, used: 0, history: [] };
  }

  function strokeCost(len, kind) { return len * (kind === 'boost' ? BOOST_COST : 1); }

  // Prepara un trazo (con enganches) sin añadirlo. Sirve para la vista previa.
  function prepareStroke(state, raw, kind, snapDist) {
    const SD = snapDist || SNAP_DIST;
    let pts = cleanStroke(raw);
    if (pts.length < 3 || polyLen(pts) < 24) return { ok: false, reason: 'corto', pts };
    // Si solo las puntas del trazo se meten en una zona prohibida, se recortan
    const obsList = state.level.obstacles || [];
    const isBlocked = p => obsList.some(o => insideObstacle(o, p.x, p.y, 5));
    let i0 = 0, i1 = pts.length - 1;
    while (i0 < i1 && isBlocked(pts[i0])) i0++;
    while (i1 > i0 && isBlocked(pts[i1])) i1--;
    if (i0 > 0 || i1 < pts.length - 1) {
      const trimmed = pts.slice(i0, i1 + 1);
      if (trimmed.length < 3 || polyLen(trimmed) < 24) return { ok: false, reason: 'obstaculo', pts };
      pts = trimmed;
    }
    const a = findFreeEnd(state, pts[0], SD);
    if (a) pts = blendStart(pts, a);
    const lastPt = pts[pts.length - 1];
    const b = findFreeEnd(state, lastPt, SD, a);
    if (b && polyLen(pts) > 60) {
      pts = blendStart(pts.slice().reverse(), b).reverse();
    }
    pts = resample(pts, SPACING);
    if (a) pts[0] = { x: a.x, y: a.y };
    if (b && polyLen(pts) > 60) pts[pts.length - 1] = { x: b.x, y: b.y };
    const len = polyLen(pts);
    const cost = strokeCost(len, kind);
    const obs = state.level.obstacles || [];
    let blocked = false;
    for (const p of pts) {
      for (const o of obs) if (insideObstacle(o, p.x, p.y, 5)) { blocked = true; break; }
      if (blocked) break;
    }
    const budget = state.level.budget;
    if (blocked) return { ok: false, reason: 'obstaculo', pts, cost, snapA: a, snapB: b };
    if (state.used + cost > budget + 0.5) return { ok: false, reason: 'presupuesto', pts, cost, snapA: a, snapB: b };
    return { ok: true, pts, cost, snapA: a, snapB: b };
  }

  function addStroke(state, raw, kind, snapDist) {
    const prep = prepareStroke(state, raw, kind, snapDist);
    if (!prep.ok) return prep;
    const piece = buildPiece(prep.pts, kind, { cost: prep.cost });
    state.pieces.push(piece);
    state.used += prep.cost;
    state.history.push(piece);
    return { ok: true, piece };
  }

  function removePiece(state, piece) {
    const i = state.pieces.indexOf(piece);
    if (i < 0 || piece.fixed) return false;
    state.pieces.splice(i, 1);
    state.used = Math.max(0, state.used - piece.cost);
    const h = state.history.indexOf(piece);
    if (h >= 0) state.history.splice(h, 1);
    return true;
  }

  function undo(state) {
    const p = state.history[state.history.length - 1];
    return p ? removePiece(state, p) : false;
  }

  function clearAll(state) {
    state.pieces = state.pieces.filter(p => p.fixed);
    state.used = 0; state.history = [];
  }

  function pieceAt(state, x, y, maxD) {
    let best = null, bd = maxD || 24;
    for (const p of state.pieces) {
      if (p.fixed) continue;
      if (x < p.minX - bd || x > p.maxX + bd || y < p.minY - bd || y > p.maxY + bd) continue;
      for (let i = 0; i < p.n; i++) {
        const d = Math.hypot(p.x[i] - x, p.y[i] - y);
        if (d < bd) { bd = d; best = p; }
      }
    }
    return best;
  }

  // ---------- Simulación ----------
  function createRun(state) {
    const sp = state.pieces.find(p => p.kind === 'start');
    const s0 = Math.min(40, sp.len * 0.2);
    const sm = sampleAt(sp, s0);
    return {
      mode: 'track', piece: sp, s: s0, v: state.level.startSpeed || 150,
      x: sm.x, y: sm.y, vx: 0, vy: 0, angle: Math.atan2(sm.ty, sm.tx),
      t: 0, stars: new Set(), susto: 0, g: 1, gmax: 1, stuckT: 0, airT: 0,
      lastPiece: null, events: [], result: null, speed: Math.abs(state.level.startSpeed || 150),
      boosting: false, inAir: false
    };
  }

  function finish(run, win, reason) {
    if (run.result) return;
    run.result = { win, reason, stars: run.stars.size, time: run.t, gmax: run.gmax };
    run.mode = win ? 'win' : 'crash';
    run.events.push({ type: win ? 'win' : 'crash', reason, x: run.x, y: run.y });
  }

  function checkStars(state, run) {
    const stars = state.level.stars || [];
    for (let i = 0; i < stars.length; i++) {
      if (run.stars.has(i)) continue;
      if (Math.hypot(stars[i][0] - run.x, stars[i][1] - run.y) < 40) {
        run.stars.add(i);
        run.events.push({ type: 'star', i, x: stars[i][0], y: stars[i][1] });
      }
    }
  }

  function enterPiece(state, run, q, s, v) {
    run.piece = q; run.s = s; run.v = v; run.mode = run.result ? run.mode : 'track';
    if (q.kind === 'goal') finish(run, true, 'meta');
  }

  function trackStep(state, run, dt) {
    const p = run.piece;
    const sm = sampleAt(p, run.s);
    const v = run.v;
    const gN = (v * v * sm.k - GRAV * sm.tx) / GRAV;
    const gAbs = Math.abs(gN);
    run.g += (gAbs - run.g) * Math.min(1, dt * 10);
    if (run.g > run.gmax) run.gmax = run.g;

    let a = GRAV * sm.ty;
    const sgn = v > 0 ? 1 : v < 0 ? -1 : 0;
    a -= sgn * (MU * GRAV * Math.max(0.5, gAbs) + DRAG * v * v);
    run.boosting = false;
    if (p.kind === 'boost' && run.mode === 'track' && v < BOOST_MAX_V) { a += BOOST_ACC; run.boosting = true; }
    if (run.mode === 'win') {
      // frenos de la estación
      const brake = 900;
      if (Math.abs(v) <= brake * dt) { run.v = 0; a = 0; } else a = -sgn * brake;
    }
    run.v += a * dt;
    run.s += run.v * dt;

    // Final de la pieza: pasar a la siguiente o salir volando
    let guard = 0;
    while ((run.s < 0 || run.s > run.piece.len) && guard++ < 4) {
      const cur = run.piece;
      const end = run.s > cur.len ? 'B' : 'A';
      if (run.mode === 'win') { run.s = Math.max(0, Math.min(cur.len, run.s)); run.v = 0; break; }
      const E = endpoint(cur, end);
      const over = end === 'B' ? run.s - cur.len : -run.s;
      const speed = Math.abs(run.v);
      const dirOut = E.out;
      let next = null;
      for (const q of state.pieces) {
        if (q === cur) continue;
        const qa = endpoint(q, 'A'), qb = endpoint(q, 'B');
        if (dist(E, qa) < JOIN_EPS) { next = { q, s: Math.min(over, q.len), v: speed, dir: { x: q.tx[0], y: q.ty[0] } }; break; }
        if (dist(E, qb) < JOIN_EPS) { next = { q, s: Math.max(0, q.len - over), v: -speed, dir: { x: -q.tx[q.n - 1], y: -q.ty[q.n - 1] } }; break; }
      }
      if (next) {
        if (dirOut.x * next.dir.x + dirOut.y * next.dir.y < 0.3) { run.x = E.x; run.y = E.y; finish(run, false, 'kink'); return; }
        enterPiece(state, run, next.q, next.s, next.v);
      } else {
        run.mode = 'air'; run.inAir = true; run.airT = 0; run.lastPiece = cur;
        run.x = E.x; run.y = E.y; run.vx = dirOut.x * speed; run.vy = dirOut.y * speed;
        run.events.push({ type: 'launch', x: E.x, y: E.y });
        return;
      }
    }
    const s2 = sampleAt(run.piece, run.s);
    run.x = s2.x; run.y = s2.y;
    run.angle = Math.atan2(s2.ty, s2.tx) + (run.v < 0 ? Math.PI : 0);
    run.tx = s2.tx; run.ty = s2.ty;
    run.speed = Math.abs(run.v);

    if (run.mode === 'track') {
      // Susto: si la G pasa del límite, los pasajeros se agobian
      if (run.g > G_LIMIT) run.susto += (run.g - G_LIMIT + 0.8) * dt * 0.9;
      else run.susto = Math.max(0, run.susto - dt * 0.12);
      if (run.susto >= 1) { run.susto = 1; finish(run, false, 'g'); return; }
      if (Math.abs(run.v) < 10) run.stuckT += dt; else run.stuckT = 0;
      if (run.stuckT > 1.6) finish(run, false, 'stuck');
    }
  }

  function segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-9) return null;
    const qx = cx - ax, qy = cy - ay;
    const t = (qx * sy - qy * sx) / den;
    const u = (qx * ry - qy * rx) / den;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { t, u };
  }

  function airStep(state, run, dt) {
    run.vy += GRAV * dt;
    const sp = Math.hypot(run.vx, run.vy);
    run.vx -= run.vx * DRAG * sp * dt; run.vy -= run.vy * DRAG * sp * dt;
    const nx = run.x + run.vx * dt, ny = run.y + run.vy * dt;
    run.airT += dt;
    run.g += (0 - run.g) * Math.min(1, dt * 10);

    let best = null;
    const minX = Math.min(run.x, nx) - 2, maxX = Math.max(run.x, nx) + 2;
    const minY = Math.min(run.y, ny) - 2, maxY = Math.max(run.y, ny) + 2;
    for (const p of state.pieces) {
      if (p === run.lastPiece && run.airT < 0.15) continue;
      if (maxX < p.minX || minX > p.maxX || maxY < p.minY || minY > p.maxY) continue;
      for (let i = 0; i < p.n - 1; i++) {
        const sx0 = p.x[i], sy0 = p.y[i], sx1 = p.x[i + 1], sy1 = p.y[i + 1];
        if (Math.max(sx0, sx1) < minX || Math.min(sx0, sx1) > maxX || Math.max(sy0, sy1) < minY || Math.min(sy0, sy1) > maxY) continue;
        const hit = segIntersect(run.x, run.y, nx, ny, sx0, sy0, sx1, sy1);
        if (hit && (!best || hit.t < best.t)) best = { t: hit.t, u: hit.u, p, i };
      }
    }
    if (best) {
      const p = best.p, i = best.i;
      const segL = p.s[i + 1] - p.s[i] || 1;
      const Tx = (p.x[i + 1] - p.x[i]) / segL, Ty = (p.y[i + 1] - p.y[i]) / segL;
      const vel = Math.hypot(run.vx, run.vy) || 1;
      const along = run.vx * Tx + run.vy * Ty;
      const cos = Math.abs(along) / vel;
      run.x = run.x + (nx - run.x) * best.t; run.y = run.y + (ny - run.y) * best.t;
      if (cos < 0.62) { finish(run, false, 'landing'); return; }
      run.inAir = false;
      run.events.push({ type: 'land', x: run.x, y: run.y, impact: vel * Math.sqrt(Math.max(0, 1 - cos * cos)) });
      run.mode = 'track';
      enterPiece(state, run, p, p.s[i] + best.u * segL, along * 0.96);
      run.stuckT = 0;
      return;
    }
    run.x = nx; run.y = ny;
    run.angle = Math.atan2(run.vy, run.vx);
    run.speed = Math.hypot(run.vx, run.vy);
    for (const o of state.level.obstacles || []) {
      if (o.type === 'rock' && insideObstacle(o, run.x, run.y, 4)) { finish(run, false, 'rock'); return; }
    }
    if (run.y >= GROUND - 4) { run.y = GROUND - 4; finish(run, false, 'ground'); return; }
    if (run.x < -120 || run.x > W + 120 || run.y > H + 50) finish(run, false, 'out');
  }

  // Avanza la simulación "dt" segundos (en pasos fijos)
  function step(state, run, dt) {
    run.acc = (run.acc || 0) + Math.min(dt, 0.1);
    while (run.acc >= DT) {
      run.acc -= DT;
      if (run.mode === 'crash') { run.acc = 0; break; }
      run.t += DT;
      if (run.mode === 'air') airStep(state, run, DT);
      else trackStep(state, run, DT);
      if (!run.result) {
        checkStars(state, run);
        if (run.t > MAX_TIME) finish(run, false, 'time');
      }
      if (run.mode === 'win' && run.v === 0) { run.acc = 0; break; }
    }
  }

  // Simula un recorrido entero de golpe (para tests)
  function simulate(state, maxT) {
    const run = createRun(state);
    const lim = maxT || MAX_TIME + 1;
    while (!run.result && run.t < lim) step(state, run, 0.05);
    return run;
  }

  const Engine = {
    W, H, GROUND, GRAV, G_LIMIT, BOOST_COST, PX_PER_M, SNAP_DIST, MAX_TIME,
    cleanStroke, buildPiece, sampleAt, endpoint, isEndFree, findFreeEnd, polyLen,
    createState, prepareStroke, addStroke, removePiece, undo, clearAll, pieceAt,
    createRun, step, simulate, insideObstacle, strokeCost
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
