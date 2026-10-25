/* =========================================================
   AGÁRRATE · Dibujado (canvas 2D)
   ========================================================= */
(function (root) {
  'use strict';
  const E = root.Engine;
  const { W, H, GROUND } = E;

  const THEMES = {
    day: {
      sky: ['#4fb8ff', '#c4ecff'], body: '#fff6c2', bodyGlow: 'rgba(255,240,150,0.45)',
      far: '#a7df93', near: '#73c464', ground: '#8a5a34', grass: '#5cb84c', soil: '#6e4426',
      support: '#efe2c8', brace: '#cfb98f', cloud: 'rgba(255,255,255,0.9)', night: false
    },
    sunset: {
      sky: ['#ff6f5e', '#ffd58c'], body: '#fff0b8', bodyGlow: 'rgba(255,220,140,0.5)',
      far: '#d48a96', near: '#ab5d7c', ground: '#6e3b38', grass: '#8f4f63', soil: '#58302d',
      support: '#f6dcc6', brace: '#d7b096', cloud: 'rgba(255,236,220,0.85)', night: false
    },
    night: {
      sky: ['#0c1033', '#3b3f8c'], body: '#f6f1cf', bodyGlow: 'rgba(240,235,200,0.25)',
      far: '#2d3374', near: '#1f2459', ground: '#2c2238', grass: '#3d3b7a', soil: '#231a2d',
      support: '#8b90cf', brace: '#666bb0', cloud: 'rgba(170,175,230,0.35)', night: true
    }
  };

  const KIND_STYLE = {
    start: { rail: '#cfd8e3', tie: '#4b5563' },
    goal: { rail: '#cfd8e3', tie: '#4b5563' },
    track: { rail: '#ff4757', tie: '#5b3a29' },
    boost: { rail: '#ffb21e', tie: '#5b3a29' }
  };

  let canvas, ctx, dpr = 1, cw = 0, ch = 0;
  let view = { scale: 1, ox: 0, oy: 0 };
  let bgCache = null, bgKey = '';
  const pieceCache = new WeakMap();
  let stripePattern = null;

  function setup(c) { canvas = c; ctx = c.getContext('2d'); }

  function layout(w, h, railL, railR, ratio) {
    dpr = ratio; cw = w; ch = h;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const availW = Math.max(100, w - railL - railR);
    const scale = Math.min(availW / W, h / H);
    view = { scale, ox: railL + (availW - W * scale) / 2, oy: (h - H * scale) / 2 };
    bgKey = ''; stripePattern = null;
    return view;
  }

  const toWorld = (sx, sy) => ({ x: (sx - view.ox) / view.scale, y: (sy - view.oy) / view.scale });
  const worldT = () => ctx.setTransform(view.scale * dpr, 0, 0, view.scale * dpr, view.ox * dpr, view.oy * dpr);

  // ---------- Fondo (se dibuja una vez y se guarda) ----------
  function hill(c, x0, x1, base, amp, freq, phase, color) {
    c.fillStyle = color; c.beginPath(); c.moveTo(x0, H + 400);
    for (let x = x0; x <= x1; x += 8) {
      const y = base - amp * (0.6 * Math.sin(x * freq + phase) + 0.4 * Math.sin(x * freq * 2.3 + phase * 1.7));
      c.lineTo(x, y);
    }
    c.lineTo(x1, H + 400); c.closePath(); c.fill();
  }

  function seeded(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  function buildBackground(level, idx) {
    const key = idx + '|' + cw + 'x' + ch + '|' + dpr;
    if (key === bgKey && bgCache) return;
    bgKey = key;
    bgCache = document.createElement('canvas');
    bgCache.width = canvas.width; bgCache.height = canvas.height;
    const c = bgCache.getContext('2d');
    const th = THEMES[level.theme] || THEMES.day;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    c.fillStyle = g; c.fillRect(0, 0, cw, ch);

    c.setTransform(view.scale * dpr, 0, 0, view.scale * dpr, view.ox * dpr, view.oy * dpr);
    const x0 = -view.ox / view.scale - 20, x1 = (cw - view.ox) / view.scale + 20;
    const yTop = -view.oy / view.scale;
    const rnd = seeded(1234 + idx * 77);

    if (th.night) {
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 140; i++) {
        const x = x0 + rnd() * (x1 - x0), y = yTop + rnd() * (560 - yTop), r = rnd() * 2.2 + 0.4;
        c.globalAlpha = 0.3 + rnd() * 0.7; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }
    // Sol / luna
    const sx = 1260 - idx * 40, sy = th.night ? 140 : 150;
    const glow = c.createRadialGradient(sx, sy, 10, sx, sy, 190);
    glow.addColorStop(0, th.bodyGlow); glow.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = glow; c.beginPath(); c.arc(sx, sy, 190, 0, Math.PI * 2); c.fill();
    c.fillStyle = th.body; c.beginPath(); c.arc(sx, sy, 58, 0, Math.PI * 2); c.fill();
    if (th.night) { c.fillStyle = th.sky[0]; c.globalAlpha = 0.25; c.beginPath(); c.arc(sx + 18, sy - 10, 14, 0, 7); c.arc(sx - 20, sy + 18, 9, 0, 7); c.fill(); c.globalAlpha = 1; }

    // Nubes
    c.fillStyle = th.cloud;
    for (let i = 0; i < 7; i++) {
      const cx = x0 + rnd() * (x1 - x0), cy = 90 + rnd() * 260, s = 0.6 + rnd() * 0.9;
      c.beginPath();
      c.ellipse(cx, cy, 70 * s, 26 * s, 0, 0, 7);
      c.ellipse(cx - 45 * s, cy + 6 * s, 42 * s, 20 * s, 0, 0, 7);
      c.ellipse(cx + 48 * s, cy + 8 * s, 46 * s, 18 * s, 0, 0, 7);
      c.ellipse(cx + 8 * s, cy - 18 * s, 40 * s, 24 * s, 0, 0, 7);
      c.fill();
    }
    hill(c, x0, x1, 640, 90, 0.004, idx * 1.3, th.far);
    hill(c, x0, x1, 760, 70, 0.007, idx * 2.1 + 1, th.near);

    // Suelo (con barrancos donde haya zonas que llegan al suelo)
    const gaps = (level.obstacles || []).filter(o => o.type === 'zone' && o.shape !== 'circle' && o.y + o.h >= GROUND - 1)
      .map(o => [o.x, o.x + o.w]).sort((a, b) => a[0] - b[0]);
    const yBot = (ch - view.oy) / view.scale + 10;
    let cur = x0;
    const groundSeg = (a, b) => {
      if (b <= a) return;
      c.fillStyle = th.ground; c.fillRect(a, GROUND, b - a, yBot - GROUND);
      c.fillStyle = th.soil;
      for (let x = Math.ceil(a / 40) * 40; x < b - 10; x += 40) { c.fillRect(x + ((x / 40) % 2) * 14, GROUND + 22, 12, 5); }
      c.fillStyle = th.grass; c.fillRect(a, GROUND - 4, b - a, 14);
    };
    for (const [a, b] of gaps) {
      groundSeg(cur, a);
      const cg = c.createLinearGradient(0, GROUND, 0, yBot);
      cg.addColorStop(0, 'rgba(20,10,20,0.85)'); cg.addColorStop(1, '#0b0610');
      c.fillStyle = cg; c.fillRect(a, GROUND, b - a, yBot - GROUND);
      c.fillStyle = '#2f7fd8'; c.fillRect(a, GROUND + 26, b - a, yBot - GROUND);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      for (let x = a + 10; x < b - 10; x += 34) c.fillRect(x, GROUND + 28, 16, 2);
      cur = b;
    }
    groundSeg(cur, x1);
    bgKey = key;
  }

  // ---------- Vías ----------
  function getPieceCache(state, p) {
    let pc = pieceCache.get(p);
    if (pc) return pc;
    const obs = state.level.obstacles || [];
    const supports = new Path2D(), braces = new Path2D();
    const posts = [];
    for (let s = 6; s < p.len - 2; s += 54) {
      const sm = E.sampleAt(p, s);
      let bottom = GROUND;
      for (const o of obs) {
        if (o.type !== 'rock' || o.shape === 'circle') continue;
        if (sm.x > o.x && sm.x < o.x + o.w && o.y > sm.y) bottom = Math.min(bottom, o.y);
        if (sm.x > o.x && sm.x < o.x + o.w && o.y <= sm.y && o.y + o.h >= sm.y) bottom = -1;
      }
      for (const o of obs) if (o.type === 'zone' && sm.x > o.x && sm.x < o.x + o.w && o.y + o.h >= GROUND - 1) bottom = GROUND + 40;
      if (bottom < 0 || sm.y + 8 >= bottom) { posts.push(null); continue; }
      posts.push({ x: sm.x, top: sm.y + 6, bottom });
      supports.moveTo(sm.x, sm.y + 6); supports.lineTo(sm.x, bottom);
    }
    for (let i = 1; i < posts.length; i++) {
      const a = posts[i - 1], b = posts[i];
      if (!a || !b || Math.abs(a.x - b.x) < 8) continue;
      const top = Math.max(a.top, b.top) + 30, bot = Math.min(a.bottom, b.bottom);
      for (let y = bot - 30; y > top; y -= 70) {
        braces.moveTo(a.x, y); braces.lineTo(b.x, y - 40 > top ? y - 40 : y);
        braces.moveTo(a.x, y); braces.lineTo(b.x, y);
      }
    }
    const ties = new Path2D();
    for (let s = 3; s < p.len; s += 11) {
      const sm = E.sampleAt(p, s);
      const nx = -sm.ty, ny = sm.tx;
      ties.moveTo(sm.x + nx * 8, sm.y + ny * 8); ties.lineTo(sm.x - nx * 8, sm.y - ny * 8);
    }
    const railA = new Path2D(), railB = new Path2D(), spine = new Path2D();
    for (let i = 0; i < p.n; i++) {
      const nx = -p.ty[i], ny = p.tx[i];
      const ax = p.x[i] + nx * 5, ay = p.y[i] + ny * 5, bx = p.x[i] - nx * 5, by = p.y[i] - ny * 5;
      if (i === 0) { railA.moveTo(ax, ay); railB.moveTo(bx, by); spine.moveTo(p.x[i], p.y[i]); }
      else { railA.lineTo(ax, ay); railB.lineTo(bx, by); spine.lineTo(p.x[i], p.y[i]); }
    }
    pc = { supports, braces, ties, railA, railB, spine };
    pieceCache.set(p, pc);
    return pc;
  }

  function drawStation(level, th, isGoal, t) {
    const pts = isGoal ? level.goal : level.start;
    const xa = pts[0][0], xb = pts[pts.length - 1][0], y = pts[0][1];
    // plataforma
    ctx.fillStyle = '#8d96a3'; ctx.fillRect(xa + 30, y + 10, 26, GROUND - y - 10); ctx.fillRect(xb - 56, y + 10, 26, GROUND - y - 10);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(xa + 48, y + 10, 8, GROUND - y - 10); ctx.fillRect(xb - 38, y + 10, 8, GROUND - y - 10);
    ctx.fillStyle = '#5f6b7a'; roundRect(xa - 6, y + 8, xb - xa + 12, 18, 5); ctx.fill();
    ctx.fillStyle = isGoal ? '#20bf6b' : '#3867d6';
    roundRect(xa - 6, y + 8, xb - xa + 12, 6, 3); ctx.fill();
    // tejado
    const roofY = y - 92;
    ctx.fillStyle = '#4b5563'; ctx.fillRect(xa + 14, roofY + 10, 7, 92 - 10); ctx.fillRect(xb - 21, roofY + 10, 7, 92 - 10);
    ctx.fillStyle = isGoal ? '#20bf6b' : '#3867d6';
    ctx.beginPath(); ctx.moveTo(xa - 14, roofY + 16); ctx.lineTo(xa + 20, roofY - 6); ctx.lineTo(xb - 20, roofY - 6); ctx.lineTo(xb + 14, roofY + 16); ctx.closePath(); ctx.fill();
    // rayas del toldo
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let x = xa - 4; x < xb; x += 36) { ctx.beginPath(); ctx.moveTo(x, roofY + 16); ctx.lineTo(x + 14, roofY + 16); ctx.lineTo(x + 18, roofY - 6); ctx.lineTo(x + 6, roofY - 6); ctx.closePath(); ctx.fill(); }
    // cartel
    const label = isGoal ? 'META' : 'SALIDA';
    ctx.font = '900 26px "Lilita One", "Baloo 2", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cx = (xa + xb) / 2, tw = ctx.measureText(label).width + 30;
    ctx.fillStyle = '#fff'; roundRect(cx - tw / 2, roofY - 46, tw, 38, 10); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = isGoal ? '#20bf6b' : '#3867d6'; ctx.stroke();
    ctx.fillStyle = '#1e2433'; ctx.fillText(label, cx, roofY - 26);
    if (isGoal) {
      // bandera a cuadros ondeando
      const fx = xb + 2, fy = y - 150;
      ctx.fillStyle = '#374151'; ctx.fillRect(fx - 3, fy, 6, 150);
      const cols = 5, rows = 3, cs = 12;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const wave = Math.sin(t * 6 + c * 0.9) * 4;
        ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff';
        ctx.fillRect(fx + 3 + c * cs, fy + 4 + r * cs + wave, cs, cs);
      }
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawPieces(state, th, t) {
    // 1) soportes detrás
    for (const p of state.pieces) {
      if (p.kind === 'start' || p.kind === 'goal') continue;
      const pc = getPieceCache(state, p);
      ctx.strokeStyle = th.brace; ctx.lineWidth = 2.5; ctx.stroke(pc.braces);
      ctx.strokeStyle = th.support; ctx.lineWidth = 5; ctx.stroke(pc.supports);
    }
    drawStation(state.level, th, false, t);
    drawStation(state.level, th, true, t);
    // 2) traviesas y raíles
    for (const p of state.pieces) {
      const pc = getPieceCache(state, p);
      const st = KIND_STYLE[p.kind] || KIND_STYLE.track;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 16; ctx.stroke(pc.spine);
      ctx.strokeStyle = st.tie; ctx.lineWidth = 3.4; ctx.stroke(pc.ties);
      ctx.strokeStyle = st.rail; ctx.lineWidth = 4; ctx.stroke(pc.railA); ctx.stroke(pc.railB);
      if (p.kind === 'boost') {
        ctx.fillStyle = '#fff6b0';
        const off = (t * 120) % 34;
        for (let s = off + 8; s < p.len - 8; s += 34) {
          const sm = E.sampleAt(p, s);
          ctx.save(); ctx.translate(sm.x, sm.y); ctx.rotate(Math.atan2(sm.ty, sm.tx));
          ctx.beginPath(); ctx.moveTo(-6, -7); ctx.lineTo(3, 0); ctx.lineTo(-6, 7); ctx.lineTo(-2, 0); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  // ---------- Obstáculos ----------
  function getStripe() {
    if (stripePattern) return stripePattern;
    const c = document.createElement('canvas'); c.width = c.height = 24;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(255,60,60,0.10)'; x.fillRect(0, 0, 24, 24);
    x.strokeStyle = 'rgba(255,60,60,0.35)'; x.lineWidth = 6;
    x.beginPath(); x.moveTo(-6, 30); x.lineTo(30, -6); x.moveTo(-18, 18); x.lineTo(18, -18); x.moveTo(6, 42); x.lineTo(42, 6); x.stroke();
    stripePattern = ctx.createPattern(c, 'repeat');
    return stripePattern;
  }

  function drawObstacles(level, th, t) {
    for (const o of level.obstacles || []) {
      if (o.type === 'zone') {
        ctx.save();
        ctx.fillStyle = getStripe();
        ctx.fillRect(o.x, o.y, o.w, Math.min(o.h, GROUND - o.y));
        ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 20;
        ctx.strokeStyle = 'rgba(255,70,70,0.75)'; ctx.lineWidth = 3;
        ctx.strokeRect(o.x, o.y + 2, o.w, Math.min(o.h, GROUND - o.y) - 2);
        ctx.setLineDash([]);
        ctx.font = '800 22px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        const ly = Math.max(o.y + 40, 150);
        roundRect(o.x + o.w / 2 - 70, ly, 140, 34, 17); ctx.fill();
        ctx.fillStyle = '#e8453c'; ctx.fillText('🚫 No construir', o.x + o.w / 2, ly + 18);
        ctx.restore();
      } else if (o.shape === 'circle') {
        const g = ctx.createRadialGradient(o.x - o.r * 0.35, o.y - o.r * 0.4, o.r * 0.1, o.x, o.y, o.r);
        g.addColorStop(0, th.night ? '#9a9fc0' : '#c3c7cf'); g.addColorStop(1, th.night ? '#4a4e72' : '#6e737d');
        ctx.fillStyle = g; ctx.beginPath();
        for (let i = 0; i <= 14; i++) {
          const a = i / 14 * Math.PI * 2, rr = o.r * (0.92 + 0.08 * Math.sin(i * 2.7 + o.x));
          ctx.lineTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.arc(o.x + o.r * 0.3, o.y + o.r * 0.25, o.r * 0.22, 0, 7); ctx.fill();
      } else {
        const hgt = Math.min(o.h, GROUND + 6 - o.y);
        const g = ctx.createLinearGradient(o.x, 0, o.x + o.w, 0);
        g.addColorStop(0, th.night ? '#555a85' : '#8b9099'); g.addColorStop(1, th.night ? '#3c4068' : '#6b707a');
        ctx.fillStyle = g; ctx.fillRect(o.x, o.y, o.w, hgt);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
        for (let y = o.y + 34, r = 0; y < o.y + hgt; y += 34, r++) {
          ctx.beginPath(); ctx.moveTo(o.x, y); ctx.lineTo(o.x + o.w, y); ctx.stroke();
          for (let x = o.x + (r % 2 ? 22 : 48); x < o.x + o.w; x += 52) { ctx.beginPath(); ctx.moveTo(x, y - 34); ctx.lineTo(x, y); ctx.stroke(); }
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 3; ctx.strokeRect(o.x, o.y, o.w, hgt);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(o.x, o.y, o.w, 6);
      }
    }
  }

  // ---------- Estrellas ----------
  function starPath(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  function drawStars(level, got, t) {
    (level.stars || []).forEach((s, i) => {
      if (got && got.has(i)) {
        ctx.globalAlpha = 0.25; starPath(s[0], s[1], 20); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1;
        return;
      }
      const bob = Math.sin(t * 3 + i) * 5, spin = 1 + Math.sin(t * 2 + i * 2) * 0.08;
      ctx.save(); ctx.translate(s[0], s[1] + bob); ctx.scale(spin, 1);
      const glow = ctx.createRadialGradient(0, 0, 5, 0, 0, 46);
      glow.addColorStop(0, 'rgba(255,230,90,0.55)'); glow.addColorStop(1, 'rgba(255,230,90,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 46, 0, 7); ctx.fill();
      starPath(0, 0, 24); ctx.fillStyle = '#ffd43b'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#e09a00'; ctx.stroke();
      starPath(-3, -4, 9); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
      ctx.restore();
    });
  }

  // ---------- Vagón ----------
  function drawCart(x, y, angle, flip, opts) {
    opts = opts || {};
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(1, flip);
    const scared = opts.susto || 0, armsUp = opts.armsUp;
    // pasajeros
    const heads = [[-10, -40, '#ffcc99', '#5b3a29'], [12, -40, '#e9b48a', '#f2c94c']];
    heads.forEach(([hx, hy, skin, hair], i) => {
      if (armsUp) {
        ctx.strokeStyle = skin; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx - 6, hy + 10); ctx.lineTo(hx - 12, hy - 14); ctx.moveTo(hx + 6, hy + 10); ctx.lineTo(hx + 12, hy - 14); ctx.stroke();
      }
      ctx.fillStyle = scared > 0.5 ? '#b7e4a0' : skin;
      ctx.beginPath(); ctx.arc(hx, hy, 9, 0, 7); ctx.fill();
      ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(hx, hy - 3, 9, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      ctx.fillStyle = '#1e2433';
      ctx.beginPath(); ctx.arc(hx + 3, hy - 1, 1.6, 0, 7); ctx.arc(hx + 7, hy - 1, 1.6, 0, 7); ctx.fill();
      ctx.strokeStyle = '#1e2433'; ctx.lineWidth = 1.6; ctx.beginPath();
      if (scared > 0.5) { ctx.moveTo(hx + 1, hy + 5); ctx.quadraticCurveTo(hx + 5, hy + 2, hx + 9, hy + 5); }
      else if (armsUp) { ctx.arc(hx + 5, hy + 4, 3, 0, Math.PI * 2); }
      else { ctx.moveTo(hx + 1, hy + 3); ctx.quadraticCurveTo(hx + 5, hy + 7, hx + 9, hy + 3); }
      ctx.stroke();
    });
    // carrocería
    ctx.fillStyle = '#e8453c'; roundRect(-30, -32, 60, 24, 8); ctx.fill();
    ctx.fillStyle = '#ffd43b'; ctx.fillRect(-30, -22, 60, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; roundRect(-26, -30, 36, 5, 2.5); ctx.fill();
    ctx.fillStyle = '#b8322b'; roundRect(22, -36, 10, 30, 4); ctx.fill();
    // ruedas
    ctx.fillStyle = '#1e2433';
    ctx.beginPath(); ctx.arc(-18, -6, 6, 0, 7); ctx.arc(18, -6, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#9aa3b2';
    ctx.beginPath(); ctx.arc(-18, -6, 2.5, 0, 7); ctx.arc(18, -6, 2.5, 0, 7); ctx.fill();
    if (opts.boost) {
      ctx.fillStyle = 'rgba(255,170,40,0.85)';
      ctx.beginPath(); ctx.moveTo(-32, -26); ctx.lineTo(-58 - Math.random() * 16, -19); ctx.lineTo(-32, -12); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- Partículas ----------
  function drawParticles(list) {
    for (const p of list) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.shape === 'star') { starPath(p.x, p.y, p.size); ctx.fill(); }
      else if (p.shape === 'rect') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2); ctx.restore();
      } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Vista previa del trazo y extremos libres ----------
  function drawPreview(prev, kind) {
    if (!prev || !prev.pts || prev.pts.length < 2) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); prev.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    const bad = !prev.ok && prev.reason !== 'corto';
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 16; ctx.stroke();
    ctx.setLineDash(bad ? [10, 10] : []);
    ctx.strokeStyle = bad ? '#ff2d2d' : (kind === 'boost' ? '#ffb21e' : '#ff4757'); ctx.lineWidth = 7; ctx.stroke();
    ctx.restore();
    [prev.snapA, prev.snapB].forEach(s => {
      if (!s) return;
      ctx.strokeStyle = '#2ee59d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.x, s.y, 14, 0, 7); ctx.stroke();
    });
  }

  function drawFreeEnds(state, t, tutorial) {
    for (const p of state.pieces) {
      for (const end of ['A', 'B']) {
        if ((end === 'A' && p.lockA) || (end === 'B' && p.lockB)) continue;
        if (!E.isEndFree(state, p, end)) continue;
        const e = E.endpoint(p, end);
        const main = p.kind === 'start';
        const pulse = 1 + Math.sin(t * 5) * 0.18;
        ctx.strokeStyle = main ? '#2ee59d' : 'rgba(255,255,255,0.9)';
        ctx.lineWidth = main ? 5 : 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, (main ? 16 : 11) * pulse, 0, 7); ctx.stroke();
        if (main) { ctx.fillStyle = 'rgba(46,229,157,0.3)'; ctx.fill(); }
        if (main && tutorial) {
          const bx = e.x + 30, by = e.y - 70;
          ctx.font = '800 24px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          const tw = ctx.measureText('¡Empieza aquí!').width + 28;
          ctx.fillStyle = '#fff'; roundRect(bx, by - 22 + Math.sin(t * 4) * 4, tw, 44, 22); ctx.fill();
          ctx.fillStyle = '#1e2433'; ctx.fillText('¡Empieza aquí!', bx + 14, by + Math.sin(t * 4) * 4);
          // mano que dibuja
          const k = (t * 0.6) % 1, hx = e.x + k * 260, hy = e.y + Math.sin(k * Math.PI) * 90;
          ctx.globalAlpha = 1 - k; ctx.font = '40px system-ui'; ctx.fillText('👆', hx - 10, hy + 26); ctx.globalAlpha = 1;
        }
      }
    }
  }

  // ---------- Frame completo ----------
  function frame(o) {
    const { state, idx, t } = o;
    const th = THEMES[state.level.theme] || THEMES.day;
    buildBackground(state.level, idx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bgCache, 0, 0);
    worldT();
    if (o.shake) ctx.translate((Math.random() - 0.5) * o.shake, (Math.random() - 0.5) * o.shake);
    drawObstacles(state.level, th, t);
    drawPieces(state, th, t);
    drawStars(state.level, o.run ? o.run.stars : null, t);
    if (o.showEnds) drawFreeEnds(state, t, o.tutorial);
    if (o.preview) drawPreview(o.preview, o.kind);
    if (o.cart) drawCart(o.cart.x, o.cart.y, o.cart.angle, o.cart.flip, o.cart);
    if (o.particles) drawParticles(o.particles);
    if (o.eraser) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(o.eraser.x, o.eraser.y, o.eraser.r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  root.Render = { setup, layout, toWorld, frame, getView: () => view, THEMES, drawCart };
})(window);
