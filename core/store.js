/* ============================================================
   store.js — пространство имён WS, конфиг, localStorage, состояние
   Загружается ПЕРВЫМ. Все модули цепляются к window.WS.
   ============================================================ */
window.WS = window.WS || {};

WS.config = {
  NTFY_URL: 'https://ntfy.sh',
  TOPIC: 'worship-signal-bfupc-7c3a9',   // общий канал. Сменить → другая «инстанция» церкви.
  DATA_DIR: 'data',                      // папка с json в репозитории
  STALE_MS: 60000,                       // связь потеряна > 60с → чёрный экран
  PSALM_NUM_MIN: 1,
  PSALM_NUM_MAX: 9999,
  ANNOUNCE_TTL_MS: 2 * 24 * 60 * 60 * 1000,  // объявления живут 2 дня
  CHAT_TTL_MS: 24 * 60 * 60 * 1000,          // чат хранится 1 день
};

WS.LS_PREFIX = 'ws_';
WS.ls = {
  get(key, def){
    try { const v = localStorage.getItem(WS.LS_PREFIX + key); return v == null ? def : JSON.parse(v); }
    catch(e){ return def; }
  },
  set(key, val){ try { localStorage.setItem(WS.LS_PREFIX + key, JSON.stringify(val)); } catch(e){} },
  del(key){ try { localStorage.removeItem(WS.LS_PREFIX + key); } catch(e){} }
};

// Рантайм-состояние (НЕ сохраняется между перезагрузками)
WS.state = {
  screen: null,        // текущий экран
  role: null,          // текущая роль
  onMessage: null,     // обработчик сообщений текущего экрана (сбрасывается при навигации)
  lastDisplay: null,   // последнее отображаемое (block/text/media) — для трансляции при переключении
};
