/* =========================================================
   AGÁRRATE 3D · Juego (pantallas, construcción, viaje, guardado)
   ========================================================= */
import * as TR from './track.js';
import * as PH from './physics.js';
import { LEVELS, objectiveText, objectiveMet, objectiveValue } from './levels.js';
import { Sound } from './audio.js';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const show = (sel, on) => $(sel).classList.toggle('hidden', !on);
const fmt = (x, d) => x.toFixed(d === undefined ? 1 : d).replace('.', ',');

let S; // módulo de la escena (se carga después para poder avisar si no hay 3D)

// ---------- Guardado ----------
const KEY = 'agarrate3d.v1';
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { free: d.free || [], levels: d.levels || {}, unlocked: d.unlocked || 1, muted: !!d.muted, color: d.color || 'red', bestFree: d.bestFree || 0, seen: d.seen || {} };
  } catch (e) { return { free: [], levels: {}, unlocked: 1, muted: false, color: 'red', bestFree: 0, seen: {} }; }
}
const save = load();
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* sin guardado */ } }
Sound.setMuted(save.muted);

// ---------- Estado ----------
let screen = 'loading';
let mode = 'free', levelIdx = 0, level = null;
let specs = [], built = null, T = null, index = null, endV = 0;
let chainOn = false, bankMode = 'auto';
let ride = null, rideResultT = 0, resultShown = false;
let demo = null, ignoreRotate = false, modalOpen = false;
let last = performance.now();
const TS = +new URLSearchParams(location.search).get('ts') || 1; // velocidad del tiempo (para pruebas)

// ---------- Piezas (paleta) ----------
const ICON = {
  chain: '<path d="M8 26a6 6 0 0 1 0-12h7a6 6 0 0 1 0 12zM25 26a6 6 0 0 1 0-12h7a6 6 0 0 1 0 12z" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M14 20h12" stroke="currentColor" stroke-width="3.5"/>',
  straight: '<path d="M20 35V7M12 14l8-8 8 8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  curveL: '<path d="M30 35V24a14 14 0 0 0-14-14H6M12 4l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  curveR: '<path d="M10 35V24a14 14 0 0 1 14-14h10M28 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  tightL: '<path d="M26 35V18a7 7 0 0 0-7-7H8M14 5l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  tightR: '<path d="M14 35V18a7 7 0 0 1 7-7h11M26 5l6 6-6 6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  up: '<path d="M4 33h11L33 11M25 10h8v8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  down: '<path d="M4 9h11l18 22M33 23v8h-8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  loop: '<path d="M3 34h14c12 0 14-24 3-24S9 30 23 34h14" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  rollL: '<path d="M3 20c6-14 10 14 17 0s11 14 17 0" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M8 32a12 6 0 0 0 24 0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="3 3"/><path d="M10 29l-3 4 4 2" fill="none" stroke="currentColor" stroke-width="2.5"/>',
  rollR: '<path d="M3 20c6-14 10 14 17 0s11 14 17 0" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M8 32a12 6 0 0 0 24 0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="3 3"/><path d="M30 29l3 4-4 2" fill="none" stroke="currentColor" stroke-width="2.5"/>',
  boost: '<path d="M23 3L9 22h10l-3 15 15-20H21z" fill="#ffb21e" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>',
  brake: '<path d="M14 4h12l8 8v12l-8 8H14l-8-8V12z" fill="#ff4757" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" transform="translate(0 2)"/><path d="M12 20h16" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
  meta: '<path d="M10 37V4" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M10 5h22l-5 7 5 7H10z" fill="#fff" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M15 5v14M20 5v7M25 5v14M10 12h20" stroke="currentColor" stroke-width="2"/>'
};
const PALETTE = [
  { id: 'chain', label: 'Cadena', toggle: true },
  'sep',
  { id: 'straight' }, { id: 'curveL' }, { id: 'curveR' }, { id: 'tightL' }, { id: 'tightR' }, { id: 'up' }, { id: 'down' },
  'sep',
  { id: 'loop', special: true }, { id: 'rollL', special: true }, { id: 'rollR', special: true },
  'sep',
  { id: 'boost' }, { id: 'brake' }, { id: 'meta', cls: 'meta' }
];
const svg = id => `<svg viewBox="0 0 40 40">${ICON[id]}</svg>`;

