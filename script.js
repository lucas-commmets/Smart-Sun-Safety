const locations = {
  sydney: { name: "Sydney", state: "NSW", latitude: -33.8688, longitude: 151.2093 },
  melbourne: { name: "Melbourne", state: "VIC", latitude: -37.8136, longitude: 144.9631 },
  brisbane: { name: "Brisbane", state: "QLD", latitude: -27.4698, longitude: 153.0251 },
  perth: { name: "Perth", state: "WA", latitude: -31.9505, longitude: 115.8605 },
  adelaide: { name: "Adelaide", state: "SA", latitude: -34.9285, longitude: 138.6007 },
  canberra: { name: "Canberra", state: "ACT", latitude: -35.2809, longitude: 149.1300 },
  hobart: { name: "Hobart", state: "TAS", latitude: -42.8821, longitude: 147.3272 },
  darwin: { name: "Darwin", state: "NT", latitude: -12.4634, longitude: 130.8456 },
  newcastle: { name: "Newcastle", state: "NSW", latitude: -32.9283, longitude: 151.7817 },
  wollongong: { name: "Wollongong", state: "NSW", latitude: -34.4278, longitude: 150.8931 },
  geelong: { name: "Geelong", state: "VIC", latitude: -38.1499, longitude: 144.3617 },
  "gold-coast": { name: "Gold Coast", state: "QLD", latitude: -28.0167, longitude: 153.4000 },
  "sunshine-coast": { name: "Sunshine Coast", state: "QLD", latitude: -26.6500, longitude: 153.0667 }
};

let latitude = null;
let longitude = null;
let currentUV = null;
let remindersEnabled = false;
let autoUpdateTimer = null;

const $ = id => document.getElementById(id);

/* -----------------------------
   UV API
----------------------------- */

async function getUV(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}` +
    `&longitude=${lon}` +
    `&hourly=uv_index` +
    `&forecast_days=1` +
    `&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("UV service unavailable");

  const data = await response.json();
  if (!data.hourly?.uv_index) throw new Error("UV data unavailable");

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

  return data.hourly.uv_index[closestIndex];
}

/* -----------------------------
   DISPLAY UV
----------------------------- */

