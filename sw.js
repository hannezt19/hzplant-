/*
  Service Worker Hz-Plant
  ------------------------
  PENTING: Data aplikasi (pekerja, blok, herbisida, catatan) disimpan di
  localStorage, BUKAN di cache ini. Jadi setiap kali versi cache di bawah
  di-bump, browser hanya mengganti file aplikasi (HTML/CSS/JS/ikon) yang
  lama dengan yang baru — data yang sudah diisi pengguna tidak tersentuh
  dan tetap aman.

  CARA UPDATE APLIKASI:
  Setiap kali Anda mengubah index.html / manifest.json / ikon dan ingin
  pengguna menerima versi terbaru, naikkan angka di CACHE_VERSION di
  bawah ini (misalnya 'v1' -> 'v2'). Service worker akan otomatis
  mendeteksi file sw.js berubah, menyiapkan cache baru, lalu menawarkan
  banner "Update tersedia" ke pengguna di index.html.
*/
const CACHE_VERSION = 'v13';
const CACHE_NAME = `hzplant-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// INSTALL: siapkan cache baru berisi app shell versi terbaru.
// Tidak langsung skipWaiting -> service worker baru akan "menunggu"
// sampai pengguna menekan tombol Update di banner.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

// ACTIVATE: hapus cache versi lama (file aplikasi lama), TIDAK menyentuh
// localStorage sama sekali sehingga data pengguna tetap utuh.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH:
// - Untuk halaman (navigasi HTML): coba jaringan dulu supaya selalu dapat
//   versi terbaru saat online; kalau offline, pakai cache.
// - Untuk aset lain (manifest, ikon, dll): cache dulu (cepat & hemat
//   kuota), baru ke jaringan kalau belum ada di cache.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isNavigation = req.mode === 'navigate' || req.destination === 'document';

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});

// Terima perintah dari halaman untuk langsung aktifkan versi baru
// (dipicu saat pengguna menekan tombol "Update" di banner).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
