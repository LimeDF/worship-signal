/* stage.js — роль Сцена (локализован) */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  WS.App.screens.stage = function(root){
    const screen = WS.UI.el('div',{class:'screen app-screen col'});
    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>WS.App.show('role')},'←'),
      WS.UI.el('div',{class:'title'}, WS.t('stage_title')),
      WS.UI.el('button',{class:'icon-btn', title:WS.t('to_hymns'), onClick:()=>{ WS.state.role='hymns'; WS.App.show('hymns'); }},'♪')
    ));

    function sig(action){
      WS.Sync.send({ t:'signal', action });
      if(action === 'exit'){ WS.Sync.send({ t:'clear' }); WS.Projector.set({ t:'clear' }); }
      const names = { repeat:WS.t('q_repeat'), next:WS.t('q_next'), prev:WS.t('q_prev'), exit:WS.t('q_stop') };
      WS.UI.toast(WS.t('signal_sent', names[action]));
    }

    screen.appendChild(WS.UI.el('div',{class:'quad'},
      WS.UI.el('button',{class:'q-repeat', onClick:()=>sig('repeat')}, '↻', WS.UI.el('small',null, WS.t('q_repeat'))),
      WS.UI.el('button',{class:'q-next',   onClick:()=>sig('next')},   '→', WS.UI.el('small',null, WS.t('q_next'))),
      WS.UI.el('button',{class:'q-prev',   onClick:()=>sig('prev')},   '←', WS.UI.el('small',null, WS.t('q_prev'))),
      WS.UI.el('button',{class:'q-exit',   onClick:()=>sig('exit')},   '×', WS.UI.el('small',null, WS.t('q_stop')))
    ));

    screen.appendChild(WS.UI.el('div',{class:'pad'},
      WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>{ WS.state.role='hymns'; WS.App.show('hymns'); }}, WS.t('go_hymns'))
    ));

    root.appendChild(screen);
  };
})();
