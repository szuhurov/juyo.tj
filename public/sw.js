// juyo.tj service worker
const CACHE_NAME = "juyo-v6";
const OFFLINE_URL = "/offline.html";
const STATIC_ASSETS = [
  "/offline.html",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
];

const OFFLINE_FALLBACK = `<!DOCTYPE html>
<html lang="tg">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>juyo — Offline</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:sans-serif;background:#09090b;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}
h1{font-size:20px;margin-bottom:12px}
p{color:#a1a1aa;font-size:14px;margin-bottom:24px}
button{background:#fff;color:#09090b;border:none;padding:12px 28px;border-radius:8px;font-size:15px;cursor:pointer;font-weight:600}
</style>
</head>
<body>
<h1>Пайвастшавӣ нест / Нет связи / Offline</h1>
<p>Интернетро санҷед / Проверьте интернет / Check your connection</p>
<button onclick="location.reload()">Retry / Повторить</button>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
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

function networkWithTimeout(request, ms = 500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(request.clone()).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

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
      networkWithTimeout(event.request, 500)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
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
      return networkWithTimeout(event.request, 500)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
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
