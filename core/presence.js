/* ============================================================
   presence.js — «присутствие» устройств без сервера (через ntfy).
   Каждое вошедшее устройство периодически шлёт presence (имя/уровень/роль).
   Lime собирает онлайн-список и шлёт команды:
     set_level — сменить уровень целевому устройству
     block     — выкинуть на PIN с кулдауном 3 мин (чистка дублей)
   Команды исполняются только если отправитель был Lime (_lvl==='lime').
   Запускается один раз в app.boot() на ВСЕХ устройствах.
   ============================================================ */
(function(){
  const P = {};
  const HEARTBEAT_MS = 25000;       // как часто слать presence
  const ONLINE_MS    = 45000;       // онлайн, если presence был < 45с назад
  const devices = new Map();        // id -> { id, name, level, role, lastSeen }
  let hbTimer = null;
  let onChange = null;

  function myId(){ return WS.Auth.getDeviceId(); }

  function beat(){
    if(!WS.Auth.getLevel()) return;                 // не вошёл — не светимся
    WS.Sync.send({ t:'presence', role: WS.state.role || null });
  }

  // глобальный обработчик входящих (регистрируется в Sync при start)
  function handle(p){
    if(p.t === 'presence'){ record(p); }
    else if(p.t === 'presence_request'){ beat(); }
    else if(p.t === 'set_level'){ if(p.target === myId() && p._lvl === 'lime') applyLevel(p.level); }
    else if(p.t === 'block'){     if(p.target === myId() && p._lvl === 'lime') applyBlock(); }
  }

  function record(p){
    if(!p._dev) return;
    devices.set(p._dev, { id:p._dev, name:p._name || '—', level:p._lvl || null, role:p.role || null, lastSeen:Date.now() });
    if(onChange) onChange();
  }

  function applyLevel(level){
    if(['regular','stage','lime'].indexOf(level) < 0) return;
    WS.ls.set('level', level);
    if(level === 'stage' || level === 'lime') WS.ls.set('stage_grace', Date.now());
    WS.UI.toast(WS.t('your_level_changed', levelName(level)));
    if(WS.state.screen) WS.App.show(WS.state.screen);   // обновить права на экране
  }

  function applyBlock(){
    WS.Auth.lock();        // кулдаун 3 мин (см. auth.js)
    WS.Auth.logout();
    WS.UI.toast(WS.t('blocked_by_admin'), 'error');
    WS.App.show('pin');
  }

  // --- публичный API ---
  P.start = function(){
    WS.Sync.on(handle);
    beat();
    if(hbTimer) clearInterval(hbTimer);
    hbTimer = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) beat(); });
  };
  P.ping = function(){ WS.Sync.send({ t:'presence_request' }); beat(); };  // попросить всех представиться
  P.list = function(){
    const now = Date.now();
    return Array.from(devices.values())
      .map(d => ({ id:d.id, name:d.name, level:d.level, role:d.role, online:(now - d.lastSeen) < ONLINE_MS }))
      .sort((a,b) => (b.online?1:0) - (a.online?1:0) || a.name.localeCompare(b.name));
  };
  P.setLevel = function(targetId, level){ WS.Sync.send({ t:'set_level', target:targetId, level:level }); };
  P.block    = function(targetId){ WS.Sync.send({ t:'block', target:targetId }); };
  P.onChange = function(cb){ onChange = cb; };
  P.clearOnChange = function(){ onChange = null; };

  function levelName(l){ return { regular:WS.t('lvl_regular'), stage:WS.t('lvl_stage'), lime:WS.t('lvl_lime') }[l] || '—'; }
  P.levelName = levelName;

  WS.Presence = P;
})();