function buildPalette() {
  const pal = $('#palette'); pal.innerHTML = '';
  for (const p of PALETTE) {
    if (p === 'sep') { const d = document.createElement('div'); d.className = 'piece-sep'; pal.appendChild(d); continue; }
    const P = TR.PIECES[p.id];
    const b = document.createElement('button');
    b.className = 'piece' + (p.toggle ? ' toggle' : '') + (p.special ? ' special' : '') + (p.cls ? ' ' + p.cls : '');
    b.dataset.piece = p.id;
    b.innerHTML = svg(p.id) + `<small>${p.label || P.name}</small>` + (P && P.side ? `<span class="side">${P.side}</span>` : '') + (p.toggle ? '<span class="side">off</span>' : '');
    pal.appendChild(b);
  }
}
function bankIcon(deg) {
  return `<svg viewBox="0 0 40 22"><g transform="rotate(${deg} 20 11)"><rect x="5" y="9" width="30" height="4" rx="2" fill="currentColor"/><circle cx="20" cy="4" r="3" fill="#e8453c"/></g></svg>`;
}
$$('.bank').forEach(b => { if (b.dataset.bank !== 'auto') b.innerHTML = bankIcon(+b.dataset.bank); });

// ---------- Utilidades ----------
let toastT = 0;
function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms || 2600); }
let popT = 0;
function pop(msg) { const p = $('#pop'); p.textContent = msg; p.classList.add('show'); clearTimeout(popT); popT = setTimeout(() => p.classList.remove('show'), 1100); }

function openModal(html, wire, wide) {
  const c = $('#modal-card'); c.className = 'card' + (wide ? ' wide' : ''); c.innerHTML = html;
  show('#modal', true); modalOpen = true;
  if (wire) wire(c);
  c.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { Sound.click(); closeModal(); });
}
function closeModal() { show('#modal', false); modalOpen = false; }

// ---------- Circuito ----------
function autoBank(t) {
  const v = endV;
  const k = TR.curvePeakK(t);
  return Math.round(Math.min(80, Math.atan(v * v * k / PH.G) / TR.DEG) / 5) * 5;
}

function makeSpec(t, b) {
  const spec = { t, c: chainOn ? 1 : 0, bk: bankMode === 'auto' ? null : +bankMode };
  if (TR.PIECES[t].turn && spec.bk === null) spec.ab = autoBank(t);
  return spec;
}

function rebuild(silent) {
  built = TR.build(specs, level);
  if (built.error) { specs = specs.slice(0, built.broken); built = TR.build(specs, level); }
  index = TR.makeIndex(built.nodes);
  T = PH.prepare(built.nodes);
  endV = PH.endSpeed(T);
  if (S) {
    S.setTrack(built);
    if (!ride) S.parkTrain(T);
  }
  updateStats(); updatePalette();
  if (!silent) storeSpecs();
}

function storeSpecs() {
  if (mode === 'free') save.free = specs;
  else { const l = save.levels[levelIdx] || {}; l.specs = specs; save.levels[levelIdx] = l; }
  persist();
}

function addPiece(t) {
  if (ride) return;
  if (level && level.budget && specs.length >= level.budget) { Sound.error(); toast('😬 ' + TR.ERRORS.presupuesto); return; }
  const spec = makeSpec(t);
  const r = TR.tryAdd(built, spec, level, index);
  if (r.error) {
    Sound.error();
    toast('🚫 ' + (TR.ERRORS[r.error] || 'No cabe aquí.'));
    if (r.nodes) S.showGhost(r.nodes, false);
    return;
  }
  specs.push(spec);
  rebuild();
  Sound.place(specs.length);
  if (t === 'meta') toast('🏁 ¡Circuito terminado! Dale a MONTAR', 3000);
  else if (TR.PIECES[t].turn && spec.bk === null && spec.ab >= 5) toast(`Peralte automático: ${spec.ab}°`, 1400);
}

function undo() {
  if (ride || !specs.length) { if (!specs.length) toast('No hay nada que deshacer'); return; }
  specs.pop(); rebuild(); Sound.undo();
}

