const CACHE_NAME = "sun-safety-tracker-v2";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json"
];

let reminderInterval = null;
let savedLocation = null;

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
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  if (
    url.hostname.includes("api.open-meteo.com") ||
    url.hostname.includes("nominatim.openstreetmap.org")
  ) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            error: "Live data is currently unavailable."
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
        }
        return networkResponse;
      });
    })
  );
});

/* --------------------------------
   BACKGROUND UV & NOTIFICATIONS
-------------------------------- */

// 1. Send welcome notification
function sendWelcomeNotification() {
  self.registration.showNotification("UV notifications are on", {
    body: "We'll remind you every 2 hrs when the UV is 3 or higher.",
    icon: "sun-icon-192.png",
    badge: "sun-icon-192.png"
  });
}

// 2. Fetch live UV data & send sunscreen reminder if UV >= 3
async function checkAndSendUVReminder(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=uv_index&forecast_days=1&timezone=auto`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.hourly?.uv_index) return;

    const now = Date.now();
    let closestIndex = 0;
    let smallestDifference = Infinity;

    data.hourly.time.forEach((time, index) => {
      const difference = Math.abs(new Date(time).getTime() - now);
      if (difference < smallestDifference) {
        smallestDifference = difference;
        closestIndex = index;
      }
    });

    const currentUV = Number(data.hourly.uv_index[closestIndex]);

    if (currentUV >= 3) {
      self.registration.showNotification("Sunscreen Reminder", {
        body: `It's been 2 hrs — UV is ${currentUV.toFixed(1)}. Please reapply sunscreen.`,
        icon: "sun-icon-192.png",
        badge: "sun-icon-192.png"
      });
    }
  } catch (err) {
    console.error("Failed to check background UV:", err);
  }
}

// Message Listener from Script.js
self.addEventListener("message", (event) => {
  if (event.data) {
    if (event.data.action === "START_REMINDERS") {
      savedLocation = {
        latitude: event.data.latitude,
        longitude: event.data.longitude
      };

      // Send initial welcome notification
      sendWelcomeNotification();

      if (reminderInterval) clearInterval(reminderInterval);

      // Schedule 2-hour interval (7,200,000 ms)
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      reminderInterval = setInterval(() => {
        if (savedLocation) {
          checkAndSendUVReminder(savedLocation.latitude, savedLocation.longitude);
        }
      }, TWO_HOURS);
    }

    if (event.data.action === "UPDATE_LOCATION") {
      savedLocation = {
        latitude: event.data.latitude,
        longitude: event.data.longitude
      };
    }

    if (event.data.action === "STOP_REMINDERS") {
      if (reminderInterval) clearInterval(reminderInterval);
      savedLocation = null;
    }
  }
});

// Periodic Sync for Native OS Background Triggers
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "check-uv-reminder" && savedLocation) {
    event.waitUntil(
      checkAndSendUVReminder(savedLocation.latitude, savedLocation.longitude)
    );
  }
});
