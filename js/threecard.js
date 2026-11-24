/* threecard.js — 三張牌撲克 (Three Card Poker) 標準規則
   Ante 底注 + 可選 Pair Plus 對子加注；看牌後選擇 Play (等額加注) 或 Fold
   莊家需 Q 高牌以上才合格；不合格：Ante 1:1、Play 退回
   Ante Bonus：順子 1:1、三條 4:1、同花順 5:1；Pair Plus：一對 1:1、同花 4:1、順子 6:1、三條 30:1、同花順 40:1 */
(function () {
  'use strict';
  const C = window.Casino, K = window.Cards, P = window.PokerEval;
  const ANTE_BONUS = { 3: 1, 4: 4, 5: 5 };                 // eval3 cat → 利潤倍數 (順子 / 三條 / 同花順)
  const PAIR_PLUS = { 1: 1, 2: 4, 3: 6, 4: 30, 5: 40 };   // 一對 / 同花 / 順子 / 三條 / 同花順

  function mount(view) {
    view.innerHTML = `
      <div class="view-title">THREE CARD POKER<small>三張牌撲克 · 底注 + Pair Plus · 莊家需 Q 高牌以上</small></div>
      ${K.tableHTML(`
        <div class="chiprack l"><i style="--ca:#d62839"></i><i style="--ca:#16974a"></i><i style="--ca:#23262f"></i><i style="--ca:#7b2cbf"></i></div>
        <div class="shoe r"></div>
        <div class="zone" style="top:4%"><label>DEALER 莊家</label><div class="hand" id="tcD"></div><div class="hname" id="tcDN"></div></div>
        <div class="felt-t" style="top:40%;font-size:clamp(9px,1.6cqw,16px)">THREE CARD POKER<small>PAIR PLUS PAYS 1:1 · 4:1 · 6:1 · 30:1 · 40:1 &nbsp;|&nbsp; ANTE BONUS 1:1 · 4:1 · 5:1</small></div>
        <div class="zone" style="top:52%"><div class="hname" id="tcPN"></div><div class="hand" id="tcP"></div></div>
        <div class="zone" style="top:79%"><div class="spots">
          <div class="spot pp" data-k="pp">PAIR PLUS<b>對子加注</b></div><div class="spot" data-k="ante">ANTE<b>底注</b></div><div class="spot pp" data-k="play">PLAY<b>加注</b></div>
        </div></div>`)}
      <div class="res-line" id="tcRes"></div>
      <div class="tbl-ctl"><label class="pp-tog"><input type="checkbox" id="tcPP"> 同時下注 Pair Plus (= 底注)</label><span id="tcCtl" class="tbl-ctl" style="margin:0"></span></div>
      <div class="tbl-info">Pair Plus 不論莊家牌面，只要你的牌型 <b>一對以上</b> 即付彩；棄牌時 Pair Plus 仍會結算</div>`;
    const $ = s => view.querySelector(s), scene = $('.tbl-scene'), felt = $('.tbl-felt'), ctl = $('#tcCtl');
    const spots = {}; C.$$('.spot', view).forEach(s => { spots[s.dataset.k] = s; });
    let st = 'bet', ante = 0, play = 0, pp = 0, shoe, pc, dc, busy = false;

    function buttons() {
      const chip = C.state.chip;
      let h = '';
      if (busy) h = '';
      else if (st === 'bet') h = `<button class="btn" data-a="deal">DEAL 發牌<small>Ante ${C.fmt(chip)}${$('#tcPP').checked ? ' + PP ' + C.fmt(chip) : ''}</small></button>`;
      else h = `<button class="btn green" data-a="play" ${C.state.wallet < ante ? 'disabled' : ''}>PLAY 加注<small>${C.fmt(ante)}</small></button><button class="btn red" data-a="fold">FOLD 棄牌</button>`;
      ctl.innerHTML = h; $('#tcPP').disabled = st !== 'bet';
    }
    function setSpots() { K.setSpot(spots.ante, ante); K.setSpot(spots.play, play); K.setSpot(spots.pp, pp); }
    const draw = n => Array.from({ length: n }, () => shoe.draw());

    async function deal() {
      if (busy || st !== 'bet') return;
      const a = C.state.chip, usePP = $('#tcPP').checked;
      if (!C.spend(a * (usePP ? 2 : 1))) return;
      busy = true; ante = a; pp = usePP ? a : 0; play = 0; K.hideBanner(scene); $('#tcRes').textContent = '';
      ['#tcD', '#tcP'].forEach(s => { $(s).innerHTML = ''; }); $('#tcDN').textContent = ''; $('#tcPN').textContent = '';
      shoe = K.shoe(1); pc = draw(3); dc = draw(3); setSpots(); C.sfx('chips'); buttons();
      pc.forEach((c, i) => K.deal($('#tcP'), c, { flipAfter: true, from: $('.shoe'), root: felt, delay: i * 170 }));
      dc.forEach((c, i) => K.deal($('#tcD'), c, { up: false, from: $('.shoe'), root: felt, delay: 520 + i * 170 }));
      await C.sleep(1700);
      $('#tcPN').textContent = '你的牌型：' + P.eval3(pc).name;
      st = 'decide'; busy = false; buttons(); C.notify('看牌後選擇 PLAY (加注 ' + C.fmt(ante) + ') 或 FOLD。');
    }
    async function finish(folded) {
      busy = true; buttons();
      if (!folded) { play = ante; if (!C.spend(play)) { play = 0; folded = true; } setSpots(); }
      C.$$('#tcD .pcard', view).forEach(e => K.flip(e, true)); await C.sleep(700);
      const pe = P.eval3(pc), de = P.eval3(dc);
      const qual = de.cat >= 1 || de.tb[0] >= 12;
      $('#tcDN').textContent = '莊家：' + de.name + (qual ? '' : '（不合格）'); $('#tcPN').textContent = '你：' + pe.name;
      let ret = 0; const lines = [];
      if (pp) { const m = PAIR_PLUS[pe.cat]; if (m) { ret += pp * (1 + m); lines.push('Pair Plus ' + pe.name + ' ' + m + ':1'); } else lines.push('Pair Plus 未中'); }
      if (!folded) {
        const bm = ANTE_BONUS[pe.cat]; if (bm) { ret += ante * bm; lines.push('Ante Bonus ' + bm + ':1'); }
        if (!qual) { ret += ante * 2 + play; lines.push('莊家不合格：底注 1:1、加注退回'); }
        else if (pe.score > de.score) { ret += (ante + play) * 2; lines.push('勝莊家：底注與加注各 1:1'); }
        else if (pe.score === de.score) { ret += ante + play; lines.push('平手：底注與加注退回'); }
        else lines.push('莊家較大：輸掉底注與加注');
      } else lines.push('棄牌：輸掉底注');
      const total = ante + play + pp, net = ret - total;
      if (!folded) K.highlight(C.$$('#tcP .pcard', view), pe.cards || pc);
      if (ret > 0) C.earn(ret);
      if (net > 0) { K.banner(scene, 'YOU WIN +' + C.fmt(net), pe.name + ' vs ' + de.name); C.celebrate(net, ante); C.notify('🎉 獲勝！淨賺 ' + C.fmt(net), 'win'); }
      else if (net === 0) { K.banner(scene, 'PUSH 平手', pe.name + ' vs ' + de.name); C.notify('平手，賭注退回。'); }
      else { K.banner(scene, folded ? 'FOLD' : 'DEALER WINS', '輸 ' + C.fmt(-net), true); C.sfx('lose'); C.notify('本局輸 ' + C.fmt(-net) + '。'); }
      $('#tcRes').textContent = lines.join(' ｜ ');
      st = 'bet'; busy = false; buttons();
    }
    ctl.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.a === 'deal') deal(); else if (b.dataset.a === 'play') finish(false); else if (b.dataset.a === 'fold') finish(true);
    });
    $('#tcPP').addEventListener('change', buttons);
    C.onChip(buttons); C.onWallet(buttons); buttons();
    return { show() { buttons(); }, primary() { if (st === 'bet') deal(); else if (st === 'decide' && !busy) finish(false); }, tip: '按 DEAL 發牌，看牌後決定 PLAY 或 FOLD；可勾選 Pair Plus。' };
  }

  C.register({ id: 'threecard', name: '三張牌撲克', sub: '3-Card Poker', icon: '♦', mount });
})();
