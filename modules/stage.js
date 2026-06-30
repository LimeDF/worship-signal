/* ============================================================
   stage.js — роль Сцена. 4 квадранта-сигнала + переход в роль Псалмы.
   Сигналы уходят оператору в ленту активности. «Выход» очищает проектор.
   ============================================================ */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  WS.App.screens.stage = function(root){
    const screen = WS.UI.el('div',{class:'screen app-screen col'});

    screen.appendChild(WS.UI.el('div',{class:'topbar'},
      WS.UI.el('button',{class:'icon-btn bare', onClick:()=>WS.App.show('role')},'←'),
      WS.UI.el('div',{class:'title'},'Сцена'),
      WS.UI.el('button',{class:'icon-btn', title:'В Псалмы', onClick:()=>{ WS.state.role='hymns'; WS.App.show('hymns'); }},'♪')
    ));

    function sig(action){
      WS.Sync.send({ t:'signal', action });
      if(action === 'exit'){ WS.Sync.send({ t:'clear' }); WS.Projector.set({ t:'clear' }); }
      WS.UI.toast('Сигнал: ' + ({repeat:'Повтор', next:'Далее', prev:'Назад', exit:'Стоп'}[action]));
    }

    screen.appendChild(WS.UI.el('div',{class:'quad'},
      WS.UI.el('button',{class:'q-repeat', onClick:()=>sig('repeat')}, '↻', WS.UI.el('small',null,'Повтор')),
      WS.UI.el('button',{class:'q-next',   onClick:()=>sig('next')},   '→', WS.UI.el('small',null,'Далее')),
      WS.UI.el('button',{class:'q-prev',   onClick:()=>sig('prev')},   '←', WS.UI.el('small',null,'Назад')),
      WS.UI.el('button',{class:'q-exit',   onClick:()=>sig('exit')},   '×', WS.UI.el('small',null,'Стоп'))
    ));

    // быстрая кнопка перехода в Псалмы внизу (дублирует иконку)
    screen.appendChild(WS.UI.el('div',{class:'pad'},
      WS.UI.el('button',{class:'btn btn-ghost', onClick:()=>{ WS.state.role='hymns'; WS.App.show('hymns'); }},'Перейти к Псалмам / Песням →')
    ));

    root.appendChild(screen);
  };
})();
