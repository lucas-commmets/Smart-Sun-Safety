const PUBLIC_VAPID_KEY =
  "BNZIrVXtlz6_k9P8X-556u0G-Wk24saoVR0pOG93QTI3gsu-RMbFcgmjxdrdeii2pJ3hsyLTeXoXT53JvBTfCjA";


/* =========================================================
   LOCATIONS
========================================================= */

const locations = {

  sydney: {
    name: "Sydney",
    state: "NSW",
    latitude: -33.8688,
    longitude: 151.2093
  },

  melbourne: {
    name: "Melbourne",
    state: "VIC",
    latitude: -37.8136,
    longitude: 144.9631
  },

  brisbane: {
    name: "Brisbane",
    state: "QLD",
    latitude: -27.4698,
    longitude: 153.0251
  },

  perth: {
    name: "Perth",
    state: "WA",
    latitude: -31.9505,
    longitude: 115.8605
  },

  adelaide: {
    name: "Adelaide",
    state: "SA",
    latitude: -34.9285,
    longitude: 138.6007
  },

  canberra: {
    name: "Canberra",
    state: "ACT",
    latitude: -35.2809,
    longitude: 149.1300
  },

  hobart: {
    name: "Hobart",
    state: "TAS",
    latitude: -42.8821,
    longitude: 147.3272
  },

  darwin: {
    name: "Darwin",
    state: "NT",
    latitude: -12.4634,
    longitude: 130.8456
  },

  newcastle: {
    name: "Newcastle",
    state: "NSW",
    latitude: -32.9283,
    longitude: 151.7817
  },

  wollongong: {
    name: "Wollongong",
    state: "NSW",
    latitude: -34.4278,
    longitude: 150.8931
  },

  geelong: {
    name: "Geelong",
    state: "VIC",
    latitude: -38.1499,
    longitude: 144.3617
  },

  "gold-coast": {
    name: "Gold Coast",
    state: "QLD",
    latitude: -28.0167,
    longitude: 153.4000
  },

  "sunshine-coast": {
    name: "Sunshine Coast",
    state: "QLD",
    latitude: -26.6500,
    longitude: 153.0667
  },

  "central-coast": {
    name: "Central Coast",
    state: "NSW",
    latitude: -33.3000,
    longitude: 151.2500
  }

};


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let latitude = null;
let longitude = null;

let currentUV = null;

let remindersEnabled = false;

let reminderTimer = null;

let autoUpdateTimer = null;


/* =========================================================
   DOM HELPER
========================================================= */

const $ = (id) =>
  document.getElementById(id);


/* =========================================================
   UV API
========================================================= */

