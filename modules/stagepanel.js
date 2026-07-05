/* stagepanel.js — сигналы сцены как выезжающая снизу панель (вариант 2).
   Показывается на уровне доступа «Сцена» (OPERATOR+) на экранах Пісні/Псалми и Оператор. */
(function(){
  const S = {};
  function sig(action){
    WS.Sync.send({ t:'signal', action });
    if(action === 'exit'){ WS.Sync.send({ t:'clear' }); WS.Projector.set({ t:'clear' }); }
    const names = { repeat:WS.t('q_repeat'), next:WS.t('q_next'), prev:WS.t('q_prev'), exit:WS.t('q_stop') };
    WS.UI.toast(WS.t('signal_sent', names[action]));
  }
  S.attach = function(screenEl){
    if(!WS.Auth || !WS.Auth.canEdit()) return;   // только уровень «Сцена» (OPERATOR/Lime)
    const panel = WS.UI.el('div',{class:'stage-panel'});
    panel.appendChild(WS.UI.el('div',{class:'stage-handle', onClick:()=>panel.classList.remove('open')}));
    panel.appendChild(WS.UI.el('div',{class:'stage-head'},
      WS.UI.el('div',{class:'stage-ptitle'}, WS.t('stage_title')),
      WS.UI.el('button',{class:'stage-close', onClick:()=>panel.classList.remove('open')}, '✕')
    ));
    panel.appendChild(WS.UI.el('div',{class:'quad quad-big'},
      WS.UI.el('button',{class:'q-repeat', onClick:()=>sig('repeat')}, '↻', WS.UI.el('small',null, WS.t('q_repeat'))),
      WS.UI.el('button',{class:'q-next',   onClick:()=>sig('next')},   '→', WS.UI.el('small',null, WS.t('q_next'))),
      WS.UI.el('button',{class:'q-prev',   onClick:()=>sig('prev')},   '←', WS.UI.el('small',null, WS.t('q_prev'))),
      WS.UI.el('button',{class:'q-exit',   onClick:()=>sig('exit')},   '×', WS.UI.el('small',null, WS.t('q_stop')))
    ));
    const fab = WS.UI.el('button',{class:'stage-fab', onClick:()=>panel.classList.toggle('open')}, WS.t('stage_title'));
    screenEl.appendChild(fab);
    screenEl.appendChild(panel);
  };
  WS.StagePanel = S;
})();
