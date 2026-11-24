/* main.js — 啟動、側邊選單、遊戲切換、快捷鍵 */
(function () {
  'use strict';
  const C = window.Casino;
  const ORDER = ['slot', 'roulette', 'holdem', 'sicbo', 'threecard', 'deuces', 'videopoker', 'jacks'];
  const apis = {};
  let current = null;

  function show(id) {
    if (!apis[id]) id = ORDER[0];
    if (current && apis[current].hide) apis[current].hide();
    C.$$('.view').forEach(v => v.classList.toggle('on', v.dataset.id === id));
    C.$$('.nav').forEach(b => b.classList.toggle('on', b.dataset.id === id));
    current = id;
    if (apis[id].show) apis[id].show();
    C.notify(apis[id].tip || '請選擇籌碼並開始遊戲。');
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
    C.$('#side').classList.remove('open');
    window.scrollTo({ top: 0 });
  }
  C.show = show;

  function init() {
    C.buildChipRow();
    C.updateWallet();
    const side = C.$('#side'), views = C.$('#views');
    side.innerHTML = '<h3>大廳遊戲列表</h3>';
    const games = C.games.slice().sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
    games.forEach((g, i) => {
      const sec = document.createElement('section');
      sec.className = 'view'; sec.dataset.id = g.id; views.appendChild(sec);
      let api = {};
      try { api = g.mount(sec) || {}; } catch (e) { console.error('[' + g.id + '] mount 失敗', e); sec.innerHTML = '<p style="padding:40px;text-align:center">此遊戲載入失敗</p>'; }
      api.tip = g.tip; apis[g.id] = api;
      const b = document.createElement('button');
      b.className = 'nav'; b.dataset.id = g.id;
      b.innerHTML = '<span class="n">' + (i + 1) + '</span><span>' + g.name + '<small>' + g.sub + '</small></span>';
      b.onclick = () => { C.sfx('click'); show(g.id); };
      side.appendChild(b);
    });
    C.$('#burger').onclick = () => side.classList.toggle('open');
    C.$('#btn-sound').onclick = C.toggleSound;
    C.$('#btn-refill').onclick = C.refill;
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); });   // 讓空白鍵永遠對應目前遊戲的主要動作
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && current && apis[current].primary && !/INPUT|TEXTAREA/.test(e.target.tagName)) {
        e.preventDefault(); apis[current].primary();
      }
    });
    window.addEventListener('resize', () => { if (current && apis[current].show) apis[current].show(); });
    show((location.hash || '').slice(1) || ORDER[0]);
  }
  window.addEventListener('DOMContentLoaded', init);
})();
