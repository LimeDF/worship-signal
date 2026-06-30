/* ============================================================
   app.js — загружается ПОСЛЕДНИМ. Старт и маршрутизация.
   Глобальный диспетчер сообщений делает ГЛАВНОЕ надёжно:
     - контент (block/text/media/clear) → WS.Projector (рисует всегда);
     - события → WS.Log (накопительный лог, виден любому оператору);
     - чат → WS.Chat; обновление данных → WS.Data.refresh.
   Только после этого зовётся обработчик текущего экрана (если есть).
   ============================================================ */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  WS.App.show = function(name, params){
    if(typeof WS.state._cleanup === 'function'){ try { WS.state._cleanup(); } catch(e){} }
    WS.state._cleanup = null;
    WS.state.onMessage = null;
    if(WS.Chat) WS.Chat.detach();

    WS.state.screen = name;
    const root = document.getElementById('app');
    WS.UI.clear(root);
    try {
      const fn = WS.App.screens[name];
      if(fn) fn(root, params || {});
      else root.appendChild(WS.UI.el('div',{class:'pad'}, 'Экран не найден: ' + name));
    } catch(e){
      console.error('Ошибка экрана', name, e);
      root.appendChild(WS.UI.el('div',{class:'pad'},
        WS.UI.el('div',{style:{color:'var(--danger)'}}, 'Ошибка экрана «'+name+'».'),
        WS.UI.el('div',{class:'muted', style:{fontSize:'13px', marginTop:'8px'}}, String(e.message || e))
      ));
    }
  };

  function blockName(t){ return t==='chorus'?'Припев':t==='bridge'?'Бридж':'Куплет'; }
  function signalName(a){ return { repeat:'Повтор', next:'Далее', prev:'Назад', exit:'Стоп' }[a] || a; }
  function prev(s){ return WS.UI.preview(s, 40); }

  // глобальный обработчик ВСЕХ входящих сообщений
  function globalHandler(p){
    // ----- ПРОЕКТОР (рисует всегда, независимо от экрана) -----
    if(p.t === 'block' || p.t === 'text' || p.t === 'media') WS.Projector.set(p);
    else if(p.t === 'clear') WS.Projector.set({ t:'clear' });

    // ----- ЛОГ (накопительный, общий для операторов) -----
    if(p.t === 'block')       WS.Log.add({ source:p._name, kind:'block',   label:'#'+(p.number||'')+' '+(p.title||'')+' — '+blockName(p.blockType) });
    else if(p.t === 'text')   WS.Log.add({ source:p._name, kind:'block',   label:'Текст: '+prev(p.body) });
    else if(p.t === 'media')  WS.Log.add({ source:p._name, kind:'block',   label:'Медиа: '+(p.title||'') });
    else if(p.t === 'clear')  WS.Log.add({ source:p._name, kind:'signal',  label:'Проектор очищен' });
    else if(p.t === 'signal') WS.Log.add({ source:p._name, kind:'signal',  label:'Сигнал: '+signalName(p.action) });
    else if(p.t === 'activity' && p.kind === 'bible')   WS.Log.add({ source:p._name, kind:'bible',   label:'Библия: '+p.label });
    else if(p.t === 'activity' && p.kind === 'program') WS.Log.add({ source:p._name, kind:'program', label:p.label });

    if(p.t === 'log_clear') WS.Log.clear(true);   // очистка лога с другого устройства

    // ----- прочее -----
    if(p.t === 'chat' && WS.Chat) WS.Chat.receive(p);
    if(p.t === 'data' && p.collection && WS.Data) WS.Data.refresh(p.collection);

    // обработчик текущего экрана (например индикатор связи)
    if(typeof WS.state.onMessage === 'function'){ try { WS.state.onMessage(p); } catch(e){ console.error(e); } }
  }

  WS.App.boot = function(){
    WS.Auth.getDeviceId();

    WS.Sync.on(globalHandler);
    WS.Sync.connect();
    if(WS.Presence) WS.Presence.start();

    ['songs','psalms','texts','bible','announcements','media','programs'].forEach(c => { WS.Data.load(c).catch(()=>{}); });

    if(!WS.Auth.getLevel()) WS.App.show('pin');
    else WS.App.show('role');
  };
})();
