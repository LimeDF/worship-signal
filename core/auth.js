/* ============================================================
   auth.js — пароли, уровни доступа, идентичность устройства
   Уровни: 'regular' | 'stage' | 'lime'
     regular (2580)        — смотреть, добавлять
     stage  (OPERATOR)     — + редактировать/удалять, роли Сцена/Псалмы
     lime   (LIMEinCHURCH) — + назначение уровней, блокировка, бэкапы
   ============================================================ */
(function(){
  const PIN_REGULAR = '2580';
  const PIN_STAGE   = 'OPERATOR';
  const PIN_LIME    = 'LIMEinCHURCH';
  const STAGE_GRACE_MS = 24 * 60 * 60 * 1000;  // пароль OPERATOR действует 24ч
  const LOCK_MS        = 3 * 60 * 1000;        // кулдаун после блокировки

  const A = {};

  // --- идентичность ---
  A.getDeviceId = function(){
    let id = WS.ls.get('device_id');
    if(!id){
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
           : 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      WS.ls.set('device_id', id);
    }
    return id;
  };
  A.getDeviceName = function(){ return WS.ls.get('device_name', '') || ''; };
  A.setDeviceName = function(n){ WS.ls.set('device_name', String(n || '').trim()); };

  // --- уровень ---
  A.getLevel = function(){ return WS.ls.get('level', null); };

  // вход по паролю на стартовом экране
  A.login = function(pw){
    if(A.isLocked()) return { ok:false, locked:true };
    if(pw === PIN_LIME){    WS.ls.set('level','lime');    return { ok:true, level:'lime' }; }
    if(pw === PIN_STAGE){   WS.ls.set('level','stage');   A._markGrace(); return { ok:true, level:'stage' }; }
    if(pw === PIN_REGULAR){ WS.ls.set('level','regular'); return { ok:true, level:'regular' }; }
    return { ok:false };
  };

  // повышение до stage по паролю OPERATOR (вход в роли Сцена/Псалмы)
  A.unlockStage = function(pw){
    if(pw === PIN_STAGE || pw === PIN_LIME){
      if(A.getLevel() === 'regular') WS.ls.set('level','stage');
      A._markGrace();
      return true;
    }
    return false;
  };
  A._markGrace = function(){ WS.ls.set('stage_grace', Date.now()); };

  // нужен ли пароль для входа в роль, требующую stage
  A.needStagePassword = function(){
    if(A.getLevel() === 'lime') return false;
    if(A.getLevel() === 'stage'){
      const t = WS.ls.get('stage_grace', 0);
      if((Date.now() - t) < STAGE_GRACE_MS) return false;
    }
    return true;
  };

  A.logout = function(){
    WS.ls.del('level'); WS.ls.del('device_name'); WS.ls.del('stage_grace');
  };

  // --- права ---
  A.canAdd   = function(){ return !!A.getLevel(); };                                   // любой вошедший
  A.canEdit  = function(){ const l = A.getLevel(); return l === 'stage' || l === 'lime'; };
  A.canAdmin = function(){ return A.getLevel() === 'lime'; };

  // --- блокировка (кулдаун 3 мин) ---
  A.isLocked = function(){ return Date.now() < WS.ls.get('lock_until', 0); };
  A.lock = function(){ WS.ls.set('lock_until', Date.now() + LOCK_MS); };
  A.lockRemainingSec = function(){ return Math.max(0, Math.ceil((WS.ls.get('lock_until',0) - Date.now())/1000)); };

  WS.Auth = A;
})();