function updateStats() {
  const m = { len: T.len, maxY: 0 };
  for (let i = 0; i < T.n; i++) m.maxY = Math.max(m.maxY, T.py[i]);
  const parts = [`📏 ${Math.round(m.len)} m`, `<span class="opt">⛰️ ${Math.round(m.maxY)} m</span>`];
  if (!built.end.closed) parts.push(`🚀 ${Math.round(endV * 3.6)} km/h al final`);
  else parts.push('🏁 terminado');
  if (level && level.budget) parts.push(`<span class="${specs.length >= level.budget ? 'warn' : ''}">🧩 ${specs.length}/${level.budget}</span>`);
  $('#stats').innerHTML = parts.join(' · ');
}

function updatePalette() {
  $$('.piece').forEach(b => {
    const id = b.dataset.piece;
    if (id === 'chain') { b.classList.toggle('on', chainOn); b.querySelector('.side').textContent = chainOn ? 'on' : 'off'; return; }
    b.classList.toggle('off', !!TR.shapeCheck(id, built.end));
  });
}

function setBank(v) {
  bankMode = v;
  $$('.bank').forEach(b => b.classList.toggle('active', b.dataset.bank === String(v)));
}

// ---------- Pantallas ----------
function hideAll() { ['#scr-menu', '#scr-levels', '#hud-build', '#hud-ride'].forEach(s => show(s, false)); }

function goMenu() {
  stopRide(true); closeModal(); hideAll();
  screen = 'menu'; show('#scr-menu', true);
  startDemo();
  checkRotate();
}

function goLevels() {
  stopRide(true); closeModal(); hideAll();
  screen = 'levels'; show('#scr-levels', true);
  if (!demo) startDemo();
  const grid = $('#level-grid'); grid.innerHTML = '';
  const colors = [['#4fb8ff', '#20bf6b'], ['#ff9f43', '#ff4757'], ['#a45cff', '#2f7cff'], ['#ff4757', '#ffb21e'], ['#2ee59d', '#2f86e8'], ['#ff6bcb', '#a45cff'], ['#ffd43b', '#20bf6b'], ['#20bf6b', '#145a32']];
  let total = 0;
  LEVELS.forEach((lv, i) => {
    const st = (save.levels[i] && save.levels[i].stars) || 0; total += st;
    const locked = i >= save.unlocked;
    const b = document.createElement('button');
    b.className = 'lvl-card' + (locked ? ' locked' : '');
    b.style.setProperty('--c1', colors[i % colors.length][0]); b.style.setProperty('--c2', colors[i % colors.length][1]);
    b.innerHTML = `<div class="num">${i + 1}</div><div class="nm">${lv.name}</div><div class="st">${[0, 1, 2].map(k => `<i class="${k < st ? 'on' : ''}">★</i>`).join('')}</div>`;
    b.onclick = () => { Sound.init(); if (locked) { Sound.error(); toast('🔒 Consigue al menos 1 estrella en el reto anterior'); return; } Sound.click(); startBuild('level', i); };
    grid.appendChild(b);
  });
  $('#total-stars').textContent = total; $('#max-stars').textContent = LEVELS.length * 3;
}

function startBuild(m, i) {
  stopRide(true); closeModal(); hideAll();
  demo = null;
  mode = m; levelIdx = i || 0; level = m === 'level' ? LEVELS[levelIdx] : null;
  specs = (m === 'free' ? save.free : ((save.levels[levelIdx] || {}).specs || [])).map(s => ({ ...s }));
  chainOn = false; setBank('auto');
  S.setTrackColor(m === 'free' ? save.color : 'red');
  S.setObstacles(level && level.obstacles);
  rebuild(true);
  screen = 'build'; show('#hud-build', true); show('#btn-color', m === 'free');
  S.trainVisible(true); S.setCamMode('build'); S.setCursorVisible(!built.end.closed);
  centerView(true);
  updateLevelChip();
  checkRotate();
  if (m === 'level') showObjectives(true);
  else if (!save.seen.free) { save.seen.free = true; persist(); showHowTo(); }
}

function centerView(jump) {
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, maxY = 0;
  for (let i = 0; i < T.n; i++) { minX = Math.min(minX, T.px[i]); maxX = Math.max(maxX, T.px[i]); minZ = Math.min(minZ, T.pz[i]); maxZ = Math.max(maxZ, T.pz[i]); maxY = Math.max(maxY, T.py[i]); }
  const size = Math.max(maxX - minX, maxZ - minZ, maxY, 30);
  const e = T.n - 1;
  const c = specs.length ? new S.THREE.Vector3((minX + maxX) / 2, maxY * 0.3, (minZ + maxZ) / 2) : new S.THREE.Vector3(T.px[e], T.py[e] + 2, T.pz[e] + 8);
  S.resetView(c, specs.length ? size : 34);
}

