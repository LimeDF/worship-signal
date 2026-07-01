/* ============================================================
   service-worker.js — v6. БЕЗ КЭША.
   Раньше кэш «застревал» и держал старую версию кода — из-за этого
   исправления не доходили до устройств. Теперь ничего не кэшируем:
   всё грузится из сети (приложению всё равно нужен интернет),
   а все прежние кэши удаляются. Установка на телефон при этом работает.
   ============================================================ */
self.addEventListener('install', function(){ self.skipWaiting(); });

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys()
      .then(function(keys){ return Promise.all(keys.map(function(k){ return caches.delete(k); })); })
      .then(function(){ return self.clients.claim(); })
  );
});

// пустой обработчик fetch = всё идёт напрямую в сеть, ничего не кэшируется
self.addEventListener('fetch', function(e){ /* network only */ });
