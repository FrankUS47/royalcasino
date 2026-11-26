/* videopoker.js — 視訊撲克機台 (3D 機箱 + CRT 螢幕 + 實體 HOLD 按鍵)，同一引擎三種機型：
   Jacks or Better 9/6、Deuces Wild (2 為百搭)、Bonus Poker 8/5。賠率表見 poker-eval.js (P.VP)
   投注 1~5 枚硬幣 × 目前籌碼面額；5 枚硬幣打出皇家同花順享 800 倍大獎 */
(function () {
  'use strict';
  const C = window.Casino, K = window.Cards, P = window.PokerEval;
  const ROYAL = { royal: 1, natroyal: 1 };

  const MACHINES = [
    { id: 'jacks', variant: 'jacks', theme: '', name: '傑克高手', sub: 'Jacks or Better 9/6', title: 'JACKS <b>♠</b> BETTER', tip: 'Jacks or Better：一對 J 以上即中獎。點牌或 HOLD 鍵保留，按 DRAW 換牌。' },
    { id: 'deuces', variant: 'deuces', theme: 't-green', name: '百搭二', sub: 'Deuces Wild', title: 'DEUCES <b>♦</b> WILD', tip: 'Deuces Wild：四張 2 皆為百搭，三條以上才中獎。' },
    { id: 'videopoker', variant: 'bonus', theme: 't-blue', name: '螢幕撲克', sub: 'Bonus Poker 8/5', title: 'BONUS <b>♥</b> POKER', tip: 'Bonus Poker：四條依點數加倍 (四條 A 80x)，一對 J 以上中獎。' }
  ];

  function mount(view, M) {
    const V = P.VP[M.variant];
    view.innerHTML = `
      <div class="slot-layout">
        <aside class="side-pnl">
          <h4>HOW TO PLAY 玩法<small>${M.sub}</small></h4>
          <ol class="howto"><li><b>BET ONE</b> 選 1–5 枚硬幣（硬幣面額 = 底部籌碼）</li><li>按 <b>DEAL</b> 發 5 張牌</li><li>點牌或按 <b>HOLD</b> 保留想留的牌</li><li>按 <b>DRAW</b> 換牌，依牌型派彩</li><li>押滿 <b>5 枚</b> 皇家同花順最高賠 <b>4000</b></li></ol>
          <div class="slot-hint"><kbd>SPACE</kbd> 發牌 / 換牌<br><kbd>1</kbd>–<kbd>5</kbd> 切換保留</div>
        </aside>
        <div class="mach-scene"><div class="cab3d vp-cab ${M.theme}" id="vpCab">
          <div class="cab-side L"></div><div class="cab-side R"></div><div class="cab-back"></div><div class="cab-shadow"></div>
          <div class="cab-front">
            <div class="topper"><div class="logo7">${M.title}</div><small>VIDEO POKER · 5 CARD DRAW</small></div>
            <div class="vp-pay" id="vpPay"></div>
            <div class="vp-bezel"><div class="vp-screen"><div class="vp-msg" id="vpMsg"></div>
              <div class="vp-slots" id="vpSlots">${[0, 1, 2, 3, 4].map(i => `<div class="vp-slot" data-i="${i}"><div class="vp-tag">HELD</div><div class="vp-card"></div></div>`).join('')}</div></div></div>
            <div class="vp-holds">${[0, 1, 2, 3, 4].map(i => `<button class="pbtn blu" data-h="${i}">HOLD</button>`).join('')}</div>
            <div class="meters">
              <div class="meter"><label>CREDIT</label><div class="led green"><span class="ghost">888888</span><span class="val" id="vCredit">0</span></div></div>
              <div class="meter"><label>BET</label><div class="led"><span class="ghost">88888</span><span class="val" id="vBet">0</span></div></div>
              <div class="meter"><label>WIN</label><div class="led red"><span class="ghost">888888</span><span class="val" id="vWin">0</span></div></div>
            </div>
            <div class="deck-wrap">
              <div class="deck-cheek l"></div><div class="deck-cheek r"></div>
              <div class="deck">
                <button class="pbtn gry" id="vCash">CASH<br>OUT</button>
                <button class="pbtn blu" id="vOne">BET<br>ONE</button>
                <button class="pbtn grn" id="vMax">BET<br>MAX</button>
                <button class="pbtn gold big glow" id="vDeal">DEAL</button>
              </div>
              <div class="deck-lip"></div>
            </div>
            <div class="belly"><div class="billslot"><em>BILL</em></div><div class="rplate">ROYAL</div><div class="cardslot"></div></div>
            <div class="tray" id="vTray"><div class="lbl">COIN TRAY</div></div>
          </div>
        </div></div>
        <aside class="side-pnl">
          <h4>RECENT 最近牌局<small>共 <b id="hSpins">0</b> 手 · 最高單次贏 <b id="hBest">$0</b></small></h4>
          <div class="hist-list" id="vpHist"><div class="hist-empty">尚無紀錄</div></div>
        </aside>
      </div>`;
    const $ = s => view.querySelector(s), cab = $('#vpCab'), tray = $('#vTray');
    const hist = []; let nHand = 0, bestW = 0;
    let coins = 1, st = 'idle', busy = false, shoe, hand = [], held = [false, false, false, false, false];
    const slots = C.$$('.vp-slot', view), holds = C.$$('.vp-holds .pbtn', view);
    const setLed = (id, v) => { $(id).textContent = Math.round(v); };

    function renderPay() {
      $('#vpPay').innerHTML = '<div class="vp-row hd"><span>HAND 牌型</span>' + [1, 2, 3, 4, 5].map(c => `<b class="c${c}${c === coins ? ' on' : ''}">${c}</b>`).join('') + '</div>' +
        V.map(r => `<div class="vp-row" data-k="${r.key}"><span class="nm">${r.name}</span>${[1, 2, 3, 4, 5].map(c => `<b class="${c === coins ? 'on' : ''}">${ROYAL[r.key] && c === 5 ? 4000 : r.mult * c}</b>`).join('')}</div>`).join('');
    }
    const refresh = () => { setLed('#vCredit', C.state.wallet); setLed('#vBet', coins * C.state.chip); renderPay(); };
    C.onWallet(() => { setLed('#vCredit', C.state.wallet); }); C.onChip(refresh);
    const msg = (t, gold) => { const m = $('#vpMsg'); m.textContent = t; m.classList.toggle('gold', !!gold); };

    function cardEl(i) { return slots[i].querySelector('.pcard'); }
    function setHold(i, on) { held[i] = on; slots[i].classList.toggle('held', on); holds[i].classList.toggle('held', on); }
    function toggle(i) {
      if (st !== 'hold' || busy) return; C.sfx('button'); setHold(i, !held[i]);
    }
    const ctrl = on => ['#vDeal', '#vOne', '#vMax', '#vCash'].forEach(s => { $(s).disabled = !on; });
    function clearWin() {
      C.$$('.vp-row.win', view).forEach(r => r.classList.remove('win')); cab.classList.remove('winning'); setLed('#vWin', 0);
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
    const press = b => { b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 140); };

    async function deal() {
      if (busy) return;
      if (st === 'idle') {
        const bet = coins * C.state.chip;
        if (!C.spend(bet)) { msg('INSUFFICIENT CREDIT'); return; }
        busy = true; ctrl(false); press($('#vDeal')); clearWin();
        tray.classList.remove('full'); C.$$('.tcoin', tray).forEach(c => c.remove());
        shoe = K.shoe(1); hand = [shoe.draw(), shoe.draw(), shoe.draw(), shoe.draw(), shoe.draw()];
        for (let i = 0; i < 5; i++) { setHold(i, false); const box = slots[i].querySelector('.vp-card'); box.innerHTML = ''; box.appendChild(K.el(hand[i], false)); C.sfx('card'); await C.sleep(90); }
        for (let i = 0; i < 5; i++) { K.flip(cardEl(i), true); await C.sleep(110); }
        st = 'hold'; busy = false; ctrl(true); $('#vDeal').innerHTML = 'DRAW'; $('#vOne').disabled = $('#vMax').disabled = true;
        const pre = P.videoPoker(hand, M.variant);
        msg(pre.mult ? '已成牌：' + pre.name : '選擇要保留的牌，再按 DRAW'); C.notify('點牌或 HOLD 鍵保留，按 DRAW 換牌。');
      } else if (st === 'hold') {
        busy = true; ctrl(false); press($('#vDeal'));
        for (let i = 0; i < 5; i++) if (!held[i]) { hand[i] = shoe.draw(); const box = slots[i].querySelector('.vp-card'); box.innerHTML = ''; box.appendChild(K.el(hand[i], false)); C.sfx('card'); await C.sleep(110); }
        for (let i = 0; i < 5; i++) if (!held[i]) { K.flip(cardEl(i), true); await C.sleep(130); }
        await C.sleep(350);
        const res = P.videoPoker(hand, M.variant), bet = coins * C.state.chip;
        const per = ROYAL[res.key] && coins === 5 ? 800 : res.mult, win = per * coins * C.state.chip;
        for (let i = 0; i < 5; i++) setHold(i, false);
        if (win > 0) {
          C.earn(win); const row = view.querySelector(`.vp-row[data-k="${res.key}"]`); if (row) row.classList.add('win');
          const t0 = performance.now(), dur = Math.min(1600, 500 + win);
          (function f(t) { const p = Math.min(1, (t - t0) / dur); setLed('#vWin', win * p); if (p < 1) requestAnimationFrame(f); })(t0);
          addCoins(Math.min(30, 4 + per * 2)); cab.classList.add('winning'); C.sfx('bell'); C.celebrate(win, bet);
          msg('WINNER — ' + res.name, true); C.notify('🎉 ' + res.name + '！贏得 ' + C.fmt(win), 'win');
          setTimeout(() => cab.classList.remove('winning'), 3200);
        } else { msg('GAME OVER — 未成牌'); C.notify('未成牌，再來一手！'); C.sfx('lose'); }
        nHand++; bestW = Math.max(bestW, win); hist.unshift({ n: nHand, name: res.name, win });
        if (hist.length > 9) hist.pop();
        $('#hSpins').textContent = nHand; $('#hBest').textContent = C.fmt(bestW);
        $('#vpHist').innerHTML = hist.map(h => '<div class="hist-row vp ' + (h.win ? 'w' : '') + '"><i>#' + h.n + '</i><span>' + (h.win ? h.name : '未成牌') + '</span><b>' + (h.win ? '+' + C.fmt(h.win) : '—') + '</b></div>').join('');
        st = 'idle'; busy = false; ctrl(true); $('#vDeal').innerHTML = 'DEAL';
      }
    }
    slots.forEach((s, i) => { s.onclick = () => toggle(i); });
    holds.forEach((b, i) => { b.onclick = () => toggle(i); });
    $('#vDeal').onclick = deal;
    $('#vOne').onclick = () => { if (busy || st !== 'idle') return; press($('#vOne')); coins = coins % 5 + 1; C.sfx('button'); refresh(); };
    $('#vMax').onclick = () => { if (busy || st !== 'idle') return; press($('#vMax')); coins = 5; refresh(); deal(); };
    $('#vCash').onclick = () => { if (busy) return; press($('#vCash')); C.sfx('coins'); C.notify('🧾 現金票券列印中… 目前餘額 ' + C.fmt(C.state.wallet) + '（模擬機台，無真實金錢）'); };
    document.addEventListener('keydown', e => {
      if (!view.offsetParent || !/^[1-5]$/.test(e.key)) return; toggle(+e.key - 1);
    });

    refresh(); msg('INSERT COINS — PRESS DEAL');
    for (let i = 0; i < 5; i++) slots[i].querySelector('.vp-card').appendChild(K.el(null, false));
    C.tilt(view, cab, { baseX: 2, baseY: -11 });
    return { primary: deal, tip: M.tip };
  }

  MACHINES.forEach(M => C.register({ id: M.id, name: M.name, sub: M.sub, icon: '🂡', tip: M.tip, w: 1560, mount: v => mount(v, M) }));
})();
