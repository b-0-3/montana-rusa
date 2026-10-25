/* =========================================================
   AGÁRRATE · Sonido (todo sintetizado, sin archivos)
   ========================================================= */
(function (root) {
  'use strict';
  let ctx = null, master = null, muted = false;
  let rumbleGain, rumbleFilter, windGain, windFilter, boostOsc, boostGain;

  function noiseBuffer(c) {
    const len = c.sampleRate * 2;
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    return b;
  }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    const nb = noiseBuffer(ctx);

    // Traqueteo de las ruedas
    const n1 = ctx.createBufferSource(); n1.buffer = nb; n1.loop = true;
    rumbleFilter = ctx.createBiquadFilter(); rumbleFilter.type = 'lowpass'; rumbleFilter.frequency.value = 300;
    rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0;
    n1.connect(rumbleFilter); rumbleFilter.connect(rumbleGain); rumbleGain.connect(master); n1.start();

    // Viento cuando vuela
    const n2 = ctx.createBufferSource(); n2.buffer = nb; n2.loop = true; n2.playbackRate.value = 1.7;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 900; windFilter.Q.value = 0.7;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    n2.connect(windFilter); windFilter.connect(windGain); windGain.connect(master); n2.start();

    // Zumbido del turbo
    boostOsc = ctx.createOscillator(); boostOsc.type = 'sawtooth'; boostOsc.frequency.value = 110;
    const bf = ctx.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = 900;
    boostGain = ctx.createGain(); boostGain.gain.value = 0;
    boostOsc.connect(bf); bf.connect(boostGain); boostGain.connect(master); boostOsc.start();
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    if (!ctx) return;
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  function noiseHit(dur, vol, freq) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(freq || 2500, t); f.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol || 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur + 0.05);
  }

  const smoothSet = (param, v) => { if (ctx) param.setTargetAtTime(v, ctx.currentTime, 0.05); };

  const Sound = {
    init,
    setMuted(m) { muted = m; if (master) smoothSet(master.gain, m ? 0 : 0.8); },
    isMuted: () => muted,
    // Llamar cada frame mientras el vagón se mueve
    update(speed, inAir, boosting, running) {
      if (!ctx) return;
      const sp = Math.min(1, speed / 1100);
      smoothSet(rumbleGain.gain, running && !inAir ? 0.05 + sp * 0.35 : 0);
      smoothSet(rumbleFilter.frequency, 180 + sp * 900);
      smoothSet(windGain.gain, running && inAir ? 0.05 + sp * 0.25 : 0);
      smoothSet(boostGain.gain, running && boosting ? 0.07 : 0);
      smoothSet(boostOsc.frequency, 90 + sp * 260);
    },
    stopLoops() { this.update(0, false, false, false); },
    click() { tone(660, 0.06, 'triangle', 0.12); },
    place() { tone(330, 0.08, 'triangle', 0.18); tone(495, 0.1, 'triangle', 0.14, 0.05); },
    erase() { tone(400, 0.15, 'sine', 0.15, 0, 140); },
    error() { tone(180, 0.18, 'square', 0.08); tone(140, 0.2, 'square', 0.08, 0.1); },
    star(n) { const b = 880 * Math.pow(1.122, n || 0); tone(b, 0.12, 'triangle', 0.2); tone(b * 1.5, 0.25, 'triangle', 0.18, 0.08); },
    land(impact) { noiseHit(0.15, Math.min(0.6, 0.1 + impact / 600), 1200); tone(90, 0.12, 'sine', 0.3); },
    launch() { tone(300, 0.25, 'sine', 0.08, 0, 600); },
    crash() { noiseHit(0.9, 0.9, 3000); tone(70, 0.5, 'sine', 0.6, 0, 35); tone(140, 0.3, 'square', 0.12, 0.05, 60); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.35, 'triangle', 0.2, i * 0.1)); tone(1568, 0.8, 'sine', 0.12, 0.5); },
    starAward(i) { tone(1047 * Math.pow(1.26, i), 0.3, 'triangle', 0.22); },
    go() { tone(392, 0.1, 'square', 0.1); tone(587, 0.18, 'square', 0.1, 0.1); }
  };
  root.Sound = Sound;
})(window);
