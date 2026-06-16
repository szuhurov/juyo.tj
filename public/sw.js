// juyo.tj service worker
const CACHE_NAME = "juyo-v9";
const OFFLINE_URL = "/offline.html";
const STATIC_ASSETS = [
  "/offline.html",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
  "/flags/flag-tj.jpg",
  "/flags/flag-ru.webp",
  "/flags/flag-en.jpg",
];

const OFFLINE_FALLBACK = `<!DOCTYPE html>
<html lang="tg">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>juyo — Offline</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;background:#fff}
body{font-family:sans-serif;background:#fff;color:#09090b;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}
h1{font-size:20px;margin-bottom:12px;color:#09090b}
p{color:#71717a;font-size:14px;margin-bottom:24px}
button{background:#09090b;color:#fff;border:none;padding:13px 32px;border-radius:10px;font-size:15px;cursor:pointer;font-weight:600}
</style>
</head>
<body>
<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:20px">
<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="#ef4444"/>
</svg>
<h1>Интернет нест</h1>
<p>Интернетро санҷед ва дубора кӯшиш кунед.</p>
<button onclick="location.reload()">Дубора кӯшиш</button>
</body>
</html>`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          Promise.race([
            cache.add(url),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("cache-add timeout")), 5000)
            ),
          ])
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function offlineResponse() {
  return caches.match(OFFLINE_URL).then((cached) => {
    if (cached) return cached;
    return new Response(OFFLINE_FALLBACK, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request.clone())
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => offlineResponse())
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request.clone())
        .then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => offlineResponse());
    })
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "juyo-sync") event.waitUntil(Promise.resolve());
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "juyo", body: "Хабари нав" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "juyo-periodic") event.waitUntil(Promise.resolve());
});
