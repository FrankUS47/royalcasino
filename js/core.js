/* core.js — 共用核心：錢包、籌碼列、通知、縮放/傾斜、大獎特效、遊戲註冊
   所有模組透過全域 window.Casino (簡寫 C) 溝通。載入順序：core → audio → cards → poker-eval → 各遊戲 → main */
(function () {
  'use strict';
  const C = (window.Casino = { games: [], CHIPS: [5, 25, 100, 500, 1000], state: { wallet: 1000, chip: 25 }, _w: [], _c: [] });

  /* ---------- 小工具 ---------- */
  C.$ = (s, r) => (r || document).querySelector(s);
  C.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  C.el = function (html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  C.sleep = ms => new Promise(r => setTimeout(r, ms));
  C.mod = (a, n) => ((a % n) + n) % n;
  C.rnd = function (n) {                       // 0..n-1，優先使用密碼學亂數 (無取模偏差)
    try {
      const a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n; let x;
      do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim);
      return x % n;
    } catch (e) { return Math.floor(Math.random() * n); }
  };
  C.rand = C.rnd;
  C.pick = a => a[C.rnd(a.length)];
  C.shuffle = function (a) { for (let i = a.length - 1; i > 0; i--) { const j = C.rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  C.fmt = n => '$' + Math.round(n).toLocaleString('en-US');
  C.ease = { out3: t => 1 - Math.pow(1 - t, 3), out4: t => 1 - Math.pow(1 - t, 4), out2: t => 1 - (1 - t) * (1 - t), io: t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) };

  /* ---------- 錢包 ---------- */
  try { const v = parseInt(localStorage.getItem('royal_casino_wallet'), 10); if (v > 0) C.state.wallet = v; } catch (e) {}
  const save = () => { try { localStorage.setItem('royal_casino_wallet', C.state.wallet); } catch (e) {} };
  let shown = C.state.wallet, raf = 0;

  C.onWallet = fn => C._w.push(fn);
  C.onChip = fn => C._c.push(fn);

  C.updateWallet = function (dir) {
    const el = C.$('#wallet');
    if (el) {
      cancelAnimationFrame(raf);
      const from = shown, to = C.state.wallet, t0 = performance.now();
      if (dir) { el.classList.remove('up', 'down'); void el.offsetWidth; el.classList.add(dir); }
      (function step(t) {
        const p = Math.min(1, (t - t0) / 600);
        shown = Math.round(from + (to - from) * C.ease.out3(p));
        el.textContent = C.fmt(shown);
        if (p < 1) raf = requestAnimationFrame(step);
      })(t0);
    }
    C._w.forEach(f => { try { f(C.state.wallet); } catch (e) { console.error(e); } });
  };
  C.earn = function (n) { if (n <= 0) return; C.state.wallet += Math.round(n); save(); C.updateWallet('up'); };
  C.spend = function (n) {
    if (n > C.state.wallet) { C.notify('餘額不足！請降低下注額，或按右上角 ⟳ 補充籌碼。', 'warn'); C.sfx('deny'); return false; }
    if (n <= 0) return true;
    C.state.wallet -= Math.round(n); save(); C.updateWallet('down'); return true;
  };
  C.refill = function () {
    C.state.wallet = 1000; save(); C.updateWallet('up'); C.sfx('chips'); C.notify('籌碼已重新補充至 $1,000！');
  };

  /* ---------- 通知列 ---------- */
  C.notify = function (msg, kind) {
    const s = document.getElementById('status'); if (!s) return;
    s.textContent = msg; s.className = 'status' + (kind ? ' ' + kind : '');
    void s.offsetWidth; s.classList.add('pop');
  };

  /* ---------- 籌碼列 ---------- */
  C.buildChipRow = function () {
    const row = C.$('#chipRow'); row.innerHTML = '';
    C.CHIPS.forEach(v => {
      const b = document.createElement('button');
      b.className = 'chip3d c' + v; b.dataset.v = v; b.title = '$' + v;
      b.innerHTML = '<span>' + (v >= 1000 ? '1K' : '$' + v) + '</span>';
      b.onclick = () => C.setChip(v);
      row.appendChild(b);
    });
    C.setChip(C.state.chip, true);
  };
  C.setChip = function (v, silent) {
    C.state.chip = v;
    C.$$('#chipRow .chip3d').forEach(b => b.classList.toggle('active', +b.dataset.v === v));
    if (!silent) C.sfx('chip');
    C._c.forEach(f => { try { f(v); } catch (e) { console.error(e); } });
  };
  C.cycleChip = function () { C.setChip(C.CHIPS[C.mod(C.CHIPS.indexOf(C.state.chip) + 1, C.CHIPS.length)]); };

  /* 桌面籌碼堆 (HTML 字串) */
  C.chipStack = function (amount) {
    if (!amount) return '';
    let rem = amount, cols = '';
    for (const d of [1000, 500, 100, 25, 5, 1]) {
      const n = Math.floor(rem / d); rem -= n * d; if (!n) continue;
      const shown = Math.min(n, 8); let pcs = '';
      for (let i = 0; i < shown; i++) pcs += '<i class="pc c' + d + '" style="--i:' + i + '"></i>';
      cols += '<span class="col" style="--h:' + shown + '">' + pcs + '</span>';
    }
    return '<span class="stk">' + cols + '<b class="stk-amt">' + C.fmt(amount) + '</b></span>';
  };

  /* ---------- 數字跳動 ---------- */
  C.countUp = function (el, to, ms, fmt) {
    const f = fmt || (v => Math.round(v)), from = parseFloat(el.dataset.v) || 0, t0 = performance.now();
    cancelAnimationFrame(el._cu); ms = ms || 700;
    (function step(t) {
      const p = Math.min(1, (t - t0) / ms), v = from + (to - from) * C.ease.out3(p);
      el.textContent = f(v); el.dataset.v = v;
      if (p < 1) el._cu = requestAnimationFrame(step); else el.dataset.v = to;
    })(t0);
  };

  /* ---------- 版面縮放：每個遊戲以固定「設計尺寸」排版，再依舞台 (寬 × 高) 等比縮放 → 1920×1080 一屏看完，不需捲動 ---------- */
  C.fitView = function (view, W) {
    const scene = document.createElement('div'); scene.className = 'vscene';
    while (view.firstChild) scene.appendChild(view.firstChild);
    view.appendChild(scene); scene.style.width = W + 'px';
    return function () {
      const host = view.parentElement, mob = window.innerWidth <= 900;
      const aw = host.clientWidth, ah = host.clientHeight; if (!aw) return;
      scene.style.transform = 'none';
      const h = scene.offsetHeight;
      const s = Math.min(aw / W, mob ? 1.3 : ah / h, 1.9);
      const offY = mob ? 0 : Math.max(0, (ah - h * s) / 2);
      scene.style.transform = 'translate(-50%,' + offY + 'px) scale(' + s + ')';
      view.style.height = mob ? Math.ceil(h * s) + 6 + 'px' : '';
    };
  };

  /* ---------- 機箱視角：固定角度 (不再隨滑鼠晃動) ---------- */
  C.tilt = function (host, cab, o) {
    o = o || {};
    cab.style.transform = 'rotateX(' + (o.baseX == null ? 2 : o.baseX) + 'deg) rotateY(' + (o.baseY == null ? -10 : o.baseY) + 'deg)';
  };

  /* ---------- 大獎特效 ---------- */
  C.coinRain = function (n, parent) {
    parent = parent || document.body;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i'); c.className = 'rain-coin';
      c.style.left = Math.random() * 100 + '%';
      c.style.animationDelay = Math.random() * 0.9 + 's';
      c.style.animationDuration = 1.3 + Math.random() * 1.1 + 's';
      c.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      parent.appendChild(c); setTimeout(() => c.remove(), 3600);
    }
  };
  C.bigWin = function (title, amount) {
    const d = document.createElement('div'); d.className = 'bigwin';
    d.innerHTML = '<div class="bw-in"><small>' + title + '</small><b>' + C.fmt(amount) + '</b></div>';
    document.body.appendChild(d); C.coinRain(46, d); C.sfx('bigwin');
    setTimeout(() => d.classList.add('out'), 2600); setTimeout(() => d.remove(), 3300);
  };
  /* 依贏得倍數決定音效 / 大獎動畫 */
  C.celebrate = function (win, bet) {
    if (win >= bet * 100) C.bigWin('MEGA WIN', win);
    else if (win >= bet * 25) C.bigWin('BIG WIN', win);
    else if (win > 0) C.sfx('win');
  };


  /* ---------- 下注簿 (輪盤 / 骰寶共用)：下注即扣款，可復原 / 清除 / 重複上局 ---------- */
  C.betBook = function (onChange) {
    const B = { bets: {}, stack: [], last: null, locked: false };
    const fire = () => { try { onChange && onChange(B); } catch (e) { console.error(e); } };
    B.total = () => Object.values(B.bets).reduce((a, b) => a + b, 0);
    B.add = function (key) {
      if (B.locked) return false;
      const a = C.state.chip; if (!C.spend(a)) return false;
      B.bets[key] = (B.bets[key] || 0) + a; B.stack.push([key, a]); C.sfx('chip'); fire(); return true;
    };
    B.undo = function () {
      if (B.locked || !B.stack.length) return;
      const [k, a] = B.stack.pop(); B.bets[k] -= a; if (B.bets[k] <= 0) delete B.bets[k];
      C.earn(a); C.sfx('chip'); fire();
    };
    B.clear = function () {
      if (B.locked) return; const t = B.total(); B.bets = {}; B.stack = []; if (t) { C.earn(t); C.sfx('chips'); } fire();
    };
    B.rebet = function () {
      if (B.locked || !B.last) return;
      B.clear(); const t = Object.values(B.last).reduce((a, b) => a + b, 0);
      if (!C.spend(t)) return;
      B.bets = Object.assign({}, B.last); B.stack = Object.entries(B.bets); C.sfx('chips'); fire();
    };
    B.commit = function () { B.last = Object.assign({}, B.bets); };
    B.reset = function () { B.bets = {}; B.stack = []; fire(); };
    return B;
  };

  /* ---------- 遊戲註冊 ---------- */
  C.register = g => C.games.push(g);
})();
