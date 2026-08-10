```javascript
/*
SUN SAFETY TRACKER
*/

/* -----------------------------------------
AUSTRALIAN LOCATIONS
----------------------------------------- */

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
  }

};


/* -----------------------------------------
STATE
----------------------------------------- */

let latitude = null;
let longitude = null;
let currentUV = null;

let remindersEnabled = false;

let reminderTimer = null;
let autoUpdateTimer = null;


/* -----------------------------------------
ELEMENT HELPER
----------------------------------------- */

const $ = (id) =>
  document.getElementById(id);


/* -----------------------------------------
UV API
----------------------------------------- */

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


/* -----------------------------------------
DISPLAY UV
----------------------------------------- */

function displayUV(uv) {

  currentUV =
    Number(uv);


  if (
    !Number.isFinite(currentUV)
  ) {

    $("uvNumber").textContent =
      "--";

    return;

  }


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

    level =
      "Low";

    advice =
      "Enjoy the outdoors and keep your usual sun-safety habits.";

  }

  else if (currentUV < 6) {

    level =
      "Moderate";

    advice =
      "Protection is recommended. Slip, slop, slap, seek and slide.";

  }

  else if (currentUV < 8) {

    level =
      "High";

    advice =
      "Sun protection is important. Reduce direct sun exposure where possible.";

  }

  else if (currentUV < 11) {

    level =
      "Very High";

    advice =
      "Extra protection is needed. Seek shade and avoid prolonged direct sun.";

  }

  else {

    level =
      "Extreme";

    advice =
      "Minimise direct sun exposure and take extra care.";

  }


  $("uvLevel").textContent =
    level;

  $("uvAdvice").textContent =
    advice;


  if (currentUV >= 3) {

    $("protectionAlert")
      .classList.remove("inactive");

  }

  else {

    $("protectionAlert")
      .classList.add("inactive");

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


/* -----------------------------------------
MANUAL LOCATION FALLBACK
----------------------------------------- */

/*
IMPORTANT:

This does NOT request browser
location permission.

The user can select an Australian
location manually and the website
will use that location for UV data.

This is the fallback when GPS/location
access doesn't work or is blocked.
*/

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

    return;

  }


  $("locationName").textContent =
    `${location.name}, ${location.state}`;


  $("locationMessage").textContent =
    "Getting the latest UV level...";


  $("manualButton").disabled =
    true;


  $("manualButton").textContent =
    "☀️ Checking UV...";


  try {

    const uv =
      await getUV(
        location.latitude,
        location.longitude
      );


    /*
    IMPORTANT:

    Manual location becomes the
    active location.

    Browser GPS is NOT requested.
    */

    latitude =
      location.latitude;

    longitude =
      location.longitude;


    displayUV(uv);


    $("locationMessage").textContent =
      "Live UV data is being monitored for this location.";


    $("locationSuccess")
      .classList.add("show");


    startAutoUpdate();


  }

  catch (error) {

    console.error(error);


    $("locationMessage").textContent =
      "The UV service could not be reached. Your school network may be blocking it.";


    alert(
      "The UV service could not be reached."
    );

  }


  $("manualButton").disabled =
    false;


  $("manualButton").textContent =
    "☀️ Check Selected Location";

}


/* -----------------------------------------
DEVICE LOCATION
----------------------------------------- */

function useMyLocation() {

  if (!navigator.geolocation) {

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


        $("locationSuccess")
          .classList.add("show");


        startAutoUpdate();

      }

      catch (error) {

        console.error(error);


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


/* -----------------------------------------
AUTOMATIC UV UPDATES
----------------------------------------- */

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


/* -----------------------------------------
REFRESH UV
----------------------------------------- */

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
      "Automatic UV update unavailable."
    );

  }

}


/* -----------------------------------------
NOTIFICATION PERMISSION
----------------------------------------- */

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
      "Notifications are blocked in your browser."
    );

    return false;

  }


  const permission =
    await Notification.requestPermission();


  return (
    permission ===
    "granted"
  );

}


/* -----------------------------------------
REMINDER ENABLED CONFIRMATION
----------------------------------------- */

function sendReminderEnabledNotification() {

  if (
    !("Notification" in window) ||
    Notification.permission !==
    "granted"
  ) {

    return;

  }


  try {

    new Notification(
      "Sun Safety Reminders Enabled 🔔",
      {

        body:
          "You'll be notified every 2 hours when the UV index is 3 or higher.",

        icon:
          "favicon.png",

        tag:
          "sun-safety-reminders-enabled"

      }
    );

  }

  catch (error) {

    console.warn(
      "Confirmation notification failed:",
      error
    );

  }

}


/* -----------------------------------------
2-HOUR SUNSCREEN NOTIFICATION
----------------------------------------- */

function sendNotification(uv) {

  if (
    !("Notification" in window) ||
    Notification.permission !==
    "granted"
  ) {

    return;

  }


  const message =
    `The UV index is ${Number(uv).toFixed(1)}. ` +
    `Reapply sunscreen as it has been 2 hours.`;


  try {

    new Notification(
      "Sun Safety Reminder ☀️",
      {

        body:
          message,

        icon:
          "favicon.png",

        tag:
          "sun-safety-2-hour-reminder"

      }
    );

  }

  catch (error) {

    console.warn(
      "Notification failed:",
      error
    );

  }

}


/* -----------------------------------------
2-HOUR REMINDER
----------------------------------------- */

async function toggleReminders() {

  /*
  TURN ON
  */

  if (!remindersEnabled) {

    /*
    IMPORTANT:

    A manually selected location is
    perfectly valid.

    GPS permission is NOT required.
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


    const allowed =
      await requestNotifications();


    if (!allowed) {

      alert(
        "Please allow notifications in your browser to use reminders."
      );

      return;

    }


    remindersEnabled =
      true;


    $("reminderToggle")
      .classList.add("on");


    $("reminderToggle")
      .setAttribute(
        "aria-pressed",
        "true"
      );


    $("reminderStatus")
      .textContent =
      "On — every 2 hours";


    /*
    SEND CONFIRMATION.

    This tells the user that the
    reminder system is active.
    */

    sendReminderEnabledNotification();


    /*
    Small visual confirmation too.
    */

    if (typeof showToast === "function") {

      showToast(
        "2-hour sun-safety reminders are on."
      );

    }


    /*
    Make sure there isn't an
    old reminder timer running.
    */

    clearInterval(
      reminderTimer
    );


    /*
    IMPORTANT:

    We do NOT send a sunscreen
    reminder immediately.

    The first real reminder happens
    after 2 hours.
    */

    reminderTimer =
      setInterval(
        checkReminder,
        2 * 60 * 60 * 1000
      );

  }


  /*
  TURN OFF
  */

  else {

    remindersEnabled =
      false;


    clearInterval(
      reminderTimer
    );


    $("reminderToggle")
      .classList.remove("on");


    $("reminderToggle")
      .setAttribute(
        "aria-pressed",
        "false"
      );


    $("reminderStatus")
      .textContent =
      "Currently off";


    if (typeof showToast === "function") {

      showToast(
        "2-hour reminders turned off."
      );

    }

  }

}


/* -----------------------------------------
CHECK REMINDER
----------------------------------------- */

async function checkReminder() {

  if (
    !remindersEnabled ||
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


    /*
    Only send the reminder when
    UV is 3 or higher.
    */

    if (uv >= 3) {

      sendNotification(uv);

    }

  }

  catch (error) {

    console.log(
      "Reminder check failed."
    );

  }

}


/* -----------------------------------------
BUTTONS
----------------------------------------- */

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


/* -----------------------------------------
YEAR
----------------------------------------- */

if ($("year")) {

  $("year").textContent =
    new Date().getFullYear();

}
```
