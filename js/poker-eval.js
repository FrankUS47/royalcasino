/* poker-eval.js — 牌型判定：5/7 張 (德州)、3 張牌、螢幕撲克 (含百搭二) */
(function () {
  'use strict';
  const P = (window.PokerEval = {});
  const NAMES = ['高牌', '一對', '兩對', '三條', '順子', '同花', '葫蘆', '四條', '同花順', '皇家同花順'];
  P.NAMES = NAMES;

  const enc = (cat, tb) => { let s = cat; for (let i = 0; i < 5; i++) s = s * 15 + (tb[i] || 0); return s; };

  function groupsOf(r) {
    const cnt = {};
    r.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
    return Object.entries(cnt).map(([k, v]) => [+k, v]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  }

  P.eval5 = function (h) {
    const r = h.map(c => c.r).sort((a, b) => b - a);
    const flush = h.every(c => c.s === h[0].s);
    let sh = 0;
    if (new Set(r).size === 5) {
      if (r[0] - r[4] === 4) sh = r[0];
      else if (r[0] === 14 && r[1] === 5 && r[4] === 2) sh = 5;
    }
    const g = groupsOf(r);
    let cat, tb;
    if (sh && flush) { cat = 8; tb = [sh]; }
    else if (g[0][1] === 4) { cat = 7; tb = [g[0][0], g[1][0]]; }
    else if (g[0][1] === 3 && g[1][1] === 2) { cat = 6; tb = [g[0][0], g[1][0]]; }
    else if (flush) { cat = 5; tb = r; }
    else if (sh) { cat = 4; tb = [sh]; }
    else if (g[0][1] === 3) { cat = 3; tb = g.map(x => x[0]); }
    else if (g[0][1] === 2 && g[1][1] === 2) { cat = 2; tb = g.map(x => x[0]); }
    else if (g[0][1] === 2) { cat = 1; tb = g.map(x => x[0]); }
    else { cat = 0; tb = r; }
    const nm = (cat === 8 && sh === 14) ? 9 : cat;
    return { cat, tb, score: enc(cat, tb), name: NAMES[nm], nameIdx: nm };
  };

  /* 5~7 張取最佳 5 張 */
  P.best = function (cards) {
    if (cards.length === 5) { const e = P.eval5(cards); e.cards = cards; return e; }
    let best = null;
    const n = cards.length;
    const pick = (start, acc) => {
      if (acc.length === 5) {
        const e = P.eval5(acc);
        if (!best || e.score > best.score) { best = e; best.cards = acc.slice(); }
        return;
      }
      for (let i = start; i < n; i++) { acc.push(cards[i]); pick(i + 1, acc); acc.pop(); }
    };
    pick(0, []);
    return best;
  };

  /* ---------- 三張牌撲克 ---------- */
  const N3 = ['高牌', '一對', '同花', '順子', '三條', '同花順'];
  P.eval3 = function (h) {
    const r = h.map(c => c.r).sort((a, b) => b - a);
    const flush = h.every(c => c.s === h[0].s);
    let sh = 0;
    if (new Set(r).size === 3) {
      if (r[0] - r[2] === 2) sh = r[0];
      else if (r[0] === 14 && r[1] === 3 && r[2] === 2) sh = 3;
    }
    const g = groupsOf(r);
    let cat, tb;
    if (sh && flush) { cat = 5; tb = [sh]; }
    else if (g[0][1] === 3) { cat = 4; tb = [g[0][0]]; }
    else if (sh) { cat = 3; tb = [sh]; }
    else if (flush) { cat = 2; tb = r; }
    else if (g[0][1] === 2) { cat = 1; tb = g.map(x => x[0]); }
    else { cat = 0; tb = r; }
    return { cat, tb, score: enc(cat, tb), name: N3[cat] };
  };

  /* ---------- 螢幕撲克 ---------- */
  const ROWS = {
    jacks: [
      ['royal', '皇家同花順', 250], ['sf', '同花順', 50], ['quads', '四條', 25], ['fh', '葫蘆', 9], ['flush', '同花', 6],
      ['straight', '順子', 4], ['trips', '三條', 3], ['twopair', '兩對', 2], ['jacks', 'J 以上一對', 1]
    ],
    bonus: [
      ['royal', '皇家同花順', 250], ['sf', '同花順', 50], ['quadA', '四條 A', 80], ['quad24', '四條 2-4', 40], ['quad5K', '四條 5-K', 25],
      ['fh', '葫蘆', 8], ['flush', '同花', 5], ['straight', '順子', 4], ['trips', '三條', 3], ['twopair', '兩對', 2], ['jacks', 'J 以上一對', 1]
    ],
    deuces: [
      ['natroyal', '天然皇家同花順', 800], ['fourdeuces', '四張 2', 200], ['wildroyal', '百搭皇家同花順', 25], ['five', '五條', 15],
      ['sf', '同花順', 9], ['quads', '四條', 5], ['fh', '葫蘆', 3], ['flush', '同花', 2], ['straight', '順子', 2], ['trips', '三條', 1]
    ]
  };
  P.VP = {};
  Object.keys(ROWS).forEach(k => { P.VP[k] = ROWS[k].map(r => ({ key: r[0], name: r[1], mult: r[2] })); });

  function evalDeuces(hand) {
    const wild = hand.filter(c => c.r === 2).length;
    const nw = hand.filter(c => c.r !== 2);
    if (wild === 4) return 'fourdeuces';
    const cnt = {};
    nw.forEach(c => cnt[c.r] = (cnt[c.r] || 0) + 1);
    const counts = Object.values(cnt).sort((a, b) => b - a);
    const m = counts[0] || 0;
    const suited = nw.every(c => c.s === nw[0].s);
    const noDup = Object.keys(cnt).length === nw.length;
    const fit = s => nw.every(c => (c.r >= s && c.r <= s + 4) || (c.r === 14 && s === 1));
    const anyFit = () => { for (let s = 1; s <= 10; s++) if (fit(s)) return true; return false; };
    if (wild === 0 && suited && noDup && fit(10)) return 'natroyal';
    if (wild > 0 && suited && noDup && fit(10)) return 'wildroyal';
    if (wild + m >= 5) return 'five';
    if (suited && noDup && anyFit()) return 'sf';
    if (wild + m >= 4) return 'quads';
    if (Math.max(0, 3 - (counts[0] || 0)) + Math.max(0, 2 - (counts[1] || 0)) <= wild && (counts[0] || 0) <= 3) return 'fh';
    if (suited) return 'flush';
    if (noDup && anyFit()) return 'straight';
    if (wild + m >= 3) return 'trips';
    return null;
  }

  P.videoPoker = function (hand, variant) {
    const table = P.VP[variant];
    let key = null;
    if (variant === 'deuces') key = evalDeuces(hand);
    else {
      const e = P.eval5(hand);
      if (e.nameIdx === 9) key = 'royal';
      else if (e.cat === 8) key = 'sf';
      else if (e.cat === 7) {
        if (variant === 'bonus') { const q = e.tb[0]; key = q === 14 ? 'quadA' : (q <= 4 ? 'quad24' : 'quad5K'); }
        else key = 'quads';
      }
      else if (e.cat === 6) key = 'fh';
      else if (e.cat === 5) key = 'flush';
      else if (e.cat === 4) key = 'straight';
      else if (e.cat === 3) key = 'trips';
      else if (e.cat === 2) key = 'twopair';
      else if (e.cat === 1 && e.tb[0] >= 11) key = 'jacks';
    }
    const row = key && table.find(r => r.key === key);
    return row ? { key, name: row.name, mult: row.mult } : { key: null, name: '未成牌', mult: 0 };
  };
})();
