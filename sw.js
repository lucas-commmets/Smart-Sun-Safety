const CACHE_NAME = "sun-safety-tracker-v1";

const APP_ROOT = "/Smart-Sun-Safety/";

const APP_SHELL = [
  APP_ROOT,
  APP_ROOT + "index.html",
  APP_ROOT + "style.css",
  APP_ROOT + "script.js",
  APP_ROOT + "manifest.json",
  APP_ROOT + "favicon.png",
  APP_ROOT + "icon-192.png",
  APP_ROOT + "icon-512.png"
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

  /*
  Only handle normal GET requests.
  */

  if (request.method !== "GET") {
    return;
  }


  /*
  API requests such as Open-Meteo should
  always try the network first.

  We don't want yesterday's UV data being
  shown as if it were current.
  */

  if (
    request.url.includes(
      "api.open-meteo.com"
    )
  ) {

    event.respondWith(

      fetch(request)

        .catch(() => {

          return new Response(
            JSON.stringify({
              error: "offline"
            }),
            {
              status: 503,
              headers: {
                "Content-Type":
                  "application/json"
              }
            }
          );

        })

    );

    return;
  }


  /*
  App files use cache-first.

  This allows the PWA to open even when
  the device is temporarily offline.
  */

  event.respondWith(

    caches.match(request)
      .then((cachedResponse) => {

        if (cachedResponse) {

          return cachedResponse;

        }


        return fetch(request)
          .then((networkResponse) => {

            /*
            Only cache successful responses.
            */

            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === "basic"
            ) {

              const responseClone =
                networkResponse.clone();


              caches.open(CACHE_NAME)
                .then((cache) => {

                  cache.put(
                    request,
                    responseClone
                  );

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

/*
This allows your PWA to receive a push
notification from a push server.

It does NOT create the 2-hour schedule
by itself.

A push server is required to actually
send scheduled notifications.
*/

self.addEventListener("push", (event) => {

  let data = {};

  try {

    if (event.data) {

      data =
        event.data.json();

    }

  }

  catch (error) {

    data = {
      title:
        "Sun Safety Reminder ☀️",

      body:
        event.data
          ? event.data.text()
          : "Remember your sun protection."
    };

  }


  const title =
    data.title ||
    "Sun Safety Reminder ☀️";


  const options = {

    body:
      data.body ||
      "Remember to check the UV and reapply sunscreen.",

    icon:
      "/Smart-Sun-Safety/icon-192.png",

    badge:
      "/Smart-Sun-Safety/icon-192.png",

    tag:
      data.tag ||
      "sun-safety-reminder",

    renotify:
      true,

    data: {
      url:
        data.url ||
        "/Smart-Sun-Safety/"
    }

  };


  event.waitUntil(

    self.registration.showNotification(
      title,
      options
    )

  );

});


/* -----------------------------------------
NOTIFICATION CLICK
----------------------------------------- */

self.addEventListener(
  "notificationclick",
  (event) => {

    event.notification.close();


    const destination =
      event.notification.data?.url ||
      "/Smart-Sun-Safety/";


    event.waitUntil(

      clients.matchAll({
        type: "window",
        includeUncontrolled: true
      })

      .then((clientList) => {

        /*
        If the PWA is already open,
        focus it instead of opening
        another copy.
        */

        for (
          const client of clientList
        ) {

          if (
            "focus" in client
          ) {

            return client.focus();

          }

        }


        /*
        Otherwise open the PWA.
        */

        if (
          clients.openWindow
        ) {

          return clients.openWindow(
            destination
          );

        }

      })

    );

  }
);
