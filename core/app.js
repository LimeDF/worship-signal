/* ============================================================
   app.js — загружается ПОСЛЕДНИМ. Старт приложения и маршрутизация.
     WS.App.boot()          — инициализация, подключение, выбор экрана.
     WS.App.show(name,p)    — показать экран (модули в WS.App.screens).
     Глобальный диспетчер сообщений: следит за lastDisplay и чатом,
     затем вызывает обработчик текущего экрана WS.state.onMessage.
   ============================================================ */
(function(){
  WS.App = WS.App || {}; WS.App.screens = WS.App.screens || {};

  // показать экран. Сбрасывает обработчик предыдущего и чистит чат-привязку.
  WS.App.show = function(name, params){
    // очистка предыдущего экрана
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
        WS.UI.el('div',{class:'muted', style:{fontSize:'13px', marginTop:'8px'}}, String(e.message||e))
      ));
    }
  };

  // глобальный обработчик ВСЕХ входящих сообщений
  function globalHandler(p){
    // отслеживаем последнее отображаемое (для трансляции при переключении)
    if(p.t === 'block' || p.t === 'text' || p.t === 'media') WS.state.lastDisplay = p;
    if(p.t === 'clear') WS.state.lastDisplay = null;
    // чат кладём в кэш всегда (даже если экран чата закрыт)
    if(p.t === 'chat' && WS.Chat) WS.Chat.receive(p);
    // обновление данных другим устройством — освежим кэш коллекции
    if(p.t === 'data' && p.collection && WS.Data) WS.Data.refresh(p.collection);
    // обработчик текущего экрана
    if(typeof WS.state.onMessage === 'function'){ try { WS.state.onMessage(p); } catch(e){ console.error(e); } }
  }

  WS.App.boot = function(){
    WS.Auth.getDeviceId();             // гарантируем UUID

    WS.Sync.on(globalHandler);
    WS.Sync.connect();
    if(WS.Presence) WS.Presence.start();   // присутствие устройств (для Lime-админки)

    // предзагрузка коллекций в фоне (UI не блокируем)
    ['songs','psalms','texts','bible','announcements','media'].forEach(c => {
      WS.Data.load(c).catch(()=>{});
    });

    // маршрут старта
    if(!WS.Auth.getLevel()) WS.App.show('pin');
    else WS.App.show('role');          // role-экран сам потребует имя, если пусто
  };
})();
