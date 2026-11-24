/* sicbo.js — 骰寶 (Sic Bo)：3 顆 CSS 3D 立方體骰子 + 玻璃骰盅搖晃動畫 + 傾斜賭桌
   下注：大 / 小 / 單 / 雙 (1:1，圍骰通殺)、全圍 30:1、指定圍骰 180:1、總和 (4 與 17 為 60:1 …)、單一點數 (1:1 / 2:1 / 3:1) */
(function () {
  'use strict';
  const C = window.Casino;
  const SUM_PAY = { 4: 60, 5: 30, 6: 17, 7: 12, 8: 8, 9: 6, 10: 6, 11: 6, 12: 6, 13: 8, 14: 12, 15: 17, 16: 30, 17: 60 };
  const PIPS = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [1, 3], [3, 1], [3, 3]], 5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]], 6: [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]] };
  const FACE_ROT = { 1: [0, 0], 6: [0, 180], 2: [0, -90], 5: [0, 90], 3: [-90, 0], 4: [90, 0] };   // 把該點數轉到正面所需的 [rotateX, rotateY]

  const pipHTML = (v, cls) => PIPS[v].map(p => `<i class="pip${v === 1 ? ' one' : ''}${cls || ''}" style="grid-area:${p[0]}/${p[1]}"></i>`).join('');
  const mini = v => `<span class="mini">${PIPS[v].map(p => `<i class="${v === 1 || v === 4 ? 'o' : ''}" style="grid-area:${p[0]}/${p[1]}"></i>`).join('')}</span>`;
  const dieHTML = () => `<div class="die"><div class="cube">${[1, 2, 3, 4, 5, 6].map(v => `<div class="face f${v}">${pipHTML(v)}</div>`).join('')}</div></div>`;

  /* 結算：回傳含本金的總返還與中獎項目 */
  function settle(bets, d) {
    const sum = d[0] + d[1] + d[2], triple = d[0] === d[1] && d[1] === d[2];
    let ret = 0; const hit = [];
    Object.entries(bets).forEach(([k, a]) => {
      const [t, v] = k.split(':'); let m = 0;
      if (t === 'small') m = (!triple && sum <= 10) ? 2 : 0;
      else if (t === 'big') m = (!triple && sum >= 11) ? 2 : 0;
      else if (t === 'even') m = (!triple && sum % 2 === 0) ? 2 : 0;
      else if (t === 'odd') m = (!triple && sum % 2 === 1) ? 2 : 0;
      else if (t === 'any') m = triple ? 31 : 0;
      else if (t === 'tri') m = (triple && d[0] === +v) ? 181 : 0;
      else if (t === 'sum') m = (sum === +v) ? 1 + SUM_PAY[+v] : 0;
      else if (t === 'num') { const c = d.filter(x => x === +v).length; m = c ? 1 + c : 0; }
      if (m) { ret += a * m; hit.push(k); }
    });
    return { ret, hit, sum, triple };
  }

  function mount(view) {
    const cellHTML = (k, cls, html, st) => `<div class="sc ${cls || ''}" data-k="${k}"${st ? ` style="${st}"` : ''}>${html}</div>`;
    let rows = '<div class="sb-row">' +
      cellHTML('small', 'big', '小 SMALL<small>4–10 · 1:1</small>', 'flex:1.3') + cellHTML('even', 'big', '雙 EVEN<small>1:1</small>') +
      cellHTML('any', 'big rd', '全圍 ANY TRIPLE<small>30:1</small>', 'flex:1.5') + cellHTML('odd', 'big', '單 ODD<small>1:1</small>') +
      cellHTML('big', 'big', '大 BIG<small>11–17 · 1:1</small>', 'flex:1.3') + '</div>';
    rows += '<div class="sb-row">' + [1, 2, 3, 4, 5, 6].map(v => cellHTML('tri:' + v, 'rd', `<div class="dices">${mini(v)}${mini(v)}${mini(v)}</div><small>180:1</small>`)).join('') + '</div>';
    [[4, 5, 6, 7, 8, 9, 10], [11, 12, 13, 14, 15, 16, 17]].forEach(r => {
      rows += '<div class="sb-row">' + r.map(n => cellHTML('sum:' + n, '', `${n}<small>${SUM_PAY[n]}:1</small>`)).join('') + '</div>';
    });
    rows += '<div class="sb-row">' + [1, 2, 3, 4, 5, 6].map(v => cellHTML('num:' + v, '', `${mini(v)}<small>1:1 · 2:1 · 3:1</small>`)).join('') + '</div>';

    view.innerHTML = `
      <div class="view-title">SIC BO · 骰寶<small>三顆骰子 · 點擊賭桌下注 · 圍骰時大小單雙通殺</small></div>
      <div class="sb-stage" id="sbStage"><div class="sb-base"></div><div class="sb-floor"></div>
        <div class="sb-dice" id="sbDice">${dieHTML()}${dieHTML()}${dieHTML()}</div><div class="sb-glass" id="sbGlass"></div></div>
      <div class="sb-sum" id="sbSum">請下注後按 ROLL 搖骰</div>
      <div class="tbl-scene" id="sbScene"><div class="tbl-persp"><div class="tbl flow" style="--tilt:24deg">
        <div class="tbl-rail"><div class="tbl-pad"><div class="tbl-felt"></div></div></div>
        <div class="tbl-in"><div id="sbBoard">${rows}</div></div>
      </div></div><div class="tbl-banner"></div></div>
      <div class="rl-tools">
        <span class="rl-total">本局下注：<b id="sbTot">$0</b></span>
        <button class="btn dark sm" id="sbUndo">↶ 復原</button><button class="btn dark sm" id="sbClear">✕ 清除</button><button class="btn dark sm" id="sbRe">↻ 重複上局</button>
        <button class="btn" id="sbRoll">ROLL 搖骰</button>
      </div>
      <div class="res-line" id="sbRes"></div>`;
    const $ = s => view.querySelector(s), scene = $('#sbScene'), stage = $('#sbStage'), glass = $('#sbGlass');
    const dice = C.$$('.die', view), cubes = C.$$('.cube', view);
    const cell = {}; C.$$('.sc', view).forEach(e => { cell[e.dataset.k] = e; });
    let busy = false, vals = [1, 4, 6];

    const orient = (i, v, ax, ay, tx, ty) => {
      const r = FACE_ROT[v];
      cubes[i].style.transform = `rotateX(${ax}deg) rotateY(${ay}deg) rotateX(${r[0] + 360 * (tx || 0)}deg) rotateY(${r[1] + 360 * (ty || 0)}deg)`;
    };
    const place = (i, l, t) => { dice[i].style.left = l + '%'; dice[i].style.top = t + '%'; };
    const rest = () => { [[8, 36], [40, 12], [68, 40]].forEach((p, i) => { place(i, p[0] + C.rnd(5), p[1] + C.rnd(8)); orient(i, vals[i], -26, [-18, 6, 20][i], 0, 0); }); };
    cubes.forEach(c => { c.style.transition = 'none'; }); rest(); setTimeout(() => cubes.forEach(c => { c.style.transition = ''; }), 60);

    const book = C.betBook(b => {
      Object.keys(cell).forEach(k => {
        let cs = cell[k].querySelector('.cs');
        if (b.bets[k]) { if (!cs) { cs = document.createElement('div'); cs.className = 'cs'; cell[k].appendChild(cs); } cs.innerHTML = C.chipStack(b.bets[k]); }
        else if (cs) cs.remove();
      });
      $('#sbTot').textContent = C.fmt(b.total());
    });
    $('#sbBoard').addEventListener('click', e => { const c = e.target.closest('.sc'); if (c && !busy) book.add(c.dataset.k); });
    $('#sbBoard').addEventListener('contextmenu', e => { e.preventDefault(); if (!busy) book.undo(); });
    $('#sbUndo').onclick = () => book.undo(); $('#sbClear').onclick = () => book.clear(); $('#sbRe').onclick = () => book.rebet();
    const lock = on => ['#sbRoll', '#sbUndo', '#sbClear', '#sbRe'].forEach(s => { $(s).disabled = on; });

    async function roll() {
      if (busy) return;
      if (!book.total()) return C.notify('請先點擊賭桌下注 (籌碼面額由底部籌碼列選擇)。', 'warn');
      busy = true; book.locked = true; book.commit(); lock(true);
      scene.querySelector('.tbl-banner').classList.remove('show'); C.$$('.sc.hit', view).forEach(e => e.classList.remove('hit'));
      $('#sbRes').textContent = ''; $('#sbSum').textContent = '搖骰中…'; C.notify('搖骰中…');
      const d = [C.rnd(6) + 1, C.rnd(6) + 1, C.rnd(6) + 1];     // 結果先決定
      stage.classList.add('shake'); glass.classList.remove('lift');
      cubes.forEach(c => c.classList.add('fast'));
      for (let n = 0; n < 11; n++) {
        dice.forEach((_, i) => { place(i, 4 + C.rnd(62), 4 + C.rnd(58)); orient(i, C.rnd(6) + 1, -20 - C.rnd(20), C.rnd(60) - 30, C.rnd(4), C.rnd(4)); });
        if (n % 3 === 0) C.sfx('dice');
        await C.sleep(135);
      }
      stage.classList.remove('shake'); cubes.forEach(c => c.classList.remove('fast'));
      glass.classList.add('lift'); await C.sleep(180);
      vals = d;
      [[8, 36], [40, 12], [68, 40]].forEach((p, i) => { place(i, p[0] + C.rnd(5), p[1] + C.rnd(8)); orient(i, d[i], -26, [-18, 6, 20][i], 2 + C.rnd(2), 2 + C.rnd(2)); });
      C.sfx('dice'); await C.sleep(1450); glass.classList.remove('lift');

      const r = settle(book.bets, d), total = book.total(), net = r.ret - total;
      const label = r.triple ? '圍骰 TRIPLE' : (r.sum >= 11 ? '大 BIG' : '小 SMALL') + ' · ' + (r.sum % 2 ? '單' : '雙');
      $('#sbSum').textContent = `開出：${d[0]} + ${d[1]} + ${d[2]} = ${r.sum} 點 · ${label}`;
      r.hit.forEach(k => cell[k] && cell[k].classList.add('hit'));
      if (r.ret > 0) C.earn(r.ret);
      const b = scene.querySelector('.tbl-banner'); b.style.top = '50%';
      if (net > 0) { b.className = 'tbl-banner'; b.innerHTML = 'WIN +' + C.fmt(net) + '<small>' + r.sum + ' 點 · ' + label + '</small>'; C.celebrate(net, total); C.notify('🎉 開出 ' + r.sum + ' 點！淨賺 ' + C.fmt(net), 'win'); }
      else if (r.ret > 0) { b.className = 'tbl-banner'; b.innerHTML = 'RETURN ' + C.fmt(r.ret) + '<small>' + r.sum + ' 點</small>'; C.notify('開出 ' + r.sum + ' 點，返還 ' + C.fmt(r.ret) + '。'); }
      else { b.className = 'tbl-banner lose'; b.innerHTML = r.sum + ' 點<small>本局未中</small>'; C.sfx('lose'); C.notify('開出 ' + r.sum + ' 點，未中獎。'); }
      void b.offsetWidth; b.classList.add('show'); setTimeout(() => b.classList.remove('show'), 3200);
      $('#sbRes').textContent = '總下注 ' + C.fmt(total) + ' → 返還 ' + C.fmt(r.ret);
      await C.sleep(1500);
      book.locked = false; book.reset(); busy = false; lock(false);
    }
    $('#sbRoll').onclick = roll;
    return { show() {}, primary: roll, tip: '點擊賭桌下注 (右鍵復原)，按 ROLL 或空白鍵搖骰。圍骰時大小單雙全數通殺。' };
  }

  C.register({ id: 'sicbo', name: '骰寶', sub: 'Sic Bo', icon: '⚄', mount });
})();
