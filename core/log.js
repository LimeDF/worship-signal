/* ============================================================
   log.js — глобальный лог активности.
   Хранится в localStorage, накапливается ВСЕГДА (через диспетчер в app.js),
   не сбрасывается при выходе/входе на экран оператора.
   Любой оператор на устройстве видит накопленный лог.
   Очистка лога синхронизируется между устройствами (broadcast log_clear).
   ============================================================ */
(function(){
  const KEY = 'activity_log';
  const L = {};

  L.list = function(){ return WS.ls.get(KEY, []) || []; };

  L.add = function(entry){
    const a = L.list();
    a.push({ ts:Date.now(), source:entry.source || '—', kind:entry.kind || '', label:entry.label || '' });
    WS.ls.set(KEY, a.slice(-300));
    if(L._onAdd){ try { L._onAdd(); } catch(e){} }
  };

  // local=true — пришло от другого устройства, не рассылать повторно
  L.clear = function(local){
    WS.ls.set(KEY, []);
    if(L._onAdd){ try { L._onAdd(); } catch(e){} }
    if(!local && WS.Sync) WS.Sync.send({ t:'log_clear' });
  };

  L.onAdd = function(cb){ L._onAdd = cb; };
  L.offAdd = function(){ L._onAdd = null; };

  WS.Log = L;
})();
