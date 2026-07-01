/* ============================================================
   sync.js — связь между устройствами через ntfy.sh.
   ПРИНЦИП: проектор и лог — производные от общего потока сообщений.
   Каждое устройство проигрывает один и тот же поток (история + live),
   поэтому состояние (что на экране, что в логе) одинаково у всех.
     - restore(): при старте добираем историю за 6ч и восстанавливаем
       последний слайд и лог — даже если подключились позже;
     - SSE (реальное время) + страховочный poll каждые 10с (since);
     - дедуп по id; НЕ фильтруем «свои» — иначе логи расходятся между
       устройствами (отправитель тоже должен видеть своё событие в логе).
     - isLive по времени последней активности, а не по readyState —
       чинит ложное «нет связи» и мигание проектора после reconnect.
   ============================================================ */
(function(){
  const S = {};
  const POLL_MS = 10000;
  let es = null, handlers = [], reconnectTimer = null, pollTimer = null;
  const seen = new Set();
  let lastTime = Math.floor(Date.now() / 1000);
  let lastActivity = Date.now();

  function base(){ return WS.config.NTFY_URL + '/' + WS.config.TOPIC; }

  function processEnvelope(env){
    lastActivity = Date.now();
    if(!env || (env.event && env.event !== 'message')) return;    // open/keepalive
    if(env.id){ if(seen.has(env.id)) return; seen.add(env.id); if(seen.size > 3000) seen.clear(); }
    if(env.time && env.time > lastTime) lastTime = env.time;
    let p; try { p = JSON.parse(env.message); } catch(e){ return; }
    handlers.forEach(h => { try { h(p); } catch(e){ console.error('handler', e); } });
  }

  // восстановление последнего состояния из истории ntfy (только контент/лог-события)
  S.restore = async function(done){
    try {
      const ctrl = new AbortController();
      const to = setTimeout(function(){ try { ctrl.abort(); } catch(e){} }, 8000);
      const res = await fetch(base() + '/json?poll=1&since=6h', { cache:'no-store', signal: ctrl.signal });
      clearTimeout(to);
      if(res.ok){
        lastActivity = Date.now();
        const keep = { block:1, text:1, media:1, clear:1, signal:1, activity:1, log_clear:1 };
        const envs = [];
        (await res.text()).split('\n').forEach(function(line){
          line = line.trim(); if(!line) return;
          let env; try { env = JSON.parse(line); } catch(e){ return; }
          if(!env || (env.event && env.event !== 'message')) return;
          let p; try { p = JSON.parse(env.message); } catch(e){ return; }
          if(!keep[p.t]) return;
          env._p = p; envs.push(env);
        });
        envs.sort(function(a,b){ return (a.time || 0) - (b.time || 0); });
        WS.Log.reset();                                   // строим лог заново из истории
        envs.forEach(function(env){
          if(env.id) seen.add(env.id);
          if(env.time && env.time > lastTime) lastTime = env.time;
          handlers.forEach(function(h){ try { h(env._p); } catch(e){} });
        });
      }
    } catch(e){}
    if(done) done();
  };

  S.connect = function(){
    S.disconnect();
    try {
      es = new EventSource(base() + '/sse?since=' + lastTime);
      es.onopen = function(){ lastActivity = Date.now(); };
      es.onmessage = function(ev){ lastActivity = Date.now(); let env; try { env = JSON.parse(ev.data); } catch(e){ return; } processEnvelope(env); };
      es.onerror = function(){ scheduleReconnect(); };
    } catch(e){ scheduleReconnect(); }
    startPoll();
  };

  function scheduleReconnect(){
    if(reconnectTimer) return;
    reconnectTimer = setTimeout(function(){ reconnectTimer = null; S.connect(); }, 3000);
  }

  function startPoll(){
    if(pollTimer) return;
    pollTimer = setInterval(async function(){
      try {
        const res = await fetch(base() + '/json?poll=1&since=' + lastTime, { cache:'no-store' });
        if(!res.ok) return;
        lastActivity = Date.now();
        (await res.text()).split('\n').forEach(function(line){
          line = line.trim(); if(!line) return;
          let env; try { env = JSON.parse(line); } catch(e){ return; }
          processEnvelope(env);
        });
      } catch(e){}
    }, POLL_MS);
  }

  S.disconnect = function(){ if(es){ try { es.close(); } catch(e){} es = null; } };

  // «живо», если была активность (SSE/keepalive/poll) за последние 30с
  S.isLive = function(){ return (Date.now() - lastActivity) < 30000; };

  S.send = async function(payload){
    payload._dev  = WS.Auth.getDeviceId();
    payload._name = WS.Auth.getDeviceName();
    payload._lvl  = WS.Auth.getLevel();
    const body = JSON.stringify(payload);
    try { await fetch(base(), { method:'POST', body }); }
    catch(e){
      try { await fetch(base(), { method:'POST', body }); }
      catch(e2){ console.error('send failed', e2); WS.UI && WS.UI.toast(WS.t('no_conn'), 'error'); }
    }
  };

  S.on  = function(h){ handlers.push(h); };
  S.off = function(h){ handlers = handlers.filter(x => x !== h); };

  WS.Sync = S;
})();