function displayUV(uv) {
  currentUV = Number(uv);
  $("uvNumber").textContent = currentUV.toFixed(1);

  const percentage = Math.min(Math.max((currentUV / 12) * 100, 0), 100);
  $("uvGauge").style.width = `${percentage}%`;

  let level;
  let advice;
  const uvLevelEl = $("uvLevel");

  if (currentUV < 3) {
    level = "Low";
    advice = "Enjoy the outdoors and keep your usual sun-safety habits.";
    uvLevelEl.style.backgroundColor = "#d4edda"; // Light Green
    uvLevelEl.style.color = "#155724";           // Dark Green Text
  } else if (currentUV < 6) {
    level = "Moderate";
    advice = "Protection is recommended. Slip, slop, slap, seek and slide.";
    uvLevelEl.style.backgroundColor = "#fff3cd"; // Light Yellow
    uvLevelEl.style.color = "#856404";           // Dark Yellow/Black Text
  } else if (currentUV < 8) {
    level = "High";
    advice = "Sun protection is important. Reduce direct sun exposure where possible.";
    uvLevelEl.style.backgroundColor = "#f8d7da"; // Light Red
    uvLevelEl.style.color = "#721c24";           // Dark Red Text
  } else if (currentUV < 11) {
    level = "Very High";
    advice = "Extra protection is needed. Seek shade and avoid prolonged direct sun.";
    uvLevelEl.style.backgroundColor = "#e1bee7"; // Light Purple
    uvLevelEl.style.color = "#4a148c";           // Dark Purple Text
  } else {
    level = "Extreme";
    advice = "Minimise direct sun exposure and take extra care.";
    uvLevelEl.style.backgroundColor = "#d1c4e9"; // Deep Purple
    uvLevelEl.style.color = "#311b92";           // Dark Purple Text
  }

  uvLevelEl.textContent = level;
  $("uvAdvice").textContent = advice;

  if (currentUV >= 0) {
    $("protectionAlert").classList.remove("inactive");
  } else {
    $("protectionAlert").classList.add("inactive");
  }

  $("updated").textContent = `Updated ${new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

/* -----------------------------
   LOAD MANUAL LOCATION
----------------------------- */

async function loadManualLocation() {
  const selected = $("locationSelect").value;
  if (!selected) {
    alert("Please choose a location first.");
    return;
  }

  const location = locations[selected];
  if (!location) return;

  $("locationName").textContent = `${location.name}, ${location.state}`;
  $("locationMessage").textContent = "Getting the latest UV level...";
  $("manualButton").disabled = true;

  try {
    const uv = await getUV(location.latitude, location.longitude);
    latitude = location.latitude;
    longitude = location.longitude;

    displayUV(uv);
    $("locationMessage").textContent = "Live UV data is being monitored for this location.";
    $("locationSuccess").classList.add("show");
    startAutoUpdate();

    if (remindersEnabled && "serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        registration.active.postMessage({
          action: "UPDATE_LOCATION",
          latitude: latitude,
          longitude: longitude
        });
      }
    }
  } catch (error) {
    console.error(error);
    $("locationMessage").textContent =
      "The UV service could not be reached. Your school network may be blocking it.";
  }

  $("manualButton").disabled = false;
}

/* -----------------------------
   DEVICE LOCATION
----------------------------- */

function useMyLocation() {
  if (!navigator.geolocation) {
    alert("Location isn't supported. Please choose a location manually.");
    return;
  }

  $("locationButton").disabled = true;
  $("locationButton").textContent = "📡 Finding location...";

  navigator.geolocation.getCurrentPosition(
    async position => {
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;

      $("locationName").textContent = "Your current location";

      try {
        const uv = await getUV(latitude, longitude);
        displayUV(uv);
        $("locationMessage").textContent =
          "Live UV data is being monitored for your current location.";
        startAutoUpdate();

        if (remindersEnabled && "serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          if (registration.active) {
            registration.active.postMessage({
              action: "UPDATE_LOCATION",
              latitude: latitude,
              longitude: longitude
            });
          }
        }
      } catch (error) {
        $("locationMessage").textContent =
          "Your location was found, but the UV service couldn't be reached.";
      }

      $("locationButton").disabled = false;
      $("locationButton").textContent = "🔄 Refresh My Location & UV";
    },
    () => {
      $("locationButton").disabled = false;
      $("locationButton").textContent = "📍 Use My Location";
      alert("Location access was unavailable. Choose a location manually instead.");
    }
  );
}

/* -----------------------------
   AUTOMATIC UV UPDATES
----------------------------- */

function startAutoUpdate() {
  clearInterval(autoUpdateTimer);
  autoUpdateTimer = setInterval(refreshUV, 15 * 60 * 1000);
}

async function refreshUV() {
  if (latitude === null || longitude === null) return;
  try {
    const uv = await getUV(latitude, longitude);
    displayUV(uv);
  } catch (error) {
    console.log("Automatic update unavailable.");
  }
}

/* -----------------------------
   NOTIFICATIONS & REMINDERS
----------------------------- */

async function requestNotifications() {
  if (!("Notification" in window)) {
    alert("Notifications aren't supported by this browser.");
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

async function registerPeriodicSync() {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if ("periodicSync" in registration) {
      try {
        await registration.periodicSync.register("check-uv-reminder", {
          minInterval: 10000
        });
      } catch (error) {
        console.log("Periodic Sync registration skipped:", error);
      }
    }
  }
}

async function toggleReminders() {
  if (!remindersEnabled) {
    if (latitude === null || longitude === null) {
      alert("Please choose a location first.");
      return;
    }

    const allowed = await requestNotifications();
    if (!allowed) {
      alert("Please allow notifications in your browser to use reminders.");
      return;
    }

    remindersEnabled = true;

    $("reminderToggle").classList.add("on");
    $("reminderToggle").setAttribute("aria-pressed", "true");
    $("reminderStatus").textContent = "On — every 2 hours";

    await registerPeriodicSync();

    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        registration.active.postMessage({
          action: "START_REMINDERS",
          latitude: latitude,
          longitude: longitude
        });
      }
    }
  } else {
    remindersEnabled = false;

    $("reminderToggle").classList.remove("on");
    $("reminderToggle").setAttribute("aria-pressed", "false");
    $("reminderStatus").textContent = "Currently off";

    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        registration.active.postMessage({
          action: "STOP_REMINDERS"
        });
      }
    }
  }
}

/* -----------------------------
   BUTTON LISTENERS
----------------------------- */

$("locationButton").addEventListener("click", useMyLocation);
$("manualButton").addEventListener("click", loadManualLocation);
$("reminderToggle").addEventListener("click", toggleReminders);

/* -----------------------------
   FOOTER YEAR
----------------------------- */

if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}
