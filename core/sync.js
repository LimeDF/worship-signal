/* ============================================================
   sync.js — связь между устройствами через ntfy.sh.
   Надёжная доставка: SSE (реальное время) + добор пропущенного.
     - при переподключении используем ?since=<время> чтобы не терять;
     - страховочный poll каждые 10с добирает то, что мог пропустить SSE;
     - дедуп по id сообщения исключает повторы.
   send() публикует JSON, on() подписывает обработчик.
   ============================================================ */
(function(){
  const S = {};
  const POLL_MS = 10000;
  let es = null;
  let handlers = [];
  let reconnectTimer = null;
  let pollTimer = null;
  const seen = new Set();
  let lastTime = Math.floor(Date.now() / 1000);   // сек последнего полученного события

  function base(){ return WS.config.NTFY_URL + '/' + WS.config.TOPIC; }

  // единая обработка «конверта» ntfy (и из SSE, и из poll)
  function processEnvelope(env){
    if(!env || (env.event && env.event !== 'message')) return;     // open/keepalive
    if(env.id){ if(seen.has(env.id)) return; seen.add(env.id); if(seen.size > 1200) seen.clear(); }
    if(env.time && env.time > lastTime) lastTime = env.time;
    let p; try { p = JSON.parse(env.message); } catch(e){ return; }
    if(p._dev === WS.Auth.getDeviceId()) return;                   // своё — игнор
    handlers.forEach(h => { try { h(p); } catch(e){ console.error('handler', e); } });
  }

  S.connect = function(){
    S.disconnect();
    let url = base() + '/sse?since=' + lastTime;   // since не даёт потерять при reconnect
    try {
      es = new EventSource(url);
      es.onmessage = function(ev){ let env; try { env = JSON.parse(ev.data); } catch(e){ return; } processEnvelope(env); };
      es.onerror = function(){ scheduleReconnect(); };
    } catch(e){ scheduleReconnect(); }
    startPoll();
  };

  function scheduleReconnect(){
    if(reconnectTimer) return;
    reconnectTimer = setTimeout(function(){ reconnectTimer = null; S.connect(); }, 3000);
  }

  // страховочный опрос: добирает пропущенные сообщения, даже если SSE завис
  function startPoll(){
    if(pollTimer) return;
    pollTimer = setInterval(async function(){
      try {
        const res = await fetch(base() + '/json?poll=1&since=' + lastTime, { cache:'no-store' });
        if(!res.ok) return;
        const text = await res.text();
        text.split('\n').forEach(function(line){
          line = line.trim(); if(!line) return;
          let env; try { env = JSON.parse(line); } catch(e){ return; }
          processEnvelope(env);
        });
      } catch(e){}
    }, POLL_MS);
  }

  S.disconnect = function(){ if(es){ try { es.close(); } catch(e){} es = null; } };

  S.isLive = function(){ return !!es && es.readyState === 1; };

  // отправка с одной повторной попыткой при сбое сети
  S.send = async function(payload){
    payload._dev  = WS.Auth.getDeviceId();
    payload._name = WS.Auth.getDeviceName();
    payload._lvl  = WS.Auth.getLevel();
    const body = JSON.stringify(payload);
    try {
      await fetch(base(), { method:'POST', body });
    } catch(e){
      try { await fetch(base(), { method:'POST', body }); }       // вторая попытка
      catch(e2){ console.error('send failed', e2); WS.UI && WS.UI.toast('Нет связи', 'error'); }
    }
  };

  S.on  = function(h){ handlers.push(h); };
  S.off = function(h){ handlers = handlers.filter(x => x !== h); };

  WS.Sync = S;
})();