function updateLevelChip() {
  const c = $('#lvl-chip');
  if (mode === 'free') { c.innerHTML = `🎨 Modo libre${save.bestFree ? ` · récord ${fmt(save.bestFree)}` : ''}`; return; }
  const st = (save.levels[levelIdx] && save.levels[levelIdx].stars) || 0;
  c.innerHTML = `${levelIdx + 1}. ${level.name} <span class="mini-stars">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span>`;
}

function showObjectives(first) {
  if (mode === 'free') { showHowTo(); return; }
  const best = save.levels[levelIdx] || {};
  openModal(`
    <div class="kicker">Reto ${levelIdx + 1}</div>
    <h2>${level.name}</h2>
    <p>${level.intro}</p>
    <ul class="objs">${level.objectives.map((o, k) => `<li class="${(best.stars || 0) > 0 && best.met && best.met[k] ? 'ok' : ''}"><span class="s">★</span>${objectiveText(o)}</li>`).join('')}</ul>
    <p class="tip">💡 ${level.tip}</p>
    <div class="actions"><button class="btn go" data-close>${first ? '¡A construir!' : 'Seguir'}</button></div>`);
}

function showHowTo() {
  openModal(`
    <h2>Cómo se juega</h2>
    <ul class="howto">
      <li><b>🧩</b><span>Toca las piezas de abajo para ir añadiéndolas al final de la vía (la flecha verde). Siempre encajan perfectas.</span></li>
      <li><b>⛓️</b><span>Activa la <u>cadena</u> para subir sin velocidad. Después apágala y déjate caer.</span></li>
      <li><b>📐</b><span>El <u>peralte</u> inclina la vía en las curvas. En AUTO el juego calcula la inclinación ideal según la velocidad.</span></li>
      <li><b>👆</b><span>Mueve la cámara con un dedo, haz zoom con dos. 🎯 vuelve a centrarla.</span></li>
      <li><b>▶</b><span>Dale a <u>MONTAR</u> y vívelo en primera persona (🎥 cambia de cámara).</span></li>
      <li><b>🤢</b><span>Curvas sin peralte, loopings muy rápidos o bajadas que acaban de golpe = demasiadas fuerzas G = pasajeros vomitando.</span></li>
      <li><b>🏁</b><span>Termina con <u>Frenos</u> y <u>Meta</u> para que el tren pare en la estación.</span></li>
    </ul>
    <div class="actions"><button class="btn go" data-close>¡Entendido!</button></div>`);
}

function confirmClear() {
  if (!specs.length) { toast('La vía ya está vacía'); return; }
  openModal(`<div class="emoji">🗑️</div><h2>¿Borrar toda la vía?</h2><p>Se quitarán todas las piezas.</p>
    <div class="actions"><button class="btn small" data-close>Mejor no</button><button class="btn danger" id="yes-clear">Sí, borrar</button></div>`, c => {
    c.querySelector('#yes-clear').onclick = () => { specs = []; rebuild(); Sound.undo(); closeModal(); centerView(); };
  });
}

// ---------- Viaje ----------
function startRide() {
  if (ride || !S) return;
  Sound.init(); Sound.go();
  if (!built.end.closed) toast('⚠️ Aún no hay 🏁 Meta: al final de la vía el tren saldrá volando', 3200);
  ride = PH.createRide(T);
  rideResultT = 0; resultShown = false;
  hideAll(); show('#hud-ride', true);
  S.resetRideCamState(); S.setCamMode('ride'); S.setCursorVisible(false);
  updateCamBtn();
  screen = 'ride';
}

function stopRide(silent) {
  if (!ride) return;
  ride = null; Sound.stop();
  $('#vignette').style.opacity = 0;
  if (!silent) Sound.click();
  if (screen === 'ride') {
    hideAll(); show('#hud-build', true);
    S.setCamMode('build'); S.setCursorVisible(!built.end.closed); S.parkTrain(T);
    screen = 'build';
  }
}

