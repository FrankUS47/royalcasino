/* holdem.js — 終極德州撲克 (Ultimate Texas Hold'em 規則)：對抗莊家，底注 + 盲注 + 加注
   流程：發 2 張手牌 → 翻牌前可加注 3x/4x → 翻牌後可加注 2x → 河牌後加注 1x 或棄牌 → 攤牌
   莊家需一對以上才「合格」；Ante 在莊家不合格時退回；Blind 依玩家牌型賠率，小牌型獲勝時退回 */
(function () {
  'use strict';
  const C = window.Casino, K = window.Cards, P = window.PokerEval;

  /* Blind 賠率 (利潤倍數)：皇家 500、同花順 50、四條 10、葫蘆 3、同花 1.5、順子 1，其餘獲勝則退回 */
  function blindMult(e) {
    if (e.nameIdx === 9) return 500;
    return { 8: 50, 7: 10, 6: 3, 5: 1.5, 4: 1 }[e.cat] || 0;
  }

  function mount(view) {
    view.innerHTML = `
      ${K.tableHTML(`
        <div class="chiprack l"><i style="--ca:#d62839"></i><i style="--ca:#16974a"></i><i style="--ca:#23262f"></i><i style="--ca:#7b2cbf"></i></div>
        <div class="shoe r"></div>
        <div class="zone" style="top:2%"><label>DEALER 莊家</label><div class="hand" id="hdD"></div><div class="hname" id="hdDN"></div></div>
        <div class="felt-t" style="top:28.5%;font-size:clamp(9px,1.6cqw,16px)">DEALER QUALIFIES WITH A PAIR<small>BLIND: STRAIGHT 1:1 · FLUSH 3:2 · FULL HOUSE 3:1 · QUADS 10:1 · STR.FLUSH 50:1 · ROYAL 500:1</small></div>
        <div class="zone" style="top:37%"><label>COMMUNITY 公共牌</label><div class="hand" id="hdB"></div></div>
        <div class="zone" style="top:59%"><div class="hname" id="hdPN"></div><div class="hand" id="hdP"></div></div>
        <div class="zone" style="top:81%"><div class="spots" id="hdSpots">
          <div class="spot" data-k="ante">ANTE<b>底注</b></div><div class="spot" data-k="blind">BLIND<b>盲注</b></div><div class="spot pp" data-k="play">PLAY<b>加注</b></div>
        </div></div>`)}
      <div class="res-line" id="hdRes"></div>
      <div class="tbl-ctl" id="hdCtl"></div>
      <div class="tbl-info">每次發牌需同時下 <b>Ante + Blind</b> (各 = 目前籌碼面額)；底部籌碼列可更改下注額</div>`;
    const $ = s => view.querySelector(s), scene = $('.tbl-scene'), felt = $('.tbl-felt'), ctl = $('#hdCtl');
    const spots = {}; C.$$('.spot', view).forEach(s => { spots[s.dataset.k] = s; });
    let st = 'bet', ante = 0, play = 0, shoe, pc, dc, board, busy = false;

    const setSpots = () => { K.setSpot(spots.ante, ante); K.setSpot(spots.blind, ante); K.setSpot(spots.play, play); };
    function buttons() {
      const w = C.state.wallet, chip = C.state.chip;
      let h = '';
      if (st === 'bet') h = `<button class="btn" data-a="deal">DEAL 發牌<small>Ante + Blind = ${C.fmt(chip * 2)}</small></button>`;
      else if (st === 'pre') h = `<button class="btn dark" data-a="check">CHECK 過牌</button><button class="btn green" data-a="bet" data-m="3" ${w < ante * 3 ? 'disabled' : ''}>BET 3×<small>${C.fmt(ante * 3)}</small></button><button class="btn red" data-a="bet" data-m="4" ${w < ante * 4 ? 'disabled' : ''}>BET 4×<small>${C.fmt(ante * 4)}</small></button>`;
      else if (st === 'flop') h = `<button class="btn dark" data-a="check">CHECK 過牌</button><button class="btn green" data-a="bet" data-m="2" ${w < ante * 2 ? 'disabled' : ''}>BET 2×<small>${C.fmt(ante * 2)}</small></button>`;
      else if (st === 'river') h = `<button class="btn dark" data-a="fold">FOLD 棄牌</button><button class="btn green" data-a="bet" data-m="1" ${w < ante ? 'disabled' : ''}>BET 1×<small>${C.fmt(ante)}</small></button>`;
      ctl.innerHTML = busy ? '' : h;
    }
    const tip = () => ({ bet: '按 DEAL 發牌。', pre: '翻牌前：可加注 3× / 4×，或過牌看翻牌。', flop: '翻牌後：可加注 2×，或過牌看轉牌與河牌。', river: '最後機會：加注 1×，或棄牌 (輸掉底注與盲注)。' }[st]);

    function draw(n) { const a = []; for (let i = 0; i < n; i++) a.push(shoe.draw()); return a; }
    function dealTo(el, cards, up, start, flipAfter) {
      return cards.map((c, i) => K.deal(el, c, { up: up && !flipAfter, flipAfter: flipAfter, from: $('.shoe'), root: felt, delay: start + i * 170 }));
    }
    async function deal() {
      if (busy || st !== 'bet') return;
      const a = C.state.chip; if (!C.spend(a * 2)) return;
      busy = true; ante = a; play = 0; K.hideBanner(scene); $('#hdRes').textContent = '';
      ['#hdD', '#hdB', '#hdP'].forEach(s => { $(s).innerHTML = ''; }); $('#hdDN').textContent = ''; $('#hdPN').textContent = '';
      shoe = K.shoe(1); pc = draw(2); dc = draw(2); board = draw(5); setSpots(); C.sfx('chips'); buttons();
      dealTo($('#hdP'), pc, false, 0, true); dealTo($('#hdD'), dc, false, 340, false);
      await C.sleep(1500);
      st = 'pre'; busy = false; buttons(); C.notify(tip());
      $('#hdPN').textContent = pc[0].r === pc[1].r ? '手牌：一對 ' + K.label(pc[0].r) : (pc[0].s === pc[1].s ? '手牌：同花' : '');
    }
    async function revealBoard(from, to) {
      const els = dealTo($('#hdB'), board.slice(from, to), false, 0, true); await C.sleep(560 + els.length * 170);
    }
    async function check() {
      if (busy) return; busy = true; buttons();
      if (st === 'pre') { await revealBoard(0, 3); st = 'flop'; } else if (st === 'flop') { await revealBoard(3, 5); st = 'river'; }
      busy = false; buttons(); C.notify(tip()); liveName();
    }
    function liveName() {
      const n = C.$$('#hdB .pcard', view).length; if (n < 3) return;
      $('#hdPN').textContent = '你的牌型：' + P.best(pc.concat(board.slice(0, n))).name;
    }
    async function raise(m) {
      if (busy) return; const cost = ante * m; if (!C.spend(cost)) return;
      busy = true; play = cost; setSpots(); C.sfx('chips'); buttons();
      const have = C.$$('#hdB .pcard', view).length;
      if (have < 5) await revealBoard(have, 5);
      await showdown(false);
    }
    async function showdown(folded) {
      busy = true; buttons();
      C.$$('#hdD .pcard', view).forEach(e => K.flip(e, true)); await C.sleep(700);
      const pe = P.best(pc.concat(board)), de = P.best(dc.concat(board));
      $('#hdPN').textContent = '你：' + pe.name; $('#hdDN').textContent = '莊家：' + de.name + (de.cat >= 1 ? '' : '（不合格）');
      const qual = de.cat >= 1, cmp = folded ? -1 : (pe.score > de.score ? 1 : pe.score < de.score ? -1 : 0);
      const bm = blindMult(pe); let ret = 0, lines = [];
      if (folded) lines.push('棄牌：輸掉底注與盲注');
      else if (cmp > 0) {
        ret += play * 2; ret += qual ? ante * 2 : ante; ret += bm > 0 ? ante * (1 + bm) : ante;
        lines.push('加注贏 1:1' + (qual ? '、底注贏 1:1' : '、底注退回(莊家不合格)') + (bm > 0 ? '、盲注 ' + bm + ':1' : '、盲注退回'));
      } else if (cmp === 0) { ret = play + ante * 2; lines.push('平手：全部退回'); }
      else lines.push('莊家牌型較大：輸掉底注、盲注與加注');
      const all = C.$$('#hdP .pcard, #hdB .pcard', view), dAll = C.$$('#hdD .pcard, #hdB .pcard', view);
      if (!folded) { if (cmp >= 0) K.highlight(all, pe.cards); else K.highlight(dAll, de.cards); }
      const total = ante * 2 + play, net = ret - total;
      if (ret > 0) C.earn(ret);
      if (net > 0) { K.banner(scene, 'YOU WIN +' + C.fmt(net), pe.name + ' 勝 ' + de.name); C.celebrate(net, ante); C.notify('🎉 獲勝！淨賺 ' + C.fmt(net), 'win'); }
      else if (net === 0) { K.banner(scene, 'PUSH 平手', pe.name + ' vs ' + de.name); C.notify('平手，賭注退回。'); }
      else { K.banner(scene, folded ? 'FOLD' : 'DEALER WINS', folded ? '輸掉 ' + C.fmt(-net) : de.name + ' 勝 ' + pe.name, true); C.sfx('lose'); C.notify('本局輸 ' + C.fmt(-net) + '。'); }
      $('#hdRes').textContent = lines.join(' ｜ ');
      st = 'bet'; busy = false; buttons();
    }
    function fold() { if (busy) return; showdown(true); }

    ctl.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      const a = b.dataset.a;
      if (a === 'deal') deal(); else if (a === 'check') check(); else if (a === 'fold') fold(); else raise(+b.dataset.m);
    });
    C.onChip(buttons); C.onWallet(buttons); buttons();
    return { show() { buttons(); }, primary() { if (st === 'bet') deal(); else if (st !== 'river' && !busy) check(); }, tip: '按 DEAL 發牌；每階段可過牌或加注，最後與莊家比大小。' };
  }

  C.register({ id: 'holdem', name: '德州撲克', sub: "Ultimate Hold'em", icon: '♠', w: 1260, mount });
})();
