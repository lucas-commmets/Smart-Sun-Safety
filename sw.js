const CACHE_NAME = "sun-safety-tracker-v2"; // Bumped version to force fresh cache

const APP_ROOT = "/Smart-Sun-Safety/";

const APP_SHELL = [
  APP_ROOT,
  APP_ROOT + "index.html",
  APP_ROOT + "style.css",
  APP_ROOT + "script.js",
  APP_ROOT + "manifest.json",
  APP_ROOT + "sun-favicon.ico",
  APP_ROOT + "sun-icon-192.png",
  APP_ROOT + "sun-icon-512.png"
];


/* -----------------------------------------
INSTALL
----------------------------------------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(APP_SHELL);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});


/* -----------------------------------------
ACTIVATE
----------------------------------------- */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return (
                name !== CACHE_NAME &&
                name.startsWith("sun-safety-tracker-")
              );
            })
            .map((name) => {
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});


/* -----------------------------------------
FETCH
----------------------------------------- */

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  // API requests (network first)
  if (request.url.includes("api.open-meteo.com")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: "offline" }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" }
          }
        );
      })
    );
    return;
  }

  // App files (cache first)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === "basic"
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});


/* -----------------------------------------
PUSH NOTIFICATIONS
----------------------------------------- */

self.addEventListener("push", (event) => {
  let data = {};

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (error) {
    data = {
      title: "Sun Safety Reminder ☀️",
      body: event.data ? event.data.text() : "Remember your sun protection."
    };
  }

  const title = data.title || "Sun Safety Reminder ☀️";

  const options = {
    body: data.body || "Remember to check the UV and reapply sunscreen.",
    icon: APP_ROOT + "sun-icon-192.png",
    badge: APP_ROOT + "sun-icon-192.png",
    tag: data.tag || "sun-safety-reminder",
    renotify: true,
    data: {
      url: data.url || APP_ROOT
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});


/* -----------------------------------------
NOTIFICATION CLICK
----------------------------------------- */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const destination = event.notification.data?.url || APP_ROOT;

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(destination);
      }
    })
  );
});
