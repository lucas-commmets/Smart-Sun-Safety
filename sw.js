const CACHE_NAME = "sun-safety-tracker-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json"
];


/* --------------------------------
   INSTALL
-------------------------------- */

self.addEventListener("install", (event) => {

  event.waitUntil(

    caches.open(CACHE_NAME)
      .then((cache) => {

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

    caches.keys()
      .then((cacheNames) => {

        return Promise.all(

          cacheNames
            .filter(
              (name) =>
                name !== CACHE_NAME
            )
            .map(
              (name) =>
                caches.delete(name)
            )

        );

      })

  );

  self.clients.claim();

});


/* --------------------------------
   FETCH
-------------------------------- */

self.addEventListener("fetch", (event) => {

  /*
    Only handle GET requests.
  */

  if (event.request.method !== "GET") {
    return;
  }


  /*
    API requests should go
    directly to the network.

    This prevents old UV data
    from being accidentally cached.
  */

  const url =
    new URL(event.request.url);


  if (
    url.hostname.includes(
      "api.open-meteo.com"
    ) ||
    url.hostname.includes(
      "nominatim.openstreetmap.org"
    )
  ) {

    event.respondWith(

      fetch(event.request)
        .catch(() => {

          return new Response(
            JSON.stringify({
              error:
                "Live data is currently unavailable."
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
    Normal website files:
    Cache first, then network.
  */

  event.respondWith(

    caches.match(event.request)
      .then((cachedResponse) => {

        if (cachedResponse) {
          return cachedResponse;
        }


        return fetch(event.request)
          .then((networkResponse) => {

            /*
              Save successful responses
              for future offline use.
            */

            if (
              networkResponse &&
              networkResponse.status === 200
            ) {

              const copy =
                networkResponse.clone();


              caches.open(CACHE_NAME)
                .then((cache) => {

                  cache.put(
                    event.request,
                    copy
                  );

                });

            }


            return networkResponse;

          });

      })

  );

});