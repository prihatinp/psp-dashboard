// Service worker: simpan tampilan aplikasi supaya cepat dibuka & tetap jalan saat sinyal hilang.
// Data dari Google Sheet TIDAK di-cache di sini (disimpan oleh app.js sebagai "data terakhir").
const VERSION = 'psp-dash-v5';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'config.js', 'manifest.webmanifest', 'data/seed.json', 'img/icon-192.png', 'img/logo-musashi.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // API Apps Script & foto: langsung ke internet
  // network-first: selalu ambil versi terbaru (hasil push), pakai cache kalau offline
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
