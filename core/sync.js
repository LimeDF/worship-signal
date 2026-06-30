/* ============================================================
   sync.js — связь между устройствами через ntfy.sh (SSE).
   send() публикует JSON, on() подписывает обработчик.
   Дедуп по id сообщения, авто-переподключение, фильтр своих сообщений.
   ============================================================ */
(function(){
  const S = {};
  let es = null;
  let handlers = [];
  let reconnectTimer = null;
  const seen = new Set();

  function base(){ return WS.config.NTFY_URL + '/' + WS.config.TOPIC; }

  S.connect = function(){
    S.disconnect();
    try {
      es = new EventSource(base() + '/sse');
      es.onmessage = function(ev){
        let env; try { env = JSON.parse(ev.data); } catch(e){ return; }
        if(env.event && env.event !== 'message') return;       // open/keepalive
        if(env.id){ if(seen.has(env.id)) return; seen.add(env.id); if(seen.size > 800) seen.clear(); }
        let p; try { p = JSON.parse(env.message); } catch(e){ return; }
        if(p._dev === WS.Auth.getDeviceId()) return;           // своё — игнор
        handlers.forEach(h => { try { h(p); } catch(e){ console.error('handler', e); } });
      };
      es.onerror = function(){ scheduleReconnect(); };
    } catch(e){ scheduleReconnect(); }
  };

  function scheduleReconnect(){
    if(reconnectTimer) return;
    reconnectTimer = setTimeout(() => { reconnectTimer = null; S.connect(); }, 3000);
  }

  S.disconnect = function(){ if(es){ try { es.close(); } catch(e){} es = null; } };

  // true пока соединение открыто (для индикатора связи)
  S.isLive = function(){ return !!es && es.readyState === 1; };

  S.send = async function(payload){
    payload._dev  = WS.Auth.getDeviceId();
    payload._name = WS.Auth.getDeviceName();
    payload._lvl  = WS.Auth.getLevel();
    try { await fetch(base(), { method:'POST', body: JSON.stringify(payload) }); }
    catch(e){ console.error('send failed', e); WS.UI && WS.UI.toast('Нет связи','error'); }
  };

  S.on  = function(h){ handlers.push(h); };
  S.off = function(h){ handlers = handlers.filter(x => x !== h); };

  WS.Sync = S;
})();
