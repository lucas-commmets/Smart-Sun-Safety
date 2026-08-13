const CACHE_NAME = "sun-safety-tracker-v2";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./sun-favicon.ico",
  "./sun-icon-192.png",
  "./sun-icon-512.jpg"
];


/* --------------------------------
   INSTALL
-------------------------------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_FILES);
    })
  );
  self.skipWaiting();
});


/* --------------------------------
   ACTIVATE
-------------------------------- */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});


/* --------------------------------
   FETCH
-------------------------------- */

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== "basic"
          ) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});


/* --------------------------------
   PUSH NOTIFICATIONS
-------------------------------- */

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      title: "Sun Safety Reminder ☀️",
      body: "It's time to check the UV level."
    };
  }

  const title = data.title || "Sun Safety Reminder ☀️";

  const options = {
    body: data.body || "It's time to check the UV level.",
    icon: "./sun-icon-192.png",
    badge: "./sun-icon-192.png",
    tag: data.tag || "sun-safety-reminder",
    renotify: true,
    data: {
      url: data.url || "./"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});


/* --------------------------------
   NOTIFICATION CLICK
-------------------------------- */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "./";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