function updateCamBtn() { const m = S.getRideCam(); $('#btn-cam').textContent = m === 'pov' ? '🎥' : m === 'chase' ? '🚁' : '🌍'; }

const FAIL = {
  vomit: ['🤢', '¡Han vomitado!', 'Demasiadas fuerzas G. Suele pasar en curvas sin peralte, loopings a demasiada velocidad o bajadas que terminan de golpe. Prueba el peralte AUTO, pon frenos antes de las curvas o haz caídas más bajas.'],
  stall: ['😴', 'Se ha quedado sin fuerza', 'El tren no tenía velocidad para subir y ha ido marcha atrás. Baja más antes de esa subida, o usa ⛓️ cadena o ⚡ turbo.'],
  end: ['💥', '¡La vía se acaba!', 'El tren ha salido volando. Termina el circuito con 🛑 Frenos y 🏁 Meta.'],
  time: ['⏱️', 'Viaje eterno', 'El tren lleva demasiado tiempo dando vueltas.']
};

function rateRide() {
  const m = PH.trackMetrics(T, specs);
  const rt = PH.ratings(ride.stats, m, ride.t);
  return { ok: !!(ride.result && ride.result.ok), stats: ride.stats, metrics: m, ratings: rt, t: ride.t };
}

function ratingRow(name, val, color) {
  return `<div class="rating"><div class="top"><span>${name}</span><span>${fmt(val)} · ${PH.ratingWord(val)}</span></div><div class="rbar"><i style="background:${color}" data-w="${val * 10}"></i></div></div>`;
}

function showResult() {
  resultShown = true; Sound.stop();
  const res = rateRide();
  const s = res.stats, m = res.metrics, r = res.ratings;
  const statsHtml = `<div class="stats-list">
      <span>🚀 ${Math.round(s.maxV * 3.6)} km/h</span><span>⛰️ ${Math.round(m.maxY)} m altura</span>
      <span>⬇️ ${Math.round(m.maxDrop)} m caída</span><span>📏 ${Math.round(m.length)} m</span>
      <span>🔄 ${s.inversions} boca abajo</span><span>🪶 ${fmt(s.airtime)} s flotando</span>
      <span>⬆️ ${fmt(s.maxVert)} G máx.</span><span>↔️ ${fmt(s.maxLat, 2)} G lateral</span>
    </div>`;
  if (!res.ok) {
    const [e, title, text] = FAIL[ride.result ? ride.result.reason : 'time'] || FAIL.time;
    openModal(`<div class="emoji">${e}</div><h2>${title}</h2><p>${text}</p>${statsHtml}
      <div class="actions sticky"><button class="btn small" id="r-again">🔁 Otra vez</button><button class="btn go" id="r-fix">🔧 Arreglar</button></div>`, c => {
      c.querySelector('#r-fix').onclick = () => { closeModal(); stopRide(); };
      c.querySelector('#r-again').onclick = () => { closeModal(); stopRide(true); startRide(); };
    });
    return;
  }
  Sound.win();
  let objHtml = '', starCount = 0, met = [];
  if (mode === 'level') {
    met = level.objectives.map(o => objectiveMet(o, res));
    starCount = met.filter(Boolean).length;
    const prev = save.levels[levelIdx] || {};
    const bestMet = level.objectives.map((o, k) => met[k] || (prev.met && prev.met[k]));
    const best = Math.max(prev.stars || 0, bestMet.filter(Boolean).length);
    save.levels[levelIdx] = { ...prev, stars: best, met: bestMet, specs };
    if (starCount > 0) save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, levelIdx + 2));
    persist();
    objHtml = `<div class="big-stars">${[0, 1, 2].map(() => '<i>★</i>').join('')}</div>
      <ul class="objs">${level.objectives.map((o, k) => `<li class="${met[k] ? 'ok' : ''}"><span class="s">★</span>${objectiveText(o)}<span class="val">${objectiveValue(o, res)}</span></li>`).join('')}</ul>`;
  } else if (r.excitement > save.bestFree) { save.bestFree = r.excitement; persist(); }
  const isLast = mode === 'level' && levelIdx === LEVELS.length - 1;
  const verdict = r.excitement >= 8 ? '¡Una obra maestra! La gente hace cola durante horas.' : r.excitement >= 6 ? '¡A la gente le encanta!' : r.excitement >= 4 ? 'Está bien, pero puede ser más emocionante.' : 'Un poco sosa… ¡añade caídas, loopings y airtime!';
  openModal(`
    <div class="kicker">${mode === 'level' ? `Reto ${levelIdx + 1} · ${level.name}` : 'Modo libre'}</div>
    <h2>¡Han llegado! 🎉</h2>
    <div class="result-grid">
      <div>${objHtml || `<p>${verdict}</p>`}
        ${ratingRow('😍 Emoción', r.excitement, '#20bf6b')}${ratingRow('😱 Intensidad', r.intensity, '#ff9f43')}${ratingRow('🤢 Mareo', r.nausea, '#a45cff')}
      </div>
      <div>${objHtml ? `<p style="margin-top:0">${verdict}</p>` : ''}${statsHtml}</div>
    </div>
    <div class="actions sticky">
      <button class="btn small" id="r-again">🔁 Otra vez</button>
      <button class="btn small" id="r-fix">🔧 Seguir construyendo</button>
      ${mode === 'level' && !isLast && starCount > 0 ? '<button class="btn go" id="r-next">Siguiente reto ▶</button>' : ''}
    </div>`, c => {
    setTimeout(() => c.querySelectorAll('.rbar i').forEach(i => i.style.width = i.dataset.w + '%'), 60);
    const st = c.querySelectorAll('.big-stars i');
    for (let k = 0; k < starCount; k++) setTimeout(() => { st[k].classList.add('on'); Sound.star(k); }, 400 + k * 320);
    c.querySelector('#r-fix').onclick = () => { closeModal(); stopRide(); updateLevelChip(); };
    c.querySelector('#r-again').onclick = () => { closeModal(); stopRide(true); updateLevelChip(); startRide(); };
    const nx = c.querySelector('#r-next');
    if (nx) nx.onclick = () => { Sound.click(); startBuild('level', levelIdx + 1); };
  }, true);
}

