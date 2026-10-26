/* =========================================================
   AGÁRRATE 3D · Sonido (sintetizado con Web Audio)
   ========================================================= */
let ctx = null, master = null, muted = false;
let rumbleG, rumbleF, windG, windF, boostO, boostG, noiseBuf;
let chainTimer = 0;

function makeNoise(c) {
  const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  return b;
}

export function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
  noiseBuf = makeNoise(ctx);
  const loop = (rate, type, freq, q) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(master); src.start();
    return [g, f];
  };
  [rumbleG, rumbleF] = loop(1, 'lowpass', 250);
  [windG, windF] = loop(1.6, 'bandpass', 800, 0.6);
  boostO = ctx.createOscillator(); boostO.type = 'sawtooth'; boostO.frequency.value = 90;
  const bf = ctx.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = 800;
  boostG = ctx.createGain(); boostG.gain.value = 0;
  boostO.connect(bf); bf.connect(boostG); boostG.connect(master); boostO.start();
}

const set = (p, v) => { if (ctx) p.setTargetAtTime(v, ctx.currentTime, 0.06); };

function tone(freq, dur, type, vol, when, slide) {
  if (!ctx) return;
  const t = ctx.currentTime + (when || 0);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function hit(dur, vol, freq, type) {
  if (!ctx) return;
  const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(freq || 2500, t);
  if (!type) f.frequency.exponentialRampToValueAtTime(120, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
}

export const Sound = {
  init,
  setMuted(m) { muted = m; if (master) set(master.gain, m ? 0 : 0.8); },
  // cada frame durante el viaje
  ride(speed, dt, onChain, boosting, flying) {
    if (!ctx) return;
    const sp = Math.min(1, speed / 35);
    set(rumbleG.gain, flying ? 0 : 0.04 + sp * 0.32); set(rumbleF.frequency, 160 + sp * 900);
    set(windG.gain, sp * sp * 0.35 + (flying ? 0.2 : 0)); set(windF.frequency, 500 + sp * 1400);
    set(boostG.gain, boosting ? 0.07 : 0); set(boostO.frequency, 80 + sp * 300);
    if (onChain) { chainTimer -= dt; if (chainTimer <= 0) { chainTimer = 0.11; tone(1400, 0.025, 'square', 0.04); } }
  },
  stop() { if (!ctx) return; set(rumbleG.gain, 0); set(windG.gain, 0); set(boostG.gain, 0); },
  click() { tone(660, 0.05, 'triangle', 0.12); },
  place(k) { const f = 300 + (k % 7) * 40; tone(f, 0.08, 'triangle', 0.2); tone(f * 1.5, 0.1, 'triangle', 0.14, 0.05); },
  undo() { tone(420, 0.14, 'sine', 0.15, 0, 180); },
  error() { tone(180, 0.16, 'square', 0.08); tone(140, 0.2, 'square', 0.08, 0.1); },
  inversion() { tone(300, 0.4, 'sine', 0.12, 0, 900); },
  airtime() { tone(880, 0.15, 'triangle', 0.12); tone(1320, 0.2, 'triangle', 0.1, 0.08); },
  brake() { hit(0.6, 0.25, 3000, 'highpass'); },
  crash() { hit(1.0, 0.9, 3000); tone(70, 0.5, 'sine', 0.6, 0, 35); },
  vomit() { tone(220, 0.5, 'sawtooth', 0.12, 0, 90); tone(160, 0.5, 'sawtooth', 0.1, 0.2, 70); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.35, 'triangle', 0.2, i * 0.1)); },
  star(i) { tone(1047 * Math.pow(1.26, i), 0.3, 'triangle', 0.22); },
  go() { tone(392, 0.1, 'square', 0.1); tone(587, 0.2, 'square', 0.1, 0.12); }
};
