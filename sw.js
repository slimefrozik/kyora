const CACHE_NAME = "kyora-static-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./start.html",
  "./mods.html",
  "./updates.html",
  "./challenges.html",
  "./rules.html",
  "./plugins.html",
  "./jobs.html",
  "./assets/styles.css",
  "./assets/app.js",
  "./assets/favicon.svg",
  "./data/image2.png",
  "./data/image3.png",
  "./data/image4.png",
  "./data/image5.png",
  "./data/screen1.jpg",
  "./data/i18n.json",
  "./data/content.js",
  "./data/telegram-config.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