function handleEvent(ev) {
  switch (ev.type) {
    case 'inversion': Sound.inversion(); pop(ev.n === 1 ? '¡BOCA ABAJO!' : `¡${ev.n} VUELTAS!`); break;
    case 'airtime': Sound.airtime(); pop('¡AIRTIME!'); break;
    case 'launch': pop('¡¡AAAAH!!'); break;
    case 'crash': {
      Sound.crash();
      const f = ride.fly; S.burst(f.x, f.y, f.z, 140, [0xe8453c, 0xffd43b, 0x555555, 0xffffff], 14);
      break;
    }
    case 'fail': if (ev.reason === 'vomit') { Sound.vomit(); pop('🤢 ¡PUAJ!'); } break;
    case 'finish': {
      const fr = PH.frameAt(T, ride.s);
      S.burst(fr.x, fr.y + 6, fr.z, 160, [0xff4757, 0xffd43b, 0x2ee59d, 0x2f7cff, 0xff9ff3], 10);
      break;
    }
  }
}

function updateRideHud() {
  const r = ride, sp = Math.abs(r.fly ? Math.hypot(r.fly.vx, r.fly.vy, r.fly.vz) : r.v);
  $('#g-speed').textContent = Math.round(sp * 3.6);
  const g = r.mode === 'fly' ? 0 : r.vertS;
  const bar = $('#g-vert');
  if (g >= 0) { bar.style.bottom = '25%'; bar.style.height = Math.min(75, g / 8 * 75) + '%'; }
  else { const h = Math.min(25, -g / 2 * 25); bar.style.bottom = (25 - h) + '%'; bar.style.height = h + '%'; }
  bar.style.background = g > PH.LIMITS.vertMax || g < PH.LIMITS.vertMin ? 'var(--stop)' : g > 4 || g < 0 ? 'var(--boost)' : 'var(--go)';
  $('#g-vert-t').textContent = fmt(g) + ' G';
  const lat = r.mode === 'fly' ? 0 : r.latS, lb = $('#g-lat');
  const w = Math.min(50, Math.abs(lat) / 2.5 * 50);
  lb.style.width = w + '%'; lb.style.left = lat >= 0 ? '50%' : (50 - w) + '%';
  lb.style.background = Math.abs(lat) > PH.LIMITS.lat ? 'var(--stop)' : Math.abs(lat) > 1 ? 'var(--boost)' : 'var(--go)';
  $('#g-lat-t').textContent = fmt(Math.abs(lat)) + ' G';
  $('#g-susto').style.width = Math.round(r.susto * 100) + '%';
  $('#g-face').textContent = r.mode === 'crashed' ? '😵' : r.susto > 0.75 ? '🤢' : r.susto > 0.4 ? '😖' : r.inverted ? '🙃' : r.vertS < 0.3 ? '😆' : r.vertS > 3.5 ? '😬' : sp > 25 ? '😱' : '😀';
  $('#c-inv').textContent = r.stats.inversions;
  $('#c-air').textContent = fmt(r.stats.airtime);
  $('#vignette').style.opacity = S.getRideCam() === 'pov' ? Math.min(0.9, Math.max(0, (sp - 12) / 30)) : 0;
}

