/* roulette.js — 歐式單零輪盤：Canvas 繪製的實木輪盤 (轉子 + 圓錐 + 金色轉軸 + 擋珠器)、物理感小球軌跡、
   傾斜 3D 賭桌下注 (直注 / 三打 / 直欄 / 紅黑 / 單雙 / 大小)。結果先由亂數決定，動畫只負責讓小球落進該格 */
(function () {
  'use strict';
  const C = window.Casino;
  const NUMS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const SL = Math.PI * 2 / 37, TAU = Math.PI * 2;
  const colorOf = n => n === 0 ? 'g' : (REDS.has(n) ? 'r' : 'b');

  /* 結算：回傳含本金的總返還 */
  function payout(bets, n) {
    let ret = 0;
    Object.entries(bets).forEach(([k, a]) => {
      const [t, v] = k.split(':');
      let m = 0;
      if (t === 'n') m = (+v === n) ? 36 : 0;
      else if (n === 0) m = 0;
      else if (t === 'doz') m = (Math.ceil(n / 12) === +v) ? 3 : 0;
      else if (t === 'col') m = ((n - 1) % 3 + 1 === +v) ? 3 : 0;
      else if (t === 'red') m = REDS.has(n) ? 2 : 0;
      else if (t === 'blk') m = !REDS.has(n) ? 2 : 0;
      else if (t === 'odd') m = n % 2 === 1 ? 2 : 0;
      else if (t === 'even') m = n % 2 === 0 ? 2 : 0;
      else if (t === 'low') m = n <= 18 ? 2 : 0;
      else if (t === 'high') m = n >= 19 ? 2 : 0;
      ret += a * m;
    });
    return ret;
  }

  function mount(view) {
    /* ----- 下注桌 HTML ----- */
    let cells = '<div class="rc n0 grn" data-k="n:0" style="grid-column:1;grid-row:1/4">0</div>';
    for (let n = 1; n <= 36; n++) {
      const col = Math.ceil(n / 3) + 1, row = n % 3 === 0 ? 1 : (n % 3 === 2 ? 2 : 3);
      cells += `<div class="rc ${REDS.has(n) ? 'red' : 'blk'}" data-k="n:${n}" style="grid-column:${col};grid-row:${row}">${n}</div>`;
    }
    [[3, 1], [2, 2], [1, 3]].forEach(([c, r]) => { cells += `<div class="rc out" data-k="col:${c}" style="grid-column:14;grid-row:${r}">2:1</div>`; });
    [[1, 2], [2, 6], [3, 10]].forEach(([d, c]) => { cells += `<div class="rc out" data-k="doz:${d}" style="grid-column:${c} / span 4;grid-row:4">${['1st', '2nd', '3rd'][d - 1]} 12</div>`; });
    const dia = c => `<span style="display:block;width:30%;max-width:34px;aspect-ratio:1;transform:rotate(45deg);background:${c};border:2px solid #fff;box-shadow:0 1px 3px #000"></span>`;
    [['low', '1–18', 2], ['even', 'EVEN', 4], ['red', dia('#b3101e'), 6], ['blk', dia('#111'), 8], ['odd', 'ODD', 10], ['high', '19–36', 12]]
      .forEach(([k, t, c]) => { cells += `<div class="rc out" data-k="${k}" style="grid-column:${c} / span 2;grid-row:5">${t}</div>`; });

    view.innerHTML = `
      <div class="view-title">EUROPEAN ROULETTE<small>歐式單零輪盤 · 點擊賭桌下注 · 可同時下多注</small></div>
      <div class="rl-top">
        <div class="rl-led"><label>LAST<br>NUMBERS</label><div class="rl-hist" id="rlHist"></div></div>
        <div class="rl-wheel" id="rlWheel"><div class="rl-disc">
          <i class="lay" style="transform:translateZ(-5px)"></i><i class="lay" style="transform:translateZ(-10px)"></i><i class="lay" style="transform:translateZ(-15px)"></i><i class="lay sh" style="transform:translateZ(-26px)"></i>
          <canvas id="rlCv"></canvas>
        </div></div>
      </div>
      <div class="tbl-scene" id="rlScene"><div class="tbl-persp"><div class="tbl flow" style="--tilt:26deg">
        <div class="tbl-rail"><div class="tbl-pad"><div class="tbl-felt"></div></div></div>
        <div class="tbl-in"><div class="rl-board" id="rlBoard">${cells}</div></div>
      </div></div><div class="tbl-banner"></div></div>
      <div class="rl-tools">
        <span class="rl-total">本局下注：<b id="rlTot">$0</b></span>
        <button class="btn dark sm" id="rlUndo">↶ 復原</button><button class="btn dark sm" id="rlClear">✕ 清除</button><button class="btn dark sm" id="rlRe">↻ 重複上局</button>
        <button class="btn" id="rlSpin">SPIN 旋轉</button>
      </div>
      <div class="res-line" id="rlRes"></div>`;
    const $ = s => view.querySelector(s), scene = $('#rlScene');
    const cv = $('#rlCv'), g = cv.getContext('2d'), SIZE = 600;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = cv.height = SIZE * dpr; g.scale(dpr, dpr);
    const cell = {}; C.$$('.rc', view).forEach(e => { cell[e.dataset.k] = e; });
    let busy = false, spinning = false, lastWin = null, phi = Math.random() * TAU, ballOn = false, ballA = 0, ballR = 0, airborne = 0;

    /* ----- 繪製輪盤 ----- */
    const cx = SIZE / 2, cy = SIZE / 2;
    const polar = (a, r) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
    function ring(r1, r2, a0, a1) { g.beginPath(); g.arc(cx, cy, r2, a0 - Math.PI / 2, a1 - Math.PI / 2); g.arc(cx, cy, r1, a1 - Math.PI / 2, a0 - Math.PI / 2, true); g.closePath(); }
    function draw() {
      g.clearRect(0, 0, SIZE, SIZE);
      /* 外框木質 */
      let gr = g.createRadialGradient(cx - 60, cy - 80, 40, cx, cy, 300);
      gr.addColorStop(0, '#a35a24'); gr.addColorStop(.6, '#5a2a0c'); gr.addColorStop(1, '#2a1004');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 298, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,220,160,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 296, 0, TAU); g.stroke();
      /* 金色環 */
      gr = g.createLinearGradient(0, 40, 0, 560); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(.5, '#b98512'); gr.addColorStop(1, '#fff0a0');
      g.strokeStyle = gr; g.lineWidth = 9; g.beginPath(); g.arc(cx, cy, 266, 0, TAU); g.stroke();
      /* 小球軌道 (亮面木) */
      gr = g.createRadialGradient(cx, cy, 210, cx, cy, 262);
      gr.addColorStop(0, '#2b1306'); gr.addColorStop(.45, '#7a3d14'); gr.addColorStop(1, '#c78347');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 261, 0, TAU); g.arc(cx, cy, 212, 0, TAU, true); g.fill();
      /* 擋珠器 (固定) */
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + Math.PI / 8, [x, y] = polar(a, 236);
        g.save(); g.translate(x, y); g.rotate(a + Math.PI / 4);
        const dg = g.createLinearGradient(-8, -8, 8, 8); dg.addColorStop(0, '#fff6c0'); dg.addColorStop(1, '#a8761a');
        g.fillStyle = dg; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 4; g.fillRect(-6, -6, 12, 12); g.restore();
      }
      /* 轉子 */
      for (let i = 0; i < 37; i++) {
        const a0 = phi + i * SL, a1 = a0 + SL, n = NUMS[i];
        ring(160, 214, a0, a1);
        g.fillStyle = n === 0 ? '#0c8a4a' : (REDS.has(n) ? '#c8102e' : '#15151a'); g.fill();
        g.strokeStyle = '#e9d9a8'; g.lineWidth = 1.4; g.stroke();
      }
      /* 轉子凹陷陰影 */
      gr = g.createRadialGradient(cx, cy, 160, cx, cy, 214); gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(.35, 'rgba(0,0,0,0)'); gr.addColorStop(.85, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.4)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 214, 0, TAU); g.arc(cx, cy, 160, 0, TAU, true); g.fill();
      /* 號碼 (朝向圓心) */
      g.font = '800 15px Montserrat, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      for (let i = 0; i < 37; i++) {
        const a = phi + (i + .5) * SL, [x, y] = polar(a, 197);
        g.save(); g.translate(x, y); g.rotate(a); g.fillText(String(NUMS[i]), 0, 0); g.restore();
      }
      /* 內側凹槽環 + 圓錐 */
      g.strokeStyle = '#d4af37'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 160, 0, TAU); g.stroke();
      gr = g.createRadialGradient(cx - 30, cy - 40, 10, cx, cy, 158);
      gr.addColorStop(0, '#d9a066'); gr.addColorStop(.5, '#8a4a1c'); gr.addColorStop(1, '#2d1305');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 157, 0, TAU); g.fill();
      for (let i = 0; i < 4; i++) {                                    // 圓錐木紋反光 (隨轉子轉動)
        const a = phi + i * Math.PI / 2; g.strokeStyle = 'rgba(255,230,180,.18)'; g.lineWidth = 6;
        g.beginPath(); g.moveTo(...polar(a + .12, 44)); g.lineTo(...polar(a + .5, 150)); g.stroke();
      }
      gr = g.createRadialGradient(cx, cy, 20, cx, cy, 120); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.35)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 157, 0, TAU); g.fill();
      /* 金色轉軸 + 四支旋臂 */
      for (let i = 0; i < 4; i++) {
        const a = phi + i * Math.PI / 2; g.save(); g.translate(cx, cy); g.rotate(a);
        const lg = g.createLinearGradient(-6, 0, 6, 0); lg.addColorStop(0, '#8f5f10'); lg.addColorStop(.5, '#fff3b0'); lg.addColorStop(1, '#8f5f10');
        g.fillStyle = lg; g.beginPath(); g.roundRect ? g.roundRect(-5, -118, 10, 100, 5) : g.rect(-5, -118, 10, 100); g.fill();
        gr = g.createRadialGradient(-3, -128, 1, 0, -126, 11); gr.addColorStop(0, '#fff'); gr.addColorStop(.4, '#e8b923'); gr.addColorStop(1, '#6b4a05');
        g.fillStyle = gr; g.beginPath(); g.arc(0, -124, 10, 0, TAU); g.fill(); g.restore();
      }
      gr = g.createRadialGradient(cx - 10, cy - 12, 2, cx, cy, 40); gr.addColorStop(0, '#fff8c8'); gr.addColorStop(.5, '#d4af37'); gr.addColorStop(1, '#6b4a05');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 40, 0, TAU); g.fill();
      g.strokeStyle = '#4a3203'; g.lineWidth = 2; g.stroke();
      gr = g.createRadialGradient(cx - 6, cy - 8, 1, cx, cy, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#b98512');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 15, 0, TAU); g.fill();
      /* 小球 */
      if (ballOn) {
        const [x, y] = polar(ballA, ballR), lift = airborne;
        g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(x + 3 + lift * .6, y + 4 + lift * .8, 7, 5, 0, 0, TAU); g.fill();
        const bg = g.createRadialGradient(x - 3, y - 3 - lift * .4, 1, x, y - lift * .4, 8); bg.addColorStop(0, '#fff'); bg.addColorStop(.35, '#e8ecf4'); bg.addColorStop(1, '#7c8396');
        g.fillStyle = bg; g.beginPath(); g.arc(x, y - lift * .4, 7.5, 0, TAU); g.fill();
      }
      /* 玻璃反光 */
      const gl = g.createLinearGradient(80, 60, 360, 380); gl.addColorStop(0, 'rgba(255,255,255,.16)'); gl.addColorStop(.35, 'rgba(255,255,255,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(cx, cy, 262, 0, TAU); g.fill();
    }

    /* ----- 下注 UI ----- */
    const book = C.betBook(b => {
      Object.keys(cell).forEach(k => {
        let cs = cell[k].querySelector('.cs');
        if (b.bets[k]) { if (!cs) { cs = document.createElement('div'); cs.className = 'cs'; cell[k].appendChild(cs); } cs.innerHTML = C.chipStack(b.bets[k]); }
        else if (cs) cs.remove();
      });
      $('#rlTot').textContent = C.fmt(b.total());
    });
    $('#rlBoard').addEventListener('click', e => { const c = e.target.closest('.rc'); if (c && !busy) book.add(c.dataset.k); });
    $('#rlBoard').addEventListener('contextmenu', e => { e.preventDefault(); if (!busy) book.undo(); });
    $('#rlUndo').onclick = () => book.undo(); $('#rlClear').onclick = () => book.clear(); $('#rlRe').onclick = () => book.rebet();

    function addHist(n) {
      const h = $('#rlHist'), i = document.createElement('i'); i.className = colorOf(n); i.textContent = n; h.prepend(i);
      while (h.children.length > 9) h.lastChild.remove();
    }

    /* ----- 旋轉 ----- */
    function spin() {
      if (busy) return;
      if (!book.total()) return C.notify('請先點擊賭桌下注 (籌碼面額由底部籌碼列選擇)。', 'warn');
      busy = true; spinning = true; book.locked = true; book.commit(); K_hide(); C.$$('.rc.hit', view).forEach(e => e.classList.remove('hit'));
      ['#rlSpin', '#rlUndo', '#rlClear', '#rlRe'].forEach(s => { $(s).disabled = true; });
      $('#rlRes').textContent = ''; C.notify('下注完畢，輪盤旋轉中…'); C.sfx('lever');
      const idx = C.rnd(37), win = NUMS[idx];                     // 結果先決定
      const T = 7600, W0 = 1.5, TAUR = 5200, R = TAU * (7 + Math.random() * 1.2), psiN = (idx + .5) * SL;
      const phi0 = phi, t0 = performance.now(); let lastP = -1, lastTick = 0;
      ballOn = true;
      (function frame(now) {
        const t = now - t0, s = Math.min(1, t / T);
        phi = phi0 + W0 * TAUR / 1000 * (1 - Math.exp(-t / TAUR));      // 轉子速度指數衰減
        const e = 1 - Math.pow(1 - s, 3);
        let psi = psiN - R * (1 - e), rad = 240, air = 0;
        if (s > .52) {
          const u = (s - .52) / .48, f = Math.pow(u, 1.7);
          rad = 240 - 50 * f;
          if (u > .55) {                                                   // 撞擊擋珠器後彈跳 + 跳格
            const w = (u - .55) / .45, d = Math.pow(1 - w, 2);
            const hop = Math.abs(Math.sin(w * Math.PI * 4.2)) * d;
            rad -= 0; air = hop * 26; psi += Math.sin(w * Math.PI * 5.4) * d * SL * 2.6;
          }
        }
        if (s >= 1) { psi = psiN; rad = 190; air = 0; }
        ballA = phi + psi; ballR = rad; airborne = air;
        const p = Math.floor((((psi % TAU) + TAU) % TAU) / SL);
        if (s > .62 && p !== lastP && now - lastTick > 55) { C.sfx('ball'); lastTick = now; }
        lastP = p;
        draw();
        if (t < T) return requestAnimationFrame(frame);
        settle(win);
      })(t0);
    }
    const K_hide = () => { const b = scene.querySelector('.tbl-banner'); if (b) b.classList.remove('show'); };
    function settle(win) {
      lastWin = win; spinning = false;
      const bets = book.bets, total = book.total(), ret = payout(bets, win), net = ret - total;
      addHist(win);
      const hitKeys = ['n:' + win];
      if (win !== 0) {
        hitKeys.push('doz:' + Math.ceil(win / 12), 'col:' + ((win - 1) % 3 + 1), REDS.has(win) ? 'red' : 'blk', win % 2 ? 'odd' : 'even', win <= 18 ? 'low' : 'high');
      }
      hitKeys.forEach(k => { if (cell[k]) cell[k].classList.add('hit'); });
      C.sfx('bell');
      const colName = { g: '綠', r: '紅', b: '黑' }[colorOf(win)];
      if (ret > 0) C.earn(ret);
      if (net > 0) { K_banner('WIN +' + C.fmt(net), win + ' ' + colName); C.celebrate(net, total); C.notify('🎉 開出 ' + win + '（' + colName + '）！淨賺 ' + C.fmt(net), 'win'); }
      else if (ret > 0) { K_banner('RETURN ' + C.fmt(ret), win + ' ' + colName); C.notify('開出 ' + win + '，返還 ' + C.fmt(ret) + (net < 0 ? '（本局損失 ' + C.fmt(-net) + '）' : '（打平）')); }
      else { K_banner(win + ' ' + colName, '本局未中', true); C.sfx('lose'); C.notify('開出 ' + win + '（' + colName + '），未中獎。'); }
      $('#rlRes').textContent = '總下注 ' + C.fmt(total) + ' → 返還 ' + C.fmt(ret);
      setTimeout(() => {
        book.locked = false; book.reset(); busy = false; ballOn = true;
        ['#rlSpin', '#rlUndo', '#rlClear', '#rlRe'].forEach(s => { $(s).disabled = false; });
      }, 1800);
    }
    function K_banner(t, sub, lose) {
      const b = scene.querySelector('.tbl-banner'); b.className = 'tbl-banner' + (lose ? ' lose' : ''); b.style.top = '50%';
      b.innerHTML = t + '<small>' + sub + '</small>'; void b.offsetWidth; b.classList.add('show');
      setTimeout(() => b.classList.remove('show'), 3000);
    }
    $('#rlSpin').onclick = spin;
    draw();
    /* 閒置時轉子緩慢轉動，小球隨轉子停在得獎格 */
    let idleT = performance.now();
    (function idle(now) {
      if (!spinning && view.offsetParent) { phi += (now - idleT) / 1000 * 0.18; if (ballOn && lastWin != null) { ballA = phi + (NUMS.indexOf(lastWin) + .5) * SL; ballR = 190; airborne = 0; } draw(); }
      idleT = now; requestAnimationFrame(idle);
    })(idleT);
    return { show() { draw(); }, primary: spin, tip: '先在賭桌上點擊下注 (右鍵可復原)，再按 SPIN 或空白鍵旋轉輪盤。' };
  }

  C.register({ id: 'roulette', name: '俄羅斯輪盤', sub: 'European Roulette', icon: '◎', mount });
})();
