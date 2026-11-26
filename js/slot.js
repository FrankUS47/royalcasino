/* slot.js — 3D 圓筒轉輪老虎機：3 轉輪 × 3 列、5 條連線，SVG 圖案、斜面按鍵台、側拉桿、投幣盤
   賠率 (每條線 ×單線注，單線注 = 總注 ÷ 5)：理論回報率 ≈ 94.3% (見 README) */
(function () {
  'use strict';
  const C = window.Casino;

  /* ---------- 圖案 (SVG，不依賴字型/emoji) ---------- */
  const DEFS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<linearGradient id="gSeven" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a8a"/><stop offset=".45" stop-color="#e3112d"/><stop offset="1" stop-color="#7a0016"/></linearGradient>' +
    '<linearGradient id="gGem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6ecff"/><stop offset=".5" stop-color="#3fa0ff"/><stop offset="1" stop-color="#0b4aa8"/></linearGradient>' +
    '<linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2a6"/><stop offset=".5" stop-color="#d4af37"/><stop offset="1" stop-color="#8f5f10"/></linearGradient>' +
    '<radialGradient id="gCherry" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffb0bb"/><stop offset=".4" stop-color="#e0102e"/><stop offset="1" stop-color="#6a0010"/></radialGradient>' +
    '<linearGradient id="gLemon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbb0"/><stop offset=".5" stop-color="#ffd91a"/><stop offset="1" stop-color="#d28f00"/></linearGradient>' +
    '</defs></svg>';
  const SVG = {
    seven: '<svg viewBox="0 0 100 100"><path d="M16 12H86L86 26 54 90H34L62 28H16Z" fill="url(#gSeven)" stroke="#4d000e" stroke-width="3.5" stroke-linejoin="round"/><path d="M22 18H78" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/></svg>',
    gem: '<svg viewBox="0 0 100 100"><path d="M26 16H74L93 40 50 88 7 40Z" fill="url(#gGem)" stroke="#093a7c" stroke-width="3" stroke-linejoin="round"/><path d="M7 40H93M26 16L38 40 50 16 62 40 74 16M38 40L50 88 62 40" stroke="#fff" stroke-opacity=".8" stroke-width="2" fill="none"/></svg>',
    bar: '<svg viewBox="0 0 100 100"><rect x="5" y="25" width="90" height="50" rx="8" fill="#101014" stroke="url(#gGold)" stroke-width="5"/><text x="50" y="63" text-anchor="middle" font-family="Montserrat,\'Arial Black\',Arial,sans-serif" font-weight="900" font-size="30" letter-spacing="3" fill="#fff">BAR</text></svg>',
    bell: '<svg viewBox="0 0 100 100"><path d="M50 8C58 8 61 14 58 19 74 25 80 41 80 60V66L91 79H9L20 66V60C20 41 26 25 42 19 39 14 42 8 50 8Z" fill="url(#gGold)" stroke="#6e4a00" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="87" r="8" fill="url(#gGold)" stroke="#6e4a00" stroke-width="3"/><path d="M33 44C35 35 41 30 46 28" stroke="#fff" stroke-opacity=".75" stroke-width="4" stroke-linecap="round" fill="none"/></svg>',
    cherry: '<svg viewBox="0 0 100 100"><path d="M32 66C34 42 48 24 68 12M70 68C68 46 68 28 68 12" stroke="#2f7a16" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M68 13C76 6 90 9 94 18 83 23 74 21 68 13Z" fill="#46a02a" stroke="#235c10" stroke-width="2"/><circle cx="29" cy="70" r="21" fill="url(#gCherry)" stroke="#5b000e" stroke-width="2.5"/><circle cx="71" cy="73" r="21" fill="url(#gCherry)" stroke="#5b000e" stroke-width="2.5"/><ellipse cx="22" cy="62" rx="6" ry="4" fill="#fff" fill-opacity=".7" transform="rotate(-30 22 62)"/><ellipse cx="64" cy="65" rx="6" ry="4" fill="#fff" fill-opacity=".7" transform="rotate(-30 64 65)"/></svg>',
    lemon: '<svg viewBox="0 0 100 100"><g transform="rotate(-18 50 54)"><path d="M3 54C3 54 12 50 14 52L86 52C88 50 97 54 97 54 97 54 88 58 86 56L14 56C12 58 3 54 3 54Z" fill="#d6a000"/><ellipse cx="50" cy="54" rx="38" ry="28" fill="url(#gLemon)" stroke="#a87100" stroke-width="3"/><ellipse cx="38" cy="43" rx="16" ry="6" fill="#fff" fill-opacity=".55"/></g><path d="M62 24C70 14 84 14 90 22 80 30 68 30 62 24Z" fill="#46a02a" stroke="#235c10" stroke-width="2"/></svg>'
  };
  const NAME = { seven: '7', gem: '鑽石', bar: 'BAR', bell: '金鐘', lemon: '檸檬', cherry: '櫻桃' };

  const BASE = ['cherry', 'lemon', 'bell', 'cherry', 'bar', 'lemon', 'cherry', 'gem', 'lemon', 'bell', 'cherry', 'seven', 'lemon', 'bar', 'bell', 'gem'];
  const rot = (a, k) => a.slice(k).concat(a.slice(0, k));
  const STRIPS = [BASE, rot(BASE.slice().reverse(), 5), rot(BASE, 9)];
  const PAY = { seven: 250, gem: 80, bar: 40, bell: 20, lemon: 10, cherry: 5 };
  const CHERRY1 = 1, CHERRY2 = 2;                       // 左輪櫻桃：單顆 ×1、左側連兩顆 ×2
  const LINES = [
    { rows: [1, 1, 1], color: '#ffd23f' }, { rows: [0, 0, 0], color: '#ff4d4d' }, { rows: [2, 2, 2], color: '#3fa7ff' },
    { rows: [0, 1, 2], color: '#35e08a' }, { rows: [2, 1, 0], color: '#c77dff' }
  ];
  const N = STRIPS[0].length, STEP = 360 / N, FH = 60, RAD = Math.round(FH / 2 / Math.tan(Math.PI / N));
  const SPIN_V = 1300;                                  // 度/秒

  /* ---------- 單一轉輪 ---------- */
  function Reel(root, strip) {
    this.root = root; this.strip = strip; this.theta = 0; this.mode = 'idle'; this.v = 0;
    this.drum = root.querySelector('.drum');
    this.drum.innerHTML = strip.map((s, k) => '<div class="f" style="transform:rotateX(' + k * STEP + 'deg) translateZ(' + RAD + 'px)">' + SVG[s] + '</div>').join('');
    this.set(-C.rnd(N) * STEP);
  }
  Reel.prototype.set = function (th) { this.theta = th; this.drum.style.transform = 'translateZ(' + -RAD + 'px) rotateX(' + th + 'deg)'; };
  Reel.prototype.spin = function () { this.mode = 'spin'; this.v = 0; this.root.classList.add('spin'); };
  Reel.prototype.stop = function (k) {
    return new Promise(res => {
      let target = -k * STEP; while (target > this.theta - 260) target -= 360;
      this.mode = 'stop'; this.from = this.theta; this.to = target; this.t = 0;
      this.dur = 3.4 * (this.from - target) / SPIN_V; this.res = res; this.lastTick = Math.floor(this.theta / STEP);
      this.root.classList.remove('spin');
    });
  };
  Reel.prototype.step = function (dt) {
    if (this.mode === 'spin') {
      this.v = Math.min(SPIN_V, this.v + (SPIN_V / .35) * dt);
      this.set(this.theta - this.v * dt);
    } else if (this.mode === 'stop') {
      this.t += dt; const p = Math.min(1, this.t / this.dur), s = 0.55;
      const e = 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);    // easeOutBack：末端機械式微回彈
      this.set(this.from + (this.to - this.from) * e);
      const tk = Math.floor(this.theta / STEP);
      if (tk !== this.lastTick && p < .9) { this.lastTick = tk; C.sfx('tick'); }
      if (p >= 1) { this.set(this.to); this.mode = 'idle'; C.sfx('thunk'); const r = this.res; this.res = null; if (r) r(); }
    }
  };

  /* 沿圓角矩形取燈泡位置 */
  function bulbPoints(w, h, r, gap) {
    const m = 8, pts = [], seg = [];
    seg.push({ t: 'l', x1: m, y1: h - m - 6, x2: m, y2: r });
    seg.push({ t: 'a', cx: r, cy: r, r: r - m, a1: Math.PI, a2: Math.PI * 1.5 });
    seg.push({ t: 'l', x1: r, y1: m, x2: w - r, y2: m });
    seg.push({ t: 'a', cx: w - r, cy: r, r: r - m, a1: Math.PI * 1.5, a2: Math.PI * 2 });
    seg.push({ t: 'l', x1: w - m, y1: r, x2: w - m, y2: h - m - 6 });
    seg.forEach(s => {
      if (s.t === 'l') {
        const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1), n = Math.max(1, Math.round(len / gap));
        for (let i = 0; i <= n; i++) pts.push([s.x1 + (s.x2 - s.x1) * i / n, s.y1 + (s.y2 - s.y1) * i / n]);
      } else {
        const len = s.r * (s.a2 - s.a1), n = Math.max(1, Math.round(len / gap));
        for (let i = 1; i < n; i++) { const a = s.a1 + (s.a2 - s.a1) * i / n; pts.push([s.cx + s.r * Math.cos(a), s.cy + s.r * Math.sin(a)]); }
      }
    });
    return pts;
  }

  function mount(view) {
    const lineBetOf = bet => bet / 5;
    view.innerHTML = DEFS + `
      <div class="slot-layout">
        <aside class="side-pnl" id="slotPayPnl">
          <h4>PAYTABLE 賠率表<small>每線賠率 × 單線注（總注 ÷ 5）</small></h4>
          ${['seven', 'gem', 'bar', 'bell', 'lemon', 'cherry'].map(k => '<div class="bp-row"><span class="bp-ic">' + SVG[k] + SVG[k] + SVG[k] + '</span><b>×' + PAY[k] + '</b></div>').join('')}
          <div class="bp-note">左輪櫻桃：1 顆 <b>×${CHERRY1}</b>　連 2 顆 <b>×${CHERRY2}</b></div>
        </aside>
        <div class="mach-scene">
          <div class="cab3d slot-cab" id="slotCab">
            <div class="cab-side L"></div><div class="cab-side R"></div><div class="cab-back"></div><div class="cab-shadow"></div>
            <div class="cab-front">
              <div class="beacon" id="slotBeacon"></div>
              <div class="topper"><div class="bulbs" id="slotBulbs"></div><div class="logo7">ROYAL <b>7</b>s</div><small>DELUXE 3D SLOTS</small></div>
              <div class="reel-bezel"><div class="reel-window" id="slotWin">
                ${[0, 1, 2].map(() => '<div class="reel"><div class="drum"></div><i class="motion"></i></div>').join('')}
                <canvas class="payline-cv" id="slotCv" width="760" height="372"></canvas>
                <div class="tabs l" id="tabsL"></div><div class="tabs r" id="tabsR"></div>
                <div class="shade"></div><div class="glass"></div>
              </div></div>
              <div class="mid-plate">BARS &amp; 7s WIN BIG</div>
              <div class="meters">
                <div class="meter"><label>CREDIT</label><div class="led green"><span class="ghost">888888</span><span class="val" id="mCredit">0</span></div></div>
                <div class="meter"><label>TOTAL BET</label><div class="led"><span class="ghost">8888</span><span class="val" id="mBet">0</span></div></div>
                <div class="meter"><label>WIN</label><div class="led red"><span class="ghost">888888</span><span class="val" id="mWin">0</span></div></div>
              </div>
              <div class="deck-wrap">
                <div class="deck-cheek l"></div><div class="deck-cheek r"></div>
                <div class="deck">
                  <button class="pbtn gry" id="sCash">CASH<br>OUT</button>
                  <button class="pbtn blu" id="sBet">BET<small>換面額</small></button>
                  <button class="pbtn grn" id="sMax">MAX<br>BET</button>
                  <button class="pbtn gold big glow" id="sSpin">SPIN</button>
                </div>
                <div class="deck-lip"></div>
              </div>
              <div class="belly"><div class="billslot"><em>BILL</em></div><div class="rplate">ROYAL</div><div class="cardslot"></div></div>
              <div class="tray" id="slotTray"><div class="lbl">COIN TRAY</div></div>
            </div>
            <div class="lever" id="slotLever" title="拉動拉桿"><div class="lever-plate"></div><div class="lever-arm" id="leverArm"><div class="lever-ball"></div></div></div>
          </div>
        </div>
        <aside class="side-pnl" id="slotHistPnl">
          <h4>RECENT 最近紀錄<small>共 <b id="hSpins">0</b> 轉 · 最高單次贏 <b id="hBest">$0</b></small></h4>
          <div class="hist-list" id="slotHist"><div class="hist-empty">尚無紀錄</div></div>
          <div class="slot-hint">用滑鼠 <b>按住紅色拉桿往下拉</b><br>拉到底放開即開始轉動<br>或按 <kbd>SPIN</kbd> / <kbd>SPACE</kbd></div>
        </aside>
      </div>`;

    const $ = s => view.querySelector(s);
    const cab = $('#slotCab'), tray = $('#slotTray'), cv = $('#slotCv'), cx = cv.getContext('2d');
    const reels = C.$$('.reel', view).map((r, i) => new Reel(r, STRIPS[i]));
    let busy = false;

    /* 燈泡跑馬燈 */
    $('#slotBulbs').innerHTML = bulbPoints(398, 106, 56, 17).map(p => '<i style="left:' + p[0].toFixed(1) + 'px;top:' + p[1].toFixed(1) + 'px"></i>').join('');
    /* 連線標籤：依各線在左 / 右側的起訖列分組 */
    [['#tabsL', 0], ['#tabsR', 2]].forEach(([id, col]) => {
      const groups = [[], [], []];
      LINES.forEach((l, i) => groups[l.rows[col]].push('<i style="--c:' + l.color + '">' + (i + 1) + '</i>'));
      $(id).innerHTML = groups.map(g => '<div class="tg">' + g.join('') + '</div>').join('');
    });

    const setLed = (id, v) => { $(id).textContent = Math.round(v); };
    const refresh = () => { setLed('#mCredit', C.state.wallet); setLed('#mBet', C.state.chip); };
    C.onWallet(refresh); C.onChip(refresh); refresh();
    function countWin(to) {
      const t0 = performance.now(), dur = Math.min(1800, 500 + to * 2);
      (function f(t) { const p = Math.min(1, (t - t0) / dur); setLed('#mWin', to * p); if (p < 1) requestAnimationFrame(f); })(t0);
    }

    /* 轉輪動畫主迴圈 (僅在可見時運作) */
    let last = performance.now();
    (function loop(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (view.offsetParent) reels.forEach(r => r.step(dt));
      requestAnimationFrame(loop);
    })(last);

    function clearWin() {
      cx.clearRect(0, 0, cv.width, cv.height); cv.classList.remove('pulse');
      C.$$('.tabs i', view).forEach(i => i.classList.remove('on'));
      cab.classList.remove('winning'); $('#slotBeacon').classList.remove('on'); setLed('#mWin', 0);
    }
    function drawWins(wins) {
      const W = cv.width, H = cv.height, cw = W / 3, ch = H / 3 * (180 / 186), oy = (H - ch * 3) / 2;
      cx.clearRect(0, 0, W, H); cx.lineCap = 'round'; cx.lineJoin = 'round';
      const seen = new Set();
      wins.forEach(w => w.cells.forEach(([r, c]) => {
        const k = r * 3 + c; if (seen.has(k)) return; seen.add(k);
        cx.save(); cx.shadowColor = '#fff3a0'; cx.shadowBlur = 26; cx.strokeStyle = 'rgba(255,240,150,.95)'; cx.lineWidth = 6;
        cx.strokeRect(c * cw + 10, oy + r * ch + 5, cw - 20, ch - 10); cx.restore();
      }));
      wins.forEach(w => {
        cx.save(); cx.shadowColor = w.line.color; cx.shadowBlur = 18; cx.strokeStyle = w.line.color; cx.lineWidth = 9; cx.beginPath();
        w.cells.forEach(([r, c], i) => { const x = c * cw + cw / 2, y = oy + r * ch + ch / 2; i ? cx.lineTo(x, y) : cx.moveTo(x, y); });
        cx.stroke(); cx.restore();
      });
      cv.classList.add('pulse');
      C.$$('.tabs i', view).forEach(i => { if (wins.some(w => LINES.indexOf(w.line) + 1 === +i.textContent)) i.classList.add('on'); });
    }
    function addCoins(n) {
      tray.classList.add('full');
      for (let i = 0; i < n; i++) {
        const c = document.createElement('i'); c.className = 'tcoin';
        c.style.setProperty('--x', 3 + Math.random() * 84); c.style.setProperty('--y', -6 + Math.random() * 20); c.style.animationDelay = i * 45 + 'ms';
        tray.appendChild(c); setTimeout(() => C.sfx('coin'), i * 70);
      }
      while (tray.children.length > 44) tray.removeChild(tray.children[1]);
    }
    /* ---- 拉桿：可用滑鼠 / 手指按住往下拖曳，拉過 62° 放開即開始轉動；單擊則自動做一次拉桿動畫 ---- */
    const lever = $('#slotLever'), arm = $('#leverArm'), MAXA = 86, TRIG = 62;
    let ang = 0, drag = null;
    const setArm = a => { ang = a; arm.style.transform = 'rotateX(' + (-a) + 'deg)'; };
    const stopArmAnim = () => arm.getAnimations().forEach(x => x.cancel());
    function springBack(ms) {
      const a = ang; setArm(0);
      if (a > 0.5) arm.animate([{ transform: 'rotateX(' + (-a) + 'deg)' }, { transform: 'rotateX(7deg)', offset: .72 }, { transform: 'rotateX(0deg)' }], { duration: ms || 520, easing: 'cubic-bezier(.3,.8,.4,1)' });
    }
    function pullLever() {                      // 自動拉桿 (單擊 / 按鈕 / SPACE)
      C.sfx('lever'); stopArmAnim();
      arm.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-' + MAXA + 'deg)', offset: .34 }, { transform: 'rotateX(-' + MAXA + 'deg)', offset: .44 }, { transform: 'rotateX(7deg)', offset: .82 }, { transform: 'rotateX(0deg)' }], { duration: 900, easing: 'ease-in-out' });
    }
    lever.addEventListener('pointerdown', e => {
      if (busy || e.button > 0) return;
      stopArmAnim(); setArm(0);
      drag = { y: e.clientY, moved: false, step: 0, px: lever.querySelector('.lever-plate').getBoundingClientRect().height / 52 };
      lever.setPointerCapture(e.pointerId); lever.classList.add('grab'); e.preventDefault();
    });
    lever.addEventListener('pointermove', e => {
      if (!drag) return;
      const dy = e.clientY - drag.y;
      if (Math.abs(dy) > 4) drag.moved = true;
      const a = Math.max(0, Math.min(MAXA, dy / (185 * drag.px) * 90));
      setArm(a);
      const st = Math.floor(a / 14); if (st !== drag.step) { drag.step = st; C.sfx('click'); }
    });
    const endDrag = () => {
      if (!drag) return; const d = drag; drag = null; lever.classList.remove('grab');
      if (!d.moved) { spin(); return; }               // 單擊
      if (ang >= TRIG && !busy) { spin(true); } else { C.sfx('click'); }
      springBack(ang >= TRIG ? 700 : 380);
    };
    lever.addEventListener('pointerup', endDrag); lever.addEventListener('pointercancel', endDrag);
    lever.addEventListener('lostpointercapture', () => { if (drag) endDrag(); });
    const press = b => { b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 140); };
    const ctrl = on => ['#sSpin', '#sBet', '#sMax', '#sCash'].forEach(s => { $(s).disabled = !on; });

    const hist = []; let nSpin = 0, best = 0;
    function addHist(bet, win) {
      nSpin++; best = Math.max(best, win); hist.unshift({ n: nSpin, bet, win });
      if (hist.length > 9) hist.pop();
      $('#hSpins').textContent = nSpin; $('#hBest').textContent = C.fmt(best);
      $('#slotHist').innerHTML = hist.map(h => '<div class="hist-row ' + (h.win ? 'w' : '') + '"><i>#' + h.n + '</i><span>' + C.fmt(h.bet) + '</span><b>' + (h.win ? '+' + C.fmt(h.win) : '—') + '</b></div>').join('');
    }
    async function spin(pulled) {
      if (busy) return;
      const bet = C.state.chip;
      if (!C.spend(bet)) return;
      busy = true; clearWin(); if (pulled === true) C.sfx('lever'); else { pullLever(); press($('#sSpin')); } ctrl(false);
      tray.classList.remove('full'); C.$$('.tcoin', tray).forEach(c => c.remove());
      C.notify('轉輪旋轉中…');
      const loop = C.sfxLoop();
      const stops = [C.rnd(N), C.rnd(N), C.rnd(N)];               // 結果先由亂數決定，動畫只負責呈現
      reels.forEach(r => r.spin());
      const done = [];
      for (let i = 0; i < 3; i++) { await C.sleep(i === 0 ? 1000 : 520); done.push(reels[i].stop(stops[i])); }
      await Promise.all(done); loop.stop();

      /* 盤面：第 r 列、第 c 輪 = strip[(停止格 + 1 - r)]  (中列為停止格，上列為下一格) */
      const grid = [0, 1, 2].map(r => [0, 1, 2].map(c => STRIPS[c][(stops[c] + 1 - r + N) % N]));
      const lb = lineBetOf(bet), wins = []; let win = 0;
      LINES.forEach(line => {
        const cells = line.rows.map((r, c) => [r, c]), s = cells.map(([r, c]) => grid[r][c]);
        let m = 0, hit = cells;
        if (s[0] === s[1] && s[1] === s[2]) m = PAY[s[0]];
        else if (s[0] === 'cherry' && s[1] === 'cherry') { m = CHERRY2; hit = cells.slice(0, 2); }
        else if (s[0] === 'cherry') { m = CHERRY1; hit = cells.slice(0, 1); }
        if (m) { wins.push({ line, cells: hit, sym: s[0], m }); win += m * lb; }
      });
      if (win > 0) {
        C.earn(win); countWin(win); drawWins(wins);
        addCoins(Math.min(30, 4 + wins.length * 4 + Math.floor(win / bet) * 2));
        cab.classList.add('winning'); $('#slotBeacon').classList.add('on'); C.sfx('bell');
        C.celebrate(win, bet);
        C.notify('🎉 ' + wins.length + ' 條連線中獎！贏得 ' + C.fmt(win), 'win');
        setTimeout(() => { cab.classList.remove('winning'); $('#slotBeacon').classList.remove('on'); }, 3400);
      } else C.notify('未中獎，再拉一次試試手氣！');
      addHist(bet, win);
      ctrl(true); busy = false;
    }

    $('#sSpin').onclick = () => spin();
    $('#sBet').onclick = () => { if (!busy) { press($('#sBet')); C.cycleChip(); } };
    $('#sMax').onclick = () => {
      if (busy) return; press($('#sMax'));
      const m = [500, 100, 25, 5].find(v => v <= C.state.wallet);
      if (!m) return C.notify('餘額不足！', 'warn');
      C.setChip(m); spin();
    };
    $('#sCash').onclick = () => { if (busy) return; press($('#sCash')); C.sfx('coins'); C.notify('🧾 現金票券列印中… 目前餘額 ' + C.fmt(C.state.wallet) + '（模擬機台，無真實金錢）'); };
    C.tilt(view, cab, { baseX: 2, baseY: -11 });
    return { primary: () => spin(), tip: '按住右側紅色拉桿往下拉（或按 SPIN / SPACE）開始；底部籌碼列決定每次總投注（5 條線平分）。' };
  }

  C.register({ id: 'slot', name: '吃角子老虎', sub: 'Slot Machine', icon: '🎰', w: 1560, mount });
})();
