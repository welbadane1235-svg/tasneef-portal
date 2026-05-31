/* Tasneef V251 Service Worker - cache app shell for weak internet */
const CACHE_NAME = 'tasneef-v251-lite-cache';
const APP_SHELL = [
  './',
  './index.html',
  './admin.html',
  './supervisor.html',
  './technician.html',
  './client-report.html',
  './style.css',
  './app.js?v=250',
  './tasneef_logo_print.png',
  './tasneef_stamp.jpeg',
  './sounds/checkin.wav',
  './sounds/checkout.wav',
  './sounds/ticket.wav'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(()=>null)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if(req.method !== 'GET') return;
  // Do not cache Supabase writes/API here; app.js handles GET fallback safely.
  if(/supabase\.co/i.test(url.hostname)) return;
  const isAppFile = /\/(index|admin|supervisor|technician|client-report)\.html$/i.test(url.pathname) || /\/(app\.js|style\.css|tasneef_logo_print\.png|tasneef_stamp\.jpeg)$/i.test(url.pathname) || /\/sounds\//i.test(url.pathname);
  if(!isAppFile) return;
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if(res && res.ok) caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone())).catch(()=>{});
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
