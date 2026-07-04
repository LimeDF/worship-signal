/* ============================================================
   app.js — загружается ПОСЛЕДНИМ. Старт и маршрутизация.
   Диспетчер строит проектор и лог ИЗ ПОТОКА ntfy (свои сообщения
   тоже обрабатываются — иначе лог расходится между устройствами).
   При старте восстанавливаем историю (последний слайд + лог), затем live.
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
      else root.appendChild(WS.UI.el('div',{class:'pad'}, 'Screen not found: ' + name));
    } catch(e){
      console.error('screen error', name, e);
      root.appendChild(WS.UI.el('div',{class:'pad'},
        WS.UI.el('div',{style:{color:'var(--danger)'}}, WS.t('error_prefix') + name),
        WS.UI.el('div',{class:'muted', style:{fontSize:'13px', marginTop:'8px'}}, String(e.message || e))
      ));
    }
  };

  function blockName(t){ return t==='chorus'?WS.t('chorus'):t==='bridge'?WS.t('bridge'):WS.t('verse'); }
  function signalName(a){ return { repeat:WS.t('q_repeat'), next:WS.t('q_next'), prev:WS.t('q_prev'), exit:WS.t('q_stop') }[a] || a; }
  function prev(s){ return WS.UI.preview(s, 40); }

  // применить общие настройки из config.json (общий Google Client ID на все устройства)
  function applyConfig(){
    const c = (WS.Data.items('config') || [])[0];
    if(c && c.drive_client_id && WS.Drive) WS.Drive.setClientIdShared(c.drive_client_id);
  }
  WS.App.applyConfig = applyConfig;

  function globalHandler(p){
    const mine = (p._dev === WS.Auth.getDeviceId());

    // ----- ПРОЕКТОР (одинаково на всех устройствах) -----
    if(p.t === 'block' || p.t === 'text' || p.t === 'media' || p.t === 'bible' || p.t === 'qr' || p.t === 'splash' || p.t === 'announce_loop') WS.Projector.set(p);
    else if(p.t === 'clear') WS.Projector.set({ t:'clear' });

    // ----- ЛОГ (строится из потока, свои события тоже) -----
    if(p.t === 'block')       WS.Log.add({ source:p._name, kind:'block',  label:'#'+(p.number||'')+' '+(p.title||'')+' — '+blockName(p.blockType) });
    else if(p.t === 'text')   WS.Log.add({ source:p._name, kind:'block',  label:WS.t('m_text')+': '+prev(p.body) });
    else if(p.t === 'media')  WS.Log.add({ source:p._name, kind:'block',  label:WS.t('m_media')+': '+(p.title||'') });
    else if(p.t === 'clear')  WS.Log.add({ source:p._name, kind:'clear',  label:WS.t('projector_cleared') });
    else if(p.t === 'signal') WS.Log.add({ source:p._name, kind:'signal', label:WS.t('signal_sent', signalName(p.action)) });
    else if(p.t === 'activity' && p.kind === 'bible')   WS.Log.add({ source:p._name, kind:'bible',   label:WS.t('m_bible')+': '+p.label });
    else if(p.t === 'bible')  WS.Log.add({ source:p._name, kind:'bible', label:(p.ref || '') + (p.text ? ' — ' + prev(p.text) : '') });
    else if(p.t === 'activity' && p.kind === 'program') WS.Log.add({ source:p._name, kind:'program', label:p.label });

    if(p.t === 'log_clear') WS.Log.clear(true);

    // ----- чат/данные: свои пропускаем (уже применены локально) -----
    if(p.t === 'chat' && !mine && WS.Chat) WS.Chat.receive(p);
    if(p.t === 'data' && !mine && p.collection && WS.Data){
      WS.Data.refresh(p.collection);
      if(p.collection === 'config') setTimeout(applyConfig, 800);   // подхватить общий Client ID
    }
    // мгновенная синхронизация Google Client ID между устройствами (надёжнее файла)
    if(p.t === 'config' && p.client_id && WS.Drive) WS.Drive.setClientIdShared(p.client_id);
    if(p.t === 'config_request' && !mine && WS.Drive && WS.Drive.getClientId()){
      setTimeout(function(){ WS.Sync.send({ t:'config', client_id: WS.Drive.getClientId() }); }, Math.floor(Math.random()*1500));
    }

    if(typeof WS.state.onMessage === 'function'){ try { WS.state.onMessage(p); } catch(e){ console.error(e); } }
  }

  WS.App.isWatch = function(){ return (location.hash || '').indexOf('watch') !== -1; };

  WS.App.boot = function(){
    WS.Auth.getDeviceId();
    WS.Sync.on(globalHandler);

    // режим зрителя (follow-along): без пароля, только чтение проектора
    if(WS.App.isWatch()){
      WS.state.viewer = true;
      WS.Sync.connect();          // SSE + опрос (ничего не шлём)
      WS.App.show('follow');
      WS.Sync.restore();          // получить текущий слайд
      return;
    }

    if(WS.Presence) WS.Presence.start();

    WS.Sync.connect();          // связь включается СРАЗУ (SSE + опрос), не ждём историю

    ['songs','psalms','texts','bible','announcements','media','programs'].forEach(c => { WS.Data.load(c).catch(()=>{}); });
    WS.Data.load('config').then(applyConfig).catch(()=>{});   // общий Google Client ID

    if(!WS.Auth.getLevel()) WS.App.show('pin');
    else WS.App.show('role');

    WS.Sync.restore();          // историю (последний слайд + лог) добираем в фоне

    // если своего Client ID нет — попросить у других устройств (мгновенно)
    setTimeout(function(){ if(WS.Drive && !WS.Drive.getClientId()) WS.Sync.send({ t:'config_request' }); }, 1500);
  };
})();
