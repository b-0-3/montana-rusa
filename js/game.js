/* =========================================================
   AGÁRRATE · Lógica del juego (pantallas, controles, partida)
   ========================================================= */
(function () {
  'use strict';
  const E = window.Engine, R = window.Render, S = window.Sound, LEVELS = window.LEVELS;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const canvas = $('#c');
  R.setup(canvas);

  // ---------- Guardado ----------
  const SAVE_KEY = 'agarrate.v1';
  function loadSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      return { best: d.best || {}, unlocked: d.unlocked || 1, muted: !!d.muted, tracks: d.tracks || {}, seen: d.seen || {} };
    } catch (e) { return { best: {}, unlocked: 1, muted: false, tracks: {}, seen: {} }; }
  }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* sin guardado */ } }
  const save = loadSave();
  S.setMuted(save.muted);

  // ---------- Estado ----------
  let screen = 'menu';
  let idx = 0, state = null, run = null, tool = 'track';
  let particles = [], shake = 0, time = 0, last = performance.now();
  let drawing = null, eraser = null;
  let resultTimer = 0, resultShown = false;
  let flip = 1, flipPiece = null, flipMode = null;
  let vmax = 0, ignoreRotate = false, modalOpen = false;
  let demo = null;

  const PX_TO_KMH = 3.6 / 20;
  const REASONS = {
    g: ['🤢', '¡Han vomitado!', 'Las curvas son demasiado cerradas y los pasajeros sufren muchas fuerzas G. Haz las curvas más abiertas (más redondas y suaves), sobre todo abajo del todo.'],
    stuck: ['😴', 'Sin fuerza', 'El vagón no tiene velocidad para subir. Haz que baje más antes de una subida, o ponle turbo.'],
    landing: ['💥', '¡Aterrizaje brutal!', 'Ha caído sobre la vía con mucho ángulo. La vía donde aterriza tiene que ir más o menos en la misma dirección en la que cae el vagón.'],
    ground: ['💥', '¡Al suelo!', 'El vagón se ha salido de la vía y se ha estampado. Pon vía donde vaya a caer o haz que llegue a la meta sin saltar.'],
    rock: ['🪨', '¡Contra las rocas!', 'En el aire se ha comido una roca. Cambia la rampa para que vuele por otro sitio.'],
    out: ['🚀', '¡Se ha ido del mapa!', 'Iba tan rápido que ha salido volando de la pantalla. Frena un poco o pon vía donde caiga.'],
    time: ['⏱️', 'Se ha hecho eterno', 'El vagón lleva demasiado tiempo dando vueltas. Comprueba que la vía lleva a la meta.'],
    kink: ['💥', '¡Descarrilado!', 'Hay una esquina imposible entre dos trozos de vía. Bórralos y únelos con una curva suave.']
  };
  const DEMO_TRACK = [[250, 250], [400, 320], [520, 400], [700, 500], [860, 560], [1020, 600], [1160, 630], [1320, 640]];

  // ---------- Utilidades ----------
  function catmull(ctrl, step) {
    step = step || 4;
    const P = ctrl.map(p => ({ x: p[0], y: p[1] })), out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      const m = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
      for (let j = 0; j < m; j++) {
        const t = j / m, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
    }
    out.push(P[P.length - 1]);
    return out;
  }

  let toastTimer = 0;
  function toast(msg, ms) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2200);
  }

  function show(id, on) { $(id).classList.toggle('hidden', !on); }

  // ---------- Disposición en pantalla ----------
  function railWidth() {
    const w = window.innerWidth, h = window.innerHeight;
    return h <= 430 ? 72 : 84;
  }
  function relayout() {
    const probe = getComputedStyle($('#safe-probe'));
    const sl = parseFloat(probe.paddingLeft) || 0, sr = parseFloat(probe.paddingRight) || 0;
    const rail = railWidth();
    document.documentElement.style.setProperty('--rail', rail + 'px');
    const inGame = screen === 'game';
    R.layout(window.innerWidth, window.innerHeight, inGame ? rail + sl : 0, inGame ? rail + sr : 0, Math.min(window.devicePixelRatio || 1, 2.5));
    checkRotate();
  }
  function checkRotate() {
    const portrait = window.innerHeight > window.innerWidth * 1.05;
    const touch = matchMedia('(pointer: coarse)').matches;
    show('#rotate', portrait && touch && !ignoreRotate && screen === 'game');
  }
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', () => setTimeout(relayout, 250));
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());

  // ---------- Pantallas ----------
  function goMenu() {
    stopRun(true);
    screen = 'menu'; show('#scr-menu', true); show('#scr-levels', false); show('#hud', false);
    relayout(); startDemo();
  }

  function goLevels() {
    stopRun(true);
    screen = 'levels'; show('#scr-menu', false); show('#scr-levels', true); show('#hud', false);
    closeModal(); relayout(); buildLevelGrid(); if (!demo) startDemo();
  }

  function buildLevelGrid() {
    const grid = $('#level-grid'); grid.innerHTML = '';
    let total = 0;
    LEVELS.forEach((lv, i) => {
      const best = save.best[i] || 0; total += best;
      const locked = i >= save.unlocked;
      const b = document.createElement('button');
      b.className = `lvl-card ${lv.theme}${locked ? ' locked' : ''}`;
      b.innerHTML = `<div class="num">${i + 1}</div><div class="nm">${lv.name}</div>
        <div class="st">${[0, 1, 2].map(k => `<i class="${k < best ? 'on' : ''}">★</i>`).join('')}</div>
        ${!locked && save.best[i] === undefined && i === save.unlocked - 1 ? '<span class="new">NUEVO</span>' : ''}`;
      b.addEventListener('click', () => {
        S.init();
        if (locked) { S.error(); return; }
        S.click(); startLevel(i, true);
      });
      grid.appendChild(b);
    });
    $('#total-stars').textContent = total;
    $('#max-stars').textContent = LEVELS.length * 3;
  }

  // ---------- Demo del menú ----------
  function startDemo() {
    const lv = LEVELS[0];
    const st = E.createState(lv);
    E.addStroke(st, catmull(DEMO_TRACK), 'track');
    demo = { state: st, run: E.createRun(st), wait: 0 };
  }

  function updateDemo(dt) {
    if (!demo) return;
    if (demo.run.result) {
      demo.wait += dt;
      if (demo.wait > 1.4) { demo.run = E.createRun(demo.state); demo.wait = 0; }
    }
    E.step(demo.state, demo.run, dt);
    demo.run.events.length = 0;
  }

  // ---------- Nivel ----------
  function startLevel(i, showIntro) {
    stopRun(true);
    demo = null;
    idx = i; state = E.createState(LEVELS[i]);
    restoreTracks();
    screen = 'game';
    show('#scr-menu', false); show('#scr-levels', false); show('#hud', true);
    relayout();
    $('#lvl-num').textContent = i + 1;
    $('#lvl-title').textContent = LEVELS[i].name;
    $('#tool-boost').classList.toggle('hidden', !LEVELS[i].boost);
    if (tool === 'boost' && !LEVELS[i].boost) setTool('track');
    updateStarsLive(null);
    updateBudget();
    setRunUI(false);
    particles = [];
    if (showIntro) showIntroModal();
  }

  function restoreTracks() {
    const saved = save.tracks[idx];
    if (!Array.isArray(saved)) return;
    for (const t of saved) {
      const pts = [];
      for (let k = 0; k < t.p.length; k += 2) pts.push({ x: t.p[k], y: t.p[k + 1] });
      if (pts.length < 2) continue;
      const len = E.polyLen(pts);
      const piece = E.buildPiece(pts, t.k, { cost: E.strokeCost(len, t.k) });
      state.pieces.push(piece); state.used += piece.cost; state.history.push(piece);
    }
  }

  function storeTracks() {
    save.tracks[idx] = state.history.map(p => ({
      k: p.kind, p: p.pts.flatMap(q => [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10])
    }));
    persist();
  }

  function updateBudget(extra, over) {
    const lv = state.level;
    const used = state.used, prev = extra || 0;
    $('#budget-fill').style.width = Math.min(100, used / lv.budget * 100) + '%';
    const pv = $('#budget-prev');
    pv.style.left = Math.min(100, used / lv.budget * 100) + '%';
    pv.style.width = Math.max(0, Math.min(100 - used / lv.budget * 100, prev / lv.budget * 100)) + '%';
    $('.budget').classList.toggle('over', !!over);
    const left = Math.max(0, (lv.budget - used - prev) / 40);
    $('#budget-text').textContent = over ? '¡No te llega la vía!' : `Te quedan ${Math.floor(left)} m de vía`;
  }

  function updateStarsLive(set) {
    const items = $$('#stars-live i');
    items.forEach((el, k) => el.classList.toggle('on', !!set && k < set.size));
  }

  function setTool(t) {
    tool = t;
    $$('.tool[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
  }

  // ---------- Modales ----------
  function openModal(html, onReady) {
    $('#modal-card').innerHTML = html;
    show('#modal', true); modalOpen = true;
    if (onReady) onReady($('#modal-card'));
  }
  function closeModal() { show('#modal', false); modalOpen = false; }

  function starsHTML(n, cls) { return `<div class="${cls || 'big-stars'}">${[0, 1, 2].map(k => `<i class="${k < n ? 'on' : ''}">★</i>`).join('')}</div>`; }

  function showIntroModal() {
    const lv = state.level;
    const best = save.best[idx] || 0;
    const newBoost = lv.unlockBoost && !save.seen.boost;
    openModal(`
      <div class="kicker">Nivel ${idx + 1}</div>
      <h2>${lv.name}</h2>
      ${newBoost ? '<div class="emoji">⚡</div>' : ''}
      <p>${lv.hint}</p>
      ${best ? starsHTML(best, 'big-stars small') : ''}
      <div class="actions"><button class="btn go big" data-m="go">¡A construir!</button></div>`, card => {
      card.querySelector('[data-m=go]').onclick = () => { S.init(); S.click(); closeModal(); if (newBoost) { save.seen.boost = true; persist(); setTool('boost'); toast('⚡ Turbo seleccionado: dibuja en la dirección en la que quieres empujar'); } };
    });
  }

  function showHowTo() {
    openModal(`
      <h2>Cómo se juega</h2>
      <ul class="howto">
        <li><b>✏️</b><span>Arrastra el dedo para dibujar la vía. Empieza en el círculo verde de la estación de <u>salida</u>.</span></li>
        <li><b>🏁</b><span>Llévala hasta la <u>meta</u>. Si un trazo empieza o acaba cerca de otro, se unen solos.</span></li>
        <li><b>▶</b><span>Pulsa <u>¡PROBAR!</u> y mira si el vagón llega. Si falla, arregla la vía y vuelve a probar.</span></li>
        <li><b>⭐</b><span>Pasa por las estrellas. Puedes cogerlas también volando.</span></li>
        <li><b>🤢</b><span>Curvas muy cerradas a mucha velocidad = demasiadas fuerzas G = pasajeros vomitando.</span></li>
        <li><b>⚡</b><span>El turbo empuja el vagón en la dirección en la que lo dibujas.</span></li>
      </ul>
      <div class="actions"><button class="btn go" data-m="ok">¡Entendido!</button></div>`, card => {
      card.querySelector('[data-m=ok]').onclick = () => { S.click(); closeModal(); };
    });
  }

  function showResult() {
    resultShown = true;
    S.stopLoops();
    const r = run.result;
    if (r.win) {
      const stars = r.stars;
      const prev = save.best[idx] || 0;
      if (stars > prev || save.best[idx] === undefined) save.best[idx] = Math.max(stars, prev);
      save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, idx + 2));
      persist();
      const isLast = idx === LEVELS.length - 1;
      const msg = stars === 3 ? '¡Perfecto! Todas las estrellas.' : stars === 0 ? 'Has llegado, pero sin estrellas. ¿Te atreves a por ellas?' : `Te ${3 - stars === 1 ? 'ha faltado 1 estrella' : 'han faltado ' + (3 - stars) + ' estrellas'}. ¿Lo intentas otra vez?`;
      openModal(`
        <div class="kicker">Nivel ${idx + 1} · ${state.level.name}</div>
        <h2>${isLast && stars === 3 ? '¡Eres un crack! 🏆' : '¡Ha llegado! 🎉'}</h2>
        ${starsHTML(0)}
        <p>${msg}</p>
        <div class="stats"><span>🚀 ${Math.round(vmax * PX_TO_KMH)} km/h máx.</span><span>🌀 ${run.gmax.toFixed(1)} G máx.</span><span>⏱️ ${r.time.toFixed(1)} s</span></div>
        <div class="actions">
          <button class="btn small" data-m="levels">☰ Niveles</button>
          <button class="btn small" data-m="retry">🔧 Mejorar</button>
          ${isLast ? '' : '<button class="btn go" data-m="next">Siguiente ▶</button>'}
        </div>`, card => {
        const st = card.querySelectorAll('.big-stars i');
        for (let k = 0; k < stars; k++) setTimeout(() => { st[k].classList.add('on'); S.starAward(k); }, 350 + k * 320);
        card.querySelector('[data-m=levels]').onclick = () => { S.click(); goLevels(); };
        card.querySelector('[data-m=retry]').onclick = () => { S.click(); closeModal(); stopRun(); };
        const nx = card.querySelector('[data-m=next]');
        if (nx) nx.onclick = () => { S.click(); closeModal(); startLevel(idx + 1, true); };
      });
    } else {
      const [emoji, title, text] = REASONS[r.reason] || ['💥', '¡Ups!', 'Algo ha salido mal.'];
      openModal(`
        <div class="emoji">${emoji}</div>
        <h2>${title}</h2>
        <p>${text}</p>
        <div class="actions">
          <button class="btn small" data-m="levels">☰ Niveles</button>
          <button class="btn go" data-m="fix">🔧 Arreglar la vía</button>
        </div>`, card => {
        card.querySelector('[data-m=levels]').onclick = () => { S.click(); goLevels(); };
        card.querySelector('[data-m=fix]').onclick = () => { S.click(); closeModal(); stopRun(); };
      });
    }
  }

  function confirmClear() {
    if (!state.history.length) { toast('No hay vía que borrar'); return; }
    openModal(`
      <div class="emoji">🗑️</div><h2>¿Borrar toda la vía?</h2>
      <p>Se quitarán todos los trozos que has dibujado en este nivel.</p>
      <div class="actions"><button class="btn small" data-m="no">Mejor no</button><button class="btn go" data-m="yes" style="background:var(--stop);box-shadow:0 6px 0 var(--stop-dark)">Sí, borrar</button></div>`, card => {
      card.querySelector('[data-m=no]').onclick = () => { S.click(); closeModal(); };
      card.querySelector('[data-m=yes]').onclick = () => { E.clearAll(state); storeTracks(); updateBudget(); S.erase(); closeModal(); };
    });
  }

  // ---------- Recorrido ----------
  function setRunUI(running) {
    show('#tools', !running); show('#gauges', running);
    const b = $('#btn-run');
    b.classList.toggle('stop', running);
    b.innerHTML = running ? '<span>■</span><small>PARAR</small>' : '<span>▶</span><small>¡PROBAR!</small>';
  }

  function startRun() {
    if (run) return;
    S.init(); S.go();
    drawing = null; eraser = null;
    run = E.createRun(state);
    resultShown = false; resultTimer = 0; vmax = 0; flipPiece = null;
    updateStarsLive(run.stars);
    setRunUI(true);
  }

  function stopRun(silent) {
    if (!run) return;
    run = null; S.stopLoops();
    if (state) { updateStarsLive(null); setRunUI(false); }
    if (!silent) S.click();
  }

  function cartFromRun(r) {
    if (r.mode === 'air' || r.piece !== flipPiece || flipMode !== r.mode) {
      flip = Math.cos(r.angle) >= 0 ? 1 : -1;
      flipPiece = r.piece; flipMode = r.mode;
    }
    return {
      x: r.x, y: r.y, angle: r.angle, flip,
      armsUp: r.mode === 'air' || r.g > 2.6 || r.mode === 'win', susto: r.susto, boost: r.boosting
    };
  }

  function parkedCart(st) {
    const sp = st.pieces.find(p => p.kind === 'start');
    const sm = E.sampleAt(sp, Math.min(40, sp.len * 0.2));
    return { x: sm.x, y: sm.y, angle: Math.atan2(sm.ty, sm.tx), flip: 1 };
  }

  function updateRun(dt) {
    E.step(state, run, dt);
    vmax = Math.max(vmax, run.speed);
    for (const ev of run.events) handleEvent(ev);
    run.events.length = 0;
    // humo/chispas
    if (!run.result || run.mode === 'win') {
      if (run.boosting && Math.random() < 0.7) spawn(run.x, run.y - 10, 1, { color: Math.random() < 0.5 ? '#ffb21e' : '#fff3a0', speed: 60, life: 0.4, size: 5 });
      if (run.speed > 650 && Math.random() < 0.3) spawn(run.x, run.y - 14, 1, { color: 'rgba(255,255,255,0.8)', speed: 20, life: 0.3, size: 3 });
    }
    S.update(run.speed, run.mode === 'air', run.boosting, !run.result || run.mode === 'win');
    // indicadores
    $('#g-speed').textContent = Math.round(run.speed * PX_TO_KMH);
    const g = run.mode === 'air' ? 0 : run.g;
    $('#g-gbar').style.height = Math.min(100, g / 8 * 100) + '%';
    $('#g-gbar').style.background = g > E.G_LIMIT ? 'var(--stop)' : g > 3.5 ? 'var(--boost)' : 'var(--go)';
    $('#g-gval').textContent = run.mode === 'air' ? '¡vuela!' : g.toFixed(1) + ' G';
    $('#g-susto').style.height = Math.round(run.susto * 100) + '%';
    $('#g-face').textContent = run.mode === 'crash' ? '😵' : run.susto > 0.75 ? '🤢' : run.susto > 0.4 ? '😖' : run.mode === 'air' ? '😆' : run.g > 3.5 ? '😬' : '😀';
    if (run.result && !resultShown) {
      resultTimer += dt;
      if (resultTimer > (run.result.win ? 1.5 : 1.3)) showResult();
    }
  }

  function handleEvent(ev) {
    switch (ev.type) {
      case 'star':
        S.star(run.stars.size - 1); updateStarsLive(run.stars);
        spawn(ev.x, ev.y, 14, { color: '#ffd43b', speed: 260, life: 0.8, size: 9, shape: 'star', gravity: 300 });
        break;
      case 'land':
        S.land(ev.impact || 0); shake = Math.min(14, 4 + (ev.impact || 0) / 40);
        spawn(ev.x, ev.y, 10, { color: 'rgba(220,200,170,0.9)', speed: 140, life: 0.5, size: 6, gravity: 200 });
        break;
      case 'launch': S.launch(); break;
      case 'crash':
        S.crash(); shake = 22;
        spawn(ev.x, ev.y - 16, 22, { color: '#e8453c', speed: 420, life: 1.4, size: 7, shape: 'rect', gravity: 700 });
        spawn(ev.x, ev.y - 16, 10, { color: '#ffd43b', speed: 380, life: 1.2, size: 5, shape: 'rect', gravity: 700 });
        spawn(ev.x, ev.y - 10, 18, { color: 'rgba(90,90,90,0.6)', speed: 120, life: 1.2, size: 14, gravity: -40 });
        break;
      case 'win':
        S.win();
        for (let k = 0; k < 4; k++) setTimeout(() => {
          if (!run) return;
          const cols = ['#ff4757', '#ffd43b', '#2ee59d', '#3867d6', '#ff9ff3'];
          spawn(ev.x + (Math.random() - 0.5) * 300, ev.y - 200 - Math.random() * 100, 24, { colors: cols, speed: 360, life: 1.8, size: 6, shape: 'rect', gravity: 420 });
        }, k * 180);
        break;
    }
  }

  // ---------- Partículas ----------
  function spawn(x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = o.speed * (0.3 + Math.random() * 0.7);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.lift || 0), life: o.life * (0.6 + Math.random() * 0.4), max: o.life,
        color: o.colors ? o.colors[(Math.random() * o.colors.length) | 0] : o.color, size: o.size * (0.6 + Math.random() * 0.6),
        shape: o.shape, gravity: o.gravity || 0, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10
      });
    }
    if (particles.length > 400) particles.splice(0, particles.length - 400);
  }
  function updateParticles(dt) {
    for (const p of particles) {
      p.life -= dt; p.vy += p.gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      p.vx *= 0.985; p.vy *= 0.985;
    }
    particles = particles.filter(p => p.life > 0);
  }

  // ---------- Dibujar con el dedo ----------
  function snapDist() { return Math.max(E.SNAP_DIST, 34 / R.getView().scale); }
  function eraseRadius() { return Math.max(26, 26 / R.getView().scale); }

  function eraseAt(w) {
    const p = E.pieceAt(state, w.x, w.y, eraseRadius());
    if (p && E.removePiece(state, p)) {
      S.erase();
      const mid = E.sampleAt(p, p.len / 2);
      spawn(mid.x, mid.y, 14, { color: p.kind === 'boost' ? '#ffb21e' : '#ff4757', speed: 200, life: 0.6, size: 6, shape: 'rect', gravity: 500 });
      storeTracks(); updateBudget();
    }
  }

  canvas.addEventListener('pointerdown', e => {
    if (screen !== 'game' || run || modalOpen || drawing) return;
    S.init();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    const w = R.toWorld(e.clientX, e.clientY);
    if (tool === 'erase') { drawing = { id: e.pointerId, erase: true }; eraser = { x: w.x, y: w.y, r: eraseRadius() }; eraseAt(w); return; }
    drawing = { id: e.pointerId, raw: [w], prep: null, dirty: true, kind: tool };
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', e => {
    if (screen === 'game' && tool === 'erase' && !run && !drawing && e.pointerType === 'mouse') {
      const w = R.toWorld(e.clientX, e.clientY); eraser = { x: w.x, y: w.y, r: eraseRadius() };
    }
    if (!drawing || e.pointerId !== drawing.id) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ce of evs) {
      const w = R.toWorld(ce.clientX, ce.clientY);
      if (drawing.erase) { eraser = { x: w.x, y: w.y, r: eraseRadius() }; eraseAt(w); continue; }
      const lastP = drawing.raw[drawing.raw.length - 1];
      if (Math.hypot(w.x - lastP.x, w.y - lastP.y) > 2) { drawing.raw.push(w); drawing.dirty = true; }
    }
    e.preventDefault();
  });

  function endDraw(e) {
    if (!drawing || e.pointerId !== drawing.id) return;
    const d = drawing; drawing = null;
    if (d.erase) { if (e.pointerType !== 'mouse') eraser = null; return; }
    const r = E.addStroke(state, d.raw, d.kind, snapDist());
    if (r.ok) {
      S.place(); storeTracks();
      const end = E.endpoint(r.piece, 'B');
      spawn(end.x, end.y, 6, { color: 'rgba(255,255,255,0.9)', speed: 120, life: 0.4, size: 4 });
      if (state.pieces.some(p => p.kind === 'goal') && isConnectedToGoal()) toast('✅ ¡Vía unida a la meta! Pulsa ¡PROBAR!');
    } else if (r.reason === 'obstaculo') { S.error(); toast('🚫 No se puede construir encima de rocas ni en zonas rojas'); }
    else if (r.reason === 'presupuesto') { S.error(); toast('😬 No te queda vía suficiente. Borra algún trozo o hazlo más corto'); }
    updateBudget();
  }
  canvas.addEventListener('pointerup', endDraw);
  canvas.addEventListener('pointercancel', endDraw);
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !drawing) eraser = null; });

  // ¿Hay un camino de vías unidas desde la salida hasta la meta?
  function isConnectedToGoal() {
    const start = state.pieces.find(p => p.kind === 'start');
    const seen = new Set([start]), stack = [start];
    while (stack.length) {
      const p = stack.pop();
      if (p.kind === 'goal') return true;
      for (const end of ['A', 'B']) {
        const e = E.endpoint(p, end);
        for (const q of state.pieces) {
          if (seen.has(q)) continue;
          const qa = E.endpoint(q, 'A'), qb = E.endpoint(q, 'B');
          if (Math.hypot(e.x - qa.x, e.y - qa.y) < 2.5 || Math.hypot(e.x - qb.x, e.y - qb.y) < 2.5) { seen.add(q); stack.push(q); }
        }
      }
    }
    return false;
  }

  // ---------- Botones ----------
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act], [data-tool]');
    if (!el) return;
    S.init();
    if (el.dataset.tool) { if (run) return; S.click(); setTool(el.dataset.tool); if (el.dataset.tool !== 'erase') eraser = null; return; }
    switch (el.dataset.act) {
      case 'menu': S.click(); goMenu(); break;
      case 'levels': S.click(); goLevels(); break;
      case 'undo': if (run) return; if (E.undo(state)) { S.erase(); storeTracks(); updateBudget(); } else toast('No hay nada que deshacer'); break;
      case 'clear': if (run) return; S.click(); confirmClear(); break;
      case 'hint': if (run) return; S.click(); showIntroModal(); break;
      case 'howto': S.click(); showHowTo(); break;
      case 'mute': save.muted = !save.muted; S.setMuted(save.muted); persist(); updateMuteIcons(); if (!save.muted) S.click(); break;
      case 'ignore-rotate': ignoreRotate = true; checkRotate(); break;
    }
  });
  function updateMuteIcons() { $$('.ico-sound').forEach(s => s.textContent = save.muted ? '🔇' : '🔊'); }
  updateMuteIcons();

  $('#btn-play').addEventListener('click', () => {
    S.init(); S.click();
    if (!save.seen.howto) { save.seen.howto = true; persist(); }
    goLevels();
  });
  $('#btn-run').addEventListener('click', () => {
    if (modalOpen) return;
    if (run) stopRun(); else startRun();
  });

  window.addEventListener('keydown', e => {
    if (screen !== 'game') return;
    if (modalOpen) { if (e.key === 'Enter') { const b = $('#modal-card .btn.go'); if (b) b.click(); } return; }
    if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); $('#btn-run').click(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (!run && E.undo(state)) { S.erase(); storeTracks(); updateBudget(); } }
    else if (!run && e.key === '1') setTool('track');
    else if (!run && e.key === '2' && state.level.boost) setTool('boost');
    else if (!run && e.key === '3') setTool('erase');
    else if (e.key === 'Escape') { if (run) stopRun(); else goLevels(); }
  });

  // ---------- Bucle principal ----------
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    if (screen !== 'game') {
      updateDemo(dt);
      if (demo) R.frame({ state: demo.state, idx: 0, t: time, cart: cartFromRun(demo.run), run: demo.run });
    } else if (state) {
      if (run) updateRun(dt);
      if (drawing && !drawing.erase && drawing.dirty) {
        drawing.prep = E.prepareStroke(state, drawing.raw, drawing.kind, snapDist());
        drawing.dirty = false;
        updateBudget(drawing.prep.cost || 0, drawing.prep.reason === 'presupuesto');
      }
      updateParticles(dt);
      shake *= Math.pow(0.02, dt);
      const crashed = run && run.mode === 'crash';
      R.frame({
        state, idx, t: time, run,
        cart: crashed ? null : run ? cartFromRun(run) : parkedCart(state),
        particles, shake: shake > 0.3 ? shake : 0,
        preview: drawing && !drawing.erase ? drawing.prep : null, kind: drawing ? drawing.kind : tool,
        showEnds: !run, tutorial: idx === 0 && state.history.length === 0 && !drawing,
        eraser: !run && tool === 'erase' ? eraser : null
      });
    }
    requestAnimationFrame(loop);
  }

  // ---------- Arranque ----------
  relayout();
  goMenu();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => relayout());
  requestAnimationFrame(t => { last = t; loop(t); });
})();