// ---------- Demo del menú ----------
const DEMO = ['C+', 'up*2', 'straight*6', 'down*2', 'C-', 'down*3', 'up*3', 'loop', 'curveR', 'rollR', 'up', 'down', 'down', 'up', 'curveR', 'rollL', 'curveR', 'brake', 'meta'];
function specsFromList(list) {
  const saved = { specs, built, T, index, endV, chainOn, bankMode, level };
  specs = []; level = null; built = TR.build([]); T = PH.prepare(built.nodes); index = TR.makeIndex(built.nodes); endV = PH.endSpeed(T);
  let chain = 0;
  for (const tok of list) {
    if (tok === 'C+') { chain = 1; continue; }
    if (tok === 'C-') { chain = 0; continue; }
    const [t, n] = tok.split('*');
    for (let i = 0; i < (+n || 1); i++) {
      chainOn = !!chain; bankMode = 'auto';
      const spec = makeSpec(t);
      const r = TR.tryAdd(built, spec, null, index);
      if (r.error) break;
      specs.push(spec); built = TR.build(specs); index = TR.makeIndex(built.nodes); T = PH.prepare(built.nodes); endV = PH.endSpeed(T);
    }
  }
  const out = { specs, built, T };
  ({ specs, built, T, index, endV, chainOn, bankMode, level } = saved);
  return out;
}

let demoData = null;
function startDemo() {
  if (!demoData) demoData = specsFromList(DEMO);
  S.setObstacles(null); S.setTrackColor('red');
  S.setTrack(demoData.built); S.setCursorVisible(false); S.trainVisible(true);
  demo = { ride: PH.createRide(demoData.T), wait: 0 };
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < demoData.T.n; i++) { minX = Math.min(minX, demoData.T.px[i]); maxX = Math.max(maxX, demoData.T.px[i]); minZ = Math.min(minZ, demoData.T.pz[i]); maxZ = Math.max(maxZ, demoData.T.pz[i]); }
  S.setDemo(new S.THREE.Vector3((minX + maxX) / 2, 18, (minZ + maxZ) / 2), Math.max(maxX - minX, maxZ - minZ) * 0.85 + 30);
  S.setCamMode('demo');
}

