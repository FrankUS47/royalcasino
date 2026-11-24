/* cards.js — 撲克牌 3D 渲染 (標準牌面 pip 排列)、翻牌與發牌飛行動畫 */
(function () {
  'use strict';
  const C = window.Casino;
  const K = (window.Cards = {});

  K.SUIT = { S: '♠︎', H: '♥︎', D: '♦︎', C: '♣︎' };      // 附 U+FE0E 強制文字樣式 (避免變成 emoji)
  const FACE = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  K.label = r => FACE[r] || String(r);
  K.isRed = c => c.s === 'H' || c.s === 'D';
  K.name = c => K.label(c.r) + K.SUIT[c.s];

  /* 發牌靴：n 副牌洗勻，剩餘不足時自動重洗 */
  K.shoe = function (n) {
    n = n || 1;
    const s = { cards: [], draw() { if (this.cards.length < 12) this.fill(); return this.cards.pop(); }, fill() {
      const d = [];
      for (let k = 0; k < n; k++) for (const su of ['S', 'H', 'D', 'C']) for (let r = 2; r <= 14; r++) d.push({ r, s: su });
      this.cards = C.shuffle(d);
    } };
    s.fill();
    return s;
  };

  const t = 1 / 3;
  const PIPS = {
    2: [[.5, 0], [.5, 1]],
    3: [[.5, 0], [.5, .5], [.5, 1]],
    4: [[0, 0], [1, 0], [0, 1], [1, 1]],
    5: [[0, 0], [1, 0], [.5, .5], [0, 1], [1, 1]],
    6: [[0, 0], [1, 0], [0, .5], [1, .5], [0, 1], [1, 1]],
    7: [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [0, 1], [1, 1]],
    8: [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [.5, .75], [0, 1], [1, 1]],
    9: [[0, 0], [1, 0], [0, t], [1, t], [.5, .5], [0, 2 * t], [1, 2 * t], [0, 1], [1, 1]],
    10: [[0, 0], [1, 0], [.5, t / 2], [0, t], [1, t], [0, 2 * t], [1, 2 * t], [.5, 1 - t / 2], [0, 1], [1, 1]]
  };
  const COURT = { 11: '♞︎', 12: '♛︎', 13: '♚︎' };

  function faceHTML(c) {
    const su = K.SUIT[c.s], lb = K.label(c.r);
    const idx = '<div class="pc-idx tl"><b>' + lb + '</b><i>' + su + '</i></div><div class="pc-idx br"><b>' + lb + '</b><i>' + su + '</i></div>';
    let body;
    if (c.r === 14) body = '<div class="pc-ace">' + su + '</div>';
    else if (c.r >= 11) body = '<div class="pc-court"><em>' + su + '</em><span>' + COURT[c.r] + '</span><em class="inv">' + su + '</em></div>';
    else body = '<div class="pc-pips">' + PIPS[c.r].map(p => '<i class="pip' + (p[1] > 0.5 ? ' inv' : '') + '" style="left:' + p[0] * 100 + '%;top:' + p[1] * 100 + '%">' + su + '</i>').join('') + '</div>';
    return idx + body;
  }

  /* 建立一張牌 (card 可為 null → 只有牌背)。faceUp 預設 true */
  K.el = function (card, faceUp) {
    const d = document.createElement('div');
    d.className = 'pcard' + (card && K.isRed(card) ? ' red' : '') + (faceUp === false ? '' : ' up');
    d.innerHTML = '<div class="pc-in"><div class="pc-face">' + (card ? faceHTML(card) : '') + '</div><div class="pc-back"><span>♛</span></div></div>';
    d._card = card;
    return d;
  };
  K.setFace = function (el, card) {
    el._card = card; el.classList.toggle('red', K.isRed(card));
    el.querySelector('.pc-face').innerHTML = faceHTML(card);
  };
  K.flip = function (el, up) {
    if (up === undefined) up = !el.classList.contains('up');
    el.classList.toggle('up', up); C.sfx('flip');
  };

  /* offsetParent 鏈計算的平面座標 (不受 3D 傾斜影響，起訖點同在傾斜面內) */
  K.planePos = function (el, root) {
    let x = 0, y = 0, e = el;
    while (e && e !== root) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    return { x, y };
  };
  K.fly = function (el, from, root, o) {
    o = o || {};
    const a = K.planePos(from, root), b = K.planePos(el, root);
    el.animate([
      { transform: 'translate(' + (a.x - b.x) + 'px,' + (a.y - b.y) + 'px) rotate(' + (o.rot == null ? -140 : o.rot) + 'deg) scale(.5)', opacity: 0.15 },
      { transform: 'none', opacity: 1 }
    ], { duration: o.dur || 520, delay: o.delay || 0, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards' });
  };

  /* 發一張牌到 container。o: {up, from, root, delay, flipAfter, dur} */
  K.deal = function (container, card, o) {
    o = o || {};
    const el = K.el(card, o.flipAfter ? false : !!o.up);
    container.appendChild(el);
    if (o.from && o.root) K.fly(el, o.from, o.root, o);
    const d = o.delay || 0;
    setTimeout(() => C.sfx('card'), d);
    if (o.flipAfter) setTimeout(() => K.flip(el, true), d + 560);
    return el;
  };

  /* 依牌型高亮：best 為構成牌型的牌 (物件參照)，其餘變暗 */
  K.highlight = function (els, bestCards) {
    els.forEach(e => {
      const on = bestCards.includes(e._card);
      e.classList.toggle('win', on); e.classList.toggle('dim', !on);
    });
  };
  K.clearHighlight = function (root) { C.$$('.pcard', root).forEach(e => e.classList.remove('win', 'dim')); };

  /* ---------- 牌桌共用 ---------- */
  K.tableHTML = function (inner, cls) {
    return '<div class="tbl-scene"><div class="tbl-persp"><div class="tbl ' + (cls || 'cards') + '"><div class="tbl-rail"><div class="tbl-pad"><div class="tbl-felt">' + inner +
      '</div></div></div></div></div><div class="tbl-banner"></div></div>';
  };
  K.banner = function (scene, title, sub, lose) {
    const b = scene.querySelector('.tbl-banner'); if (!b) return;
    b.className = 'tbl-banner' + (lose ? ' lose' : '');
    b.innerHTML = title + (sub ? '<small>' + sub + '</small>' : '');
    void b.offsetWidth; b.classList.add('show');
  };
  K.hideBanner = function (scene) { const b = scene.querySelector('.tbl-banner'); if (b) b.classList.remove('show'); };
  K.setSpot = function (spot, amt) {
    spot.classList.toggle('on', amt > 0);
    let i = spot.querySelector('.spot-in'); if (!i) { i = document.createElement('div'); i.className = 'spot-in'; spot.appendChild(i); }
    i.innerHTML = C.chipStack(amt);
  };
  K.eq = (a, b) => a === b;
})();
