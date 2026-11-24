/* audio.js — Web Audio 合成音效 (無外部檔案) */
(function () {
  'use strict';
  const S = (window.Casino.Sound = { enabled: true });
  let ctx = null, master = null, noiseBuf = null;
  const loops = {};

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
      const len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
    return ctx;
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, init, { passive: true }));

  function tone(f, dur, o) {
    o = o || {};
    const t = ctx.currentTime + (o.at || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const v = o.vol == null ? 0.15 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noise(dur, o) {
    o = o || {};
    const t = ctx.currentTime + (o.at || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = o.type || 'bandpass'; flt.Q.value = o.q || 1;
    flt.frequency.setValueAtTime(o.f || 2000, t);
    if (o.to) flt.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol == null ? 0.2 : o.vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  const bank = {
    chip() { noise(0.05, { f: 3200, q: 2, vol: 0.35 }); tone(1900, 0.05, { type: 'triangle', vol: 0.07 }); },
    chips() { for (let i = 0; i < 4; i++) { noise(0.04, { f: 2800 + i * 300, q: 2, vol: 0.28, at: i * 0.045 }); } },
    card() { noise(0.09, { f: 900, to: 3500, q: 0.8, vol: 0.28 }); },
    flip() { noise(0.07, { f: 2500, q: 0.7, vol: 0.2 }); tone(300, 0.05, { type: 'triangle', vol: 0.05 }); },
    dice() { for (let i = 0; i < 9; i++) { noise(0.035, { f: 1400 + Math.random() * 1600, q: 3, vol: 0.3, at: i * 0.07 + Math.random() * 0.03 }); tone(260 + Math.random() * 200, 0.04, { type: 'square', vol: 0.04, at: i * 0.07 }); } },
    tick() { tone(1200, 0.025, { type: 'square', vol: 0.05 }); },
    ball() { tone(880 + Math.random() * 300, 0.05, { type: 'triangle', vol: 0.12 }); noise(0.03, { f: 4000, vol: 0.15 }); },
    reelstop() { tone(140, 0.12, { type: 'sine', vol: 0.3, to: 60 }); noise(0.07, { f: 600, vol: 0.3 }); },
    lever() { tone(90, 0.25, { type: 'sawtooth', vol: 0.12, to: 45 }); noise(0.18, { f: 500, to: 150, vol: 0.2 }); },
    button() { tone(520, 0.05, { type: 'square', vol: 0.06 }); noise(0.03, { f: 3000, vol: 0.15 }); },
    deny() { tone(180, 0.18, { type: 'sawtooth', vol: 0.1, to: 120 }); },
    coin(at) { tone(1318, 0.09, { vol: 0.1, at: at || 0 }); tone(1760, 0.22, { vol: 0.1, at: (at || 0) + 0.07 }); },
    coins() { for (let i = 0; i < 10; i++) bank.coin(i * 0.07); },
    win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.13, at: i * 0.09 })); },
    lose() { tone(330, 0.25, { type: 'triangle', vol: 0.08, to: 220 }); },
    bigwin() {
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.14, at: i * 0.12 }));
      for (let i = 0; i < 18; i++) bank.coin(0.4 + i * 0.09);
    },
    bell() { tone(1568, 0.9, { vol: 0.12 }); tone(2349, 0.7, { vol: 0.07 }); }
  };

  S.play = function (name, arg) {
    if (!S.enabled) return;
    if (!init()) return;
    try { bank[name] && bank[name](arg); } catch (e) {}
  };

  S.loop = function (name, on) {
    if (!init()) return;
    if (on && S.enabled && !loops[name]) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 84; o2.type = 'square'; o2.frequency.value = 126;
      f.type = 'lowpass'; f.frequency.value = 520;
      lfo.frequency.value = 13; lg.gain.value = 0.02;
      g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.25);
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(master);
      o.start(); o2.start(); lfo.start();
      loops[name] = { o, o2, lfo, g };
    } else if (!on && loops[name]) {
      const l = loops[name]; delete loops[name];
      l.g.gain.cancelScheduledValues(ctx.currentTime);
      l.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      setTimeout(() => { try { l.o.stop(); l.o2.stop(); l.lfo.stop(); } catch (e) {} }, 260);
    }
  };

  S.toggle = function () {
    S.enabled = !S.enabled;
    if (!S.enabled) Object.keys(loops).forEach(k => S.loop(k, false));
    return S.enabled;
  };

  /* ---- 供其他模組使用的簡短介面 ---- */
  const C = window.Casino;
  bank.thunk = bank.reelstop;
  bank.click = function () { tone(760, 0.035, { type: 'square', vol: 0.04 }); };
  bank.shuffle = function () { for (let i = 0; i < 14; i++) noise(0.05, { f: 1200 + Math.random() * 2200, q: 0.9, vol: 0.16, at: i * 0.045 }); };
  bank.whoosh = function () { noise(0.5, { f: 300, to: 2400, q: 0.6, vol: 0.18 }); };
  C.sfx = (name, arg) => S.play(name, arg);
  C.sfxLoop = function () { S.loop('reel', true); return { stop: () => S.loop('reel', false) }; };
  C.toggleSound = function () {
    const on = S.toggle(), b = document.getElementById('btn-sound');
    if (b) b.textContent = on ? '🔊' : '🔇';
  };
})();