async function getUV(lat, lon) {

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}` +
    `&longitude=${lon}` +
    `&hourly=uv_index` +
    `&forecast_days=1` +
    `&timezone=auto`;

  const response =
    await fetch(url);

  if (!response.ok) {

    throw new Error(
      "UV service unavailable"
    );

  }

  const data =
    await response.json();

  if (
    !data.hourly ||
    !data.hourly.uv_index
  ) {

    throw new Error(
      "UV data unavailable"
    );

  }

  const now =
    Date.now();

  let closestIndex = 0;

  let smallestDifference =
    Infinity;


  data.hourly.time.forEach(
    (time, index) => {

      const difference =
        Math.abs(
          new Date(time).getTime() -
          now
        );

      if (
        difference <
        smallestDifference
      ) {

        smallestDifference =
          difference;

        closestIndex =
          index;

      }

    }
  );


  return data.hourly.uv_index[
    closestIndex
  ];

}


/* =========================================================
   DISPLAY UV
========================================================= */

function displayUV(uv) {

  currentUV =
    Number(uv);


  $("uvNumber").textContent =
    currentUV.toFixed(1);


  const percentage =
    Math.min(
      Math.max(
        currentUV / 12 * 100,
        0
      ),
      100
    );


  $("uvGauge").style.width =
    `${percentage}%`;


  let level;

  let advice;


  if (currentUV < 3) {

    level = "Low";

    advice =
      "Enjoy the outdoors and keep your usual sun-safety habits.";

  }

  else if (currentUV < 6) {

    level = "Moderate";

    advice =
      "Protection is recommended. Slip, slop, slap, seek and slide.";

  }

  else if (currentUV < 8) {

    level = "High";

    advice =
      "Sun protection is important. Reduce direct sun exposure where possible.";

  }

  else if (currentUV < 11) {

    level = "Very High";

    advice =
      "Extra protection is needed. Seek shade and avoid prolonged direct sun.";

  }

  else {

    level = "Extreme";

    advice =
      "Minimise direct sun exposure and take extra care.";

  }


  $("uvLevel").textContent =
    level;

  $("uvAdvice").textContent =
    advice;


  if (currentUV >= 3) {

    $("protectionAlert")
      .classList.remove(
        "inactive"
      );

  }

  else {

    $("protectionAlert")
      .classList.add(
        "inactive"
      );

  }


  $("updated").textContent =
    `Updated ${new Date().toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    )}`;

}


/* =========================================================
   MANUAL LOCATION
========================================================= */

async function loadManualLocation() {

  const selected =
    $("locationSelect").value;


  if (!selected) {

    alert(
      "Please choose a location first."
    );

    return;

  }


  const location =
    locations[selected];


  if (!location) {

    alert(
      "That location is unavailable."
    );

    return;

  }


  $("locationName").textContent =
    `${location.name}, ${location.state}`;


  $("locationMessage").textContent =
    "Getting the latest UV level...";


  $("manualButton").disabled =
    true;


  try {

    const uv =
      await getUV(
        location.latitude,
        location.longitude
      );


    latitude =
      location.latitude;

    longitude =
      location.longitude;


    displayUV(uv);


    $("locationMessage").textContent =
      "Live UV data is being monitored for this location.";


    $("locationSuccess")
      .classList.add(
        "show"
      );


    startAutoUpdate();


  }

  catch (error) {

    console.error(
      "Manual location error:",
      error
    );


    $("locationMessage").textContent =
      "The UV service could not be reached.";

  }


  $("manualButton").disabled =
    false;

}


/* =========================================================
   DEVICE LOCATION
========================================================= */

function useMyLocation() {

  if (
    !navigator.geolocation
  ) {

    alert(
      "Location isn't supported. Please choose a location manually."
    );

    return;

  }


  $("locationButton").disabled =
    true;


  $("locationButton").textContent =
    "📡 Finding location...";


  navigator.geolocation.getCurrentPosition(

    async (position) => {

      latitude =
        position.coords.latitude;

      longitude =
        position.coords.longitude;


      $("locationName").textContent =
        "Your current location";


      $("locationMessage").textContent =
        "Getting the latest UV level...";


      try {

        const uv =
          await getUV(
            latitude,
            longitude
          );


        displayUV(uv);


        $("locationMessage").textContent =
          "Live UV data is being monitored for your current location.";


        startAutoUpdate();

      }

      catch (error) {

        console.error(
          "Location UV error:",
          error
        );


        $("locationMessage").textContent =
          "Your location was found, but the UV service couldn't be reached.";

      }


      $("locationButton").disabled =
        false;


      $("locationButton").textContent =
        "🔄 Refresh My Location & UV";

    },


    () => {

      $("locationButton").disabled =
        false;


      $("locationButton").textContent =
        "📍 Use My Location";


      alert(
        "Location access was unavailable. Choose a location manually instead."
      );

    }

  );

}


/* =========================================================
   AUTOMATIC UV UPDATES
========================================================= */

function startAutoUpdate() {

  clearInterval(
    autoUpdateTimer
  );


  autoUpdateTimer =
    setInterval(
      refreshUV,
      15 * 60 * 1000
    );

}


async function refreshUV() {

  if (
    latitude === null ||
    longitude === null
  ) {

    return;

  }


  try {

    const uv =
      await getUV(
        latitude,
        longitude
      );


    displayUV(uv);

  }

  catch (error) {

    console.log(
      "Automatic UV update unavailable.",
      error
    );

  }

}


/* =========================================================
   NOTIFICATION PERMISSION
========================================================= */

async function requestNotifications() {

  if (
    !("Notification" in window)
  ) {

    alert(
      "Notifications aren't supported by this browser."
    );

    return false;

  }


  if (
    Notification.permission ===
    "granted"
  ) {

    return true;

  }


  if (
    Notification.permission ===
    "denied"
  ) {

    alert(
      "Notifications are blocked. Please allow notifications for this site in your browser settings."
    );

    return false;

  }


  const permission =
    await Notification.requestPermission();


  return (
    permission === "granted"
  );

}


/* =========================================================
   VAPID KEY CONVERSION
========================================================= */

function urlBase64ToUint8Array(
  base64String
) {

  const padding =
    "=".repeat(
      (4 -
        base64String.length % 4) %
        4
    );


  const base64 =
    (
      base64String +
      padding
    )
      .replace(
        /-/g,
        "+"
      )
      .replace(
        /_/g,
        "/"
      );


  const rawData =
    window.atob(base64);


  return Uint8Array.from(
    [...rawData].map(
      (character) =>
        character.charCodeAt(0)
    )
  );

}


/* =========================================================
   CREATE PUSH SUBSCRIPTION
========================================================= */

async function subscribeToPush() {

  if (
    !("serviceWorker" in navigator)
  ) {

    throw new Error(
      "Service workers are not supported."
    );

  }


  if (
    !("PushManager" in window)
  ) {

    throw new Error(
      "Push notifications are not supported."
    );

  }


  const registration =
    await navigator.serviceWorker.ready;


  let subscription =
    await registration.pushManager
      .getSubscription();


  if (!subscription) {

    console.log(
      "Creating new push subscription..."
    );


    subscription =
      await registration.pushManager.subscribe({

        userVisibleOnly:
          true,

        applicationServerKey:
          urlBase64ToUint8Array(
            PUBLIC_VAPID_KEY
          )

      });

  }


  console.log(
    "PUSH SUBSCRIPTION:",
    subscription
  );


  return subscription;

}


/* =========================================================
   SEND SUBSCRIPTION + UV TO BACKEND
========================================================= */

async function sendPushNotification(
  subscription,
  uv
) {

  const response =
    await fetch(
      "https://smart-sun-safety-backend.onrender.com/send-notification",
      {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({

          subscription:
            subscription.toJSON(),

          uv:
            Number(uv)

        })

      }
    );


  let data = {};

  try {

    data =
      await response.json();

  }

  catch {

    data = {};

  }


  if (!response.ok) {

    throw new Error(
      data.error ||
      `Backend returned HTTP ${response.status}`
    );

  }


  console.log(
    "Push notification request successful:",
    data
  );


  return data;

}


/* =========================================================
   2-HOUR REMINDERS
========================================================= */

async function toggleReminders() {

  if (remindersEnabled) {

    remindersEnabled =
      false;


    clearInterval(
      reminderTimer
    );


    reminderTimer =
      null;


    $("reminderToggle")
      .classList.remove(
        "on"
      );


    $("reminderToggle")
      .setAttribute(
        "aria-pressed",
        "false"
      );


    $("reminderStatus").textContent =
      "Currently off";


    return;

  }


  /*
    A location is required.
  */

  if (
    latitude === null ||
    longitude === null
  ) {

    alert(
      "Please choose a location first."
    );

    return;

  }


  /*
    Request notification permission.
  */

  const allowed =
    await requestNotifications();


  if (!allowed) {

    return;

  }


  try {

    /*
      Make sure the service worker
      is ready before subscribing.
    */

    await navigator.serviceWorker.ready;


    /*
      Create the Web Push subscription.
    */

    const subscription =
      await subscribeToPush();


    console.log(
      "Subscription ready:",
      subscription.toJSON()
    );


    /*
      Enable reminders.
    */

    remindersEnabled =
      true;


    $("reminderToggle")
      .classList.add(
        "on"
      );


    $("reminderToggle")
      .setAttribute(
        "aria-pressed",
        "true"
      );


    $("reminderStatus").textContent =
      "On — every 2 hours";


    /*
      Check immediately.
    */

    await checkReminder(
      subscription
    );


    /*
      Check every 2 hours while
      the page is running.
    */

    reminderTimer =
      setInterval(
        async () => {

          try {

            const currentSubscription =
              await subscribeToPush();


            await checkReminder(
              currentSubscription
            );

          }

          catch (error) {

            console.error(
              "Scheduled reminder failed:",
              error
            );

          }

        },
        2 * 60 * 60 * 1000
      );


  }

  catch (error) {

    console.error(
      "PUSH SUBSCRIPTION ERROR:",
      error
    );


    alert(
      "Push notifications could not be enabled. Check that the site is running over HTTPS and try again."
    );

  }

}


/* =========================================================
   CHECK REMINDER
========================================================= */

async function checkReminder(
  subscription = null
) {

  if (
    latitude === null ||
    longitude === null
  ) {

    return;

  }


  try {

    const uv =
      await getUV(
        latitude,
        longitude
      );


    displayUV(uv);


    console.log(
      "Reminder UV check:",
      Number(uv).toFixed(1)
    );


    /*
      Only send a notification when
      UV is 3 or higher.
    */

    if (
      Number(uv) < 3
    ) {

      console.log(
        "UV is below 3. No reminder sent."
      );

      return;

    }


    /*
      Make sure we have a push subscription.
    */

    if (!subscription) {

      subscription =
        await subscribeToPush();

    }


    /*
      Send the notification request
      to your Render backend.
    */

    await sendPushNotification(
      subscription,
      uv
    );


    console.log(
      "☀️ Sunscreen push reminder requested. UV:",
      Number(uv).toFixed(1)
    );

  }

  catch (error) {

    console.error(
      "Reminder check failed:",
      error
    );

  }

}


/* =========================================================
   BUTTONS
========================================================= */

$("locationButton")
  .addEventListener(
    "click",
    useMyLocation
  );


$("manualButton")
  .addEventListener(
    "click",
    loadManualLocation
  );


$("reminderToggle")
  .addEventListener(
    "click",
    toggleReminders
  );


/* =========================================================
   YEAR
========================================================= */

$("year").textContent =
  new Date().getFullYear();


/* =========================================================
   SERVICE WORKER
========================================================= */

if (
  "serviceWorker" in navigator
) {

  window.addEventListener(
    "load",
    async () => {

      try {

        const registration =
          await navigator.serviceWorker
            .register("./sw.js");


        console.log(
          "Service worker registered successfully.",
          registration.scope
        );

      }

      catch (error) {

        console.error(
          "Service worker registration failed:",
          error
        );

      }

    }
  );

}
