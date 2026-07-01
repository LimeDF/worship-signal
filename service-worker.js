/* ============================================================
   service-worker.js — v4. НАДЁЖНОЕ обновление.
   Код и данные — network-first: онлайн ВСЕГДА берём свежую версию,
   кэш только как запас для офлайна. Это чинит «застрял старый код».
   Установка не может сломаться (не пытаемся закэшировать всё разом).
   Внешние сервисы (ntfy/github/google) — только сеть, не трогаем.
   ============================================================ */
const CACHE = 'worship-signal-v5';

// при установке — сразу берём управление, без «всё или ничего»
self.addEventListener('install', function(e){ self.skipWaiting(); });

// при активации — удаляем ВСЕ прежние кэши (сбрасываем старый застрявший код)
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){ return Promise.all(keys.map(function(k){ return caches.delete(k); })); })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);

  // внешние сервисы — не вмешиваемся (реальное время, API)
  if(/ntfy\.sh|api\.github\.com|raw\.githubusercontent\.com|googleapis\.com|google\.com|gstatic\.com/.test(url.host)) return;

  // всё своё (код, стили, данные, иконки) — СНАЧАЛА СЕТЬ, кэш только запас
  e.respondWith(
    fetch(req).then(function(res){
      try { var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(req, copy); }); } catch(err){}
      return res;
    }).catch(function(){ return caches.match(req); })
  );
});