// ---------- Botones ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act], [data-piece], [data-bank]');
  if (!el) return;
  Sound.init();
  if (el.dataset.piece) {
    if (el.dataset.piece === 'chain') { chainOn = !chainOn; Sound.click(); updatePalette(); toast(chainOn ? '⛓️ Cadena activada: las piezas que pongas subirán el tren solas' : '⛓️ Cadena desactivada', 2000); return; }
    addPiece(el.dataset.piece); return;
  }
  if (el.dataset.bank) { Sound.click(); setBank(el.dataset.bank === 'auto' ? 'auto' : +el.dataset.bank); const v = el.dataset.bank; toast(v === 'auto' ? 'Peralte automático: inclina las curvas lo justo según la velocidad' : v === '0' ? 'Sin peralte (vía plana)' : `Peralte de ${Math.abs(v)}° hacia la ${+v < 0 ? 'izquierda' : 'derecha'} para las próximas piezas`, 2200); return; }
  switch (el.dataset.act) {
    case 'menu': Sound.click(); goMenu(); break;
    case 'levels': Sound.click(); goLevels(); break;
    case 'free': Sound.click(); startBuild('free'); break;
    case 'howto': Sound.click(); showHowTo(); break;
    case 'objectives': Sound.click(); showObjectives(false); break;
    case 'undo': undo(); break;
    case 'clear': Sound.click(); confirmClear(); break;
    case 'center': Sound.click(); centerView(); break;
    case 'color': {
      const list = ['red', 'blue', 'green', 'gold', 'purple'];
      save.color = list[(list.indexOf(save.color) + 1) % list.length]; persist();
      S.setTrackColor(save.color); S.setTrack(built); Sound.click(); break;
    }
    case 'mute': save.muted = !save.muted; Sound.setMuted(save.muted); persist(); $$('.ico-sound').forEach(s => s.textContent = save.muted ? '🔇' : '🔊'); break;
    case 'cam': S.cycleRideCam(); updateCamBtn(); Sound.click(); toast({ pov: '🎥 Primera fila', chase: '🚁 Detrás del tren', orbit: '🌍 Cámara libre (mueve con el dedo)' }[S.getRideCam()], 1500); break;
    case 'stop': stopRide(); break;
    case 'ignore-rotate': ignoreRotate = true; checkRotate(); break;
  }
});
$$('.ico-sound').forEach(s => s.textContent = save.muted ? '🔇' : '🔊');
$('#btn-ride').addEventListener('click', () => { if (!modalOpen) startRide(); });

window.addEventListener('keydown', e => {
  if (modalOpen) { if (e.key === 'Enter' || e.key === 'Escape') { const b = $('#modal-card [data-close]') || $('#modal-card .btn.go'); if (b) b.click(); } return; }
  if (screen === 'build') {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); startRide(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    else if (e.key === 'Backspace') undo();
  } else if (screen === 'ride') {
    if (e.key === ' ' || e.key === 'Escape') { e.preventDefault(); stopRide(); }
    else if (e.key.toLowerCase() === 'c') $('#btn-cam').click();
  }
});

function checkRotate() {
  const portrait = window.innerHeight > window.innerWidth * 1.05;
  const touch = matchMedia('(pointer: coarse)').matches;
  show('#rotate', portrait && touch && !ignoreRotate && (screen === 'build' || screen === 'ride'));
}
window.addEventListener('resize', () => { if (S) S.resize(); checkRotate(); });
window.addEventListener('orientationchange', () => setTimeout(() => { if (S) S.resize(); checkRotate(); }, 300));
document.addEventListener('gesturestart', e => e.preventDefault());

// ---------- Bucle ----------
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (screen === 'ride' && ride) {
    PH.step(ride, dt * TS);
    for (const ev of ride.events) handleEvent(ev);
    ride.events.length = 0;
    S.updateTrain(ride, now / 1000);
    Sound.ride(Math.abs(ride.fly ? Math.hypot(ride.fly.vx, ride.fly.vy, ride.fly.vz) : ride.v), dt, ride.onChain, ride.boosting, ride.mode === 'fly');
    updateRideHud();
    if (ride.result && !resultShown) { rideResultT += dt; if (rideResultT > (ride.result.ok ? 1.2 : 1.6)) showResult(); }
    S.render(dt, { ride });
  } else if ((screen === 'menu' || screen === 'levels') && demo) {
    PH.step(demo.ride, dt); demo.ride.events.length = 0;
    if (demo.ride.result) { demo.wait += dt; if (demo.wait > 2) { demo.ride = PH.createRide(demoData.T); demo.wait = 0; } }
    S.updateTrain(demo.ride, now / 1000);
    S.render(dt);
  } else if (S) S.render(dt);
  requestAnimationFrame(loop);
}

// ---------- Arranque ----------
async function boot() {
  buildPalette();
  try {
    const test = document.createElement('canvas');
    if (!(test.getContext('webgl2') || test.getContext('webgl'))) throw new Error('sin webgl');
    S = await import('./scene.js');
    S.init($('#c'));
  } catch (err) {
    console.error(err);
    show('#loading', false); show('#webgl-error', true); return;
  }
  built = TR.build([]); T = PH.prepare(built.nodes); index = TR.makeIndex(built.nodes);
  show('#loading', false);
  goMenu();
  requestAnimationFrame(t => { last = t; loop(t); });
  // exponer para pruebas
  window.__game = { get specs() { return specs; }, addPiece, startRide, get ride() { return ride; }, get screen() { return screen; } };
}
boot();
