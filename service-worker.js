/* ============================================================
   service-worker.js — офлайн-кэш приложения.
   Статика (код, стили, иконки) — cache-first (работает офлайн).
   Данные (data/*.json) — network-first (всегда свежие, офлайн — из кэша).
   Внешние API (ntfy, github, google) — network-only (не кэшируем).
   Версию кэша меняем при обновлении приложения, чтобы сбросить старое.
   ============================================================ */
const CACHE = 'worship-signal-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './core/theme.css',
  './core/store.js',
  './core/i18n.js',
  './core/auth.js',
  './core/data.js',
  './core/sync.js',
  './core/presence.js',
  './core/projector.js',
  './core/log.js',
  './core/ui.js',
  './core/app.js',
  './modules/chat.js',
  './modules/pin.js',
  './modules/role.js',
  './modules/settings.js',
  './modules/admin.js',
  './modules/hymns.js',
  './modules/stage.js',
  './modules/chair.js',
  './modules/operator.js',
  './modules/programs.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if(req.method !== 'GET'){ return; }
  const url = new URL(req.url);

  // внешние сервисы — не трогаем (только сеть)
  if(/ntfy\.sh|api\.github\.com|raw\.githubusercontent\.com|googleapis\.com|google\.com|gstatic\.com/.test(url.host)){
    return;
  }

  // данные приложения — сначала сеть, при офлайне из кэша
  if(url.pathname.indexOf('/data/') !== -1){
    e.respondWith(
      fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req))
    );
    return;
  }

  // статика — сначала кэш, потом сеть
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => cached))
  );
});
