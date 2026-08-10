/*
  ==========================================
  SUN SAFETY TRACKER
  ==========================================
*/


/* -----------------------------------------
   ELEMENT HELPER
----------------------------------------- */

const $ = (id) => document.getElementById(id);


/* -----------------------------------------
   AUSTRALIAN LOCATIONS

   Coordinates are used directly with
   Open-Meteo, so manual location mode
   does not need browser geolocation.
----------------------------------------- */

const locations = {

  "sydney": {
    name: "Sydney",
    state: "NSW",
    latitude: -33.8688,
    longitude: 151.2093
  },

  "newcastle": {
    name: "Newcastle",
    state: "NSW",
    latitude: -32.9283,
    longitude: 151.7817
  },

  "wollongong": {
    name: "Wollongong",
    state: "NSW",
    latitude: -34.4278,
    longitude: 150.8931
  },

  "central-coast": {
    name: "Central Coast",
    state: "NSW",
    latitude: -33.4350,
    longitude: 151.3420
  },

  "melbourne": {
    name: "Melbourne",
    state: "VIC",
    latitude: -37.8136,
    longitude: 144.9631
  },

  "geelong": {
    name: "Geelong",
    state: "VIC",
    latitude: -38.1499,
    longitude: 144.3617
  },

  "brisbane": {
    name: "Brisbane",
    state: "QLD",
    latitude: -27.4698,
    longitude: 153.0251
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

  "perth": {
    name: "Perth",
    state: "WA",
    latitude: -31.9505,
    longitude: 115.8605
  },

  "adelaide": {
    name: "Adelaide",
    state: "SA",
    latitude: -34.9285,
    longitude: 138.6007
  },

  "canberra": {
    name: "Canberra",
    state: "ACT",
    latitude: -35.2809,
    longitude: 149.1300
  },

  "hobart": {
    name: "Hobart",
    state: "TAS",
    latitude: -42.8821,
    longitude: 147.3272
  },

  "darwin": {
    name: "Darwin",
    state: "NT",
    latitude: -12.4634,
    longitude: 130.8456
  }

};


/* -----------------------------------------
   STATE
----------------------------------------- */

let latitude = null;

let longitude = null;

let currentUV = null;

let currentLocationName = null;

let remindersEnabled = false;

let reminderTimer = null;

let autoUpdateTimer = null;


/*
  Automatically refresh UV every 15 minutes.
*/

const AUTO_UPDATE_TIME =
  15 * 60 * 1000;


/*
  Reminder interval = 2 hours.
*/

const REMINDER_TIME =
  2 * 60 * 60 * 1000;


/* -----------------------------------------
   TOAST
----------------------------------------- */

function showToast(message) {

  const toast = $("toast");

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer =
    setTimeout(() => {

      toast.classList.remove("show");

    }, 3500);

}


/* -----------------------------------------
   UPDATE TIME
----------------------------------------- */

function updateTimestamp() {

  $("updated").textContent =
    "Updated " +
    new Date().toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );

}


/* -----------------------------------------
   UPDATE UV DISPLAY
----------------------------------------- */

function updateUV(uv) {

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


  /*
    UV gauge.
  */

  const percentage =
    Math.min(
      Math.max(
        currentUV / 12 * 100,
        0
      ),
      100
    );


  $("uvGauge").style.width =
    percentage + "%";


  let level = "Low";

  let advice =
    "Enjoy the outdoors and keep your usual sun-safety habits.";


  if (
    currentUV >= 3 &&
    currentUV < 6
  ) {

    level = "Moderate";

    advice =
      "Protection is recommended. Slip, slop, slap, seek and slide.";

  }


  else if (
    currentUV >= 6 &&
    currentUV < 8
  ) {

    level = "High";

    advice =
      "Sun protection is important. Reduce direct sun exposure where possible.";

  }


  else if (
    currentUV >= 8 &&
    currentUV < 11
  ) {

    level = "Very High";

    advice =
      "Extra protection is needed. Seek shade and avoid prolonged direct sun.";

  }


  else if (
    currentUV >= 11
  ) {

    level = "Extreme";

    advice =
      "Extraordinary care is needed. Minimise direct sun exposure.";

  }


  $("uvLevel").textContent =
    level;


  $("uvAdvice").textContent =
    advice;


  /*
    Protection warning at UV 3+.
  */

  if (currentUV >= 3) {

    $("protectionAlert")
      .classList.remove("inactive");

  }

  else {

    $("protectionAlert")
      .classList.add("inactive");

  }

}


/* -----------------------------------------
   GET UV FROM OPEN-METEO
----------------------------------------- */

async function getUV(
  lat,
  lon
) {

  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}` +
    `&longitude=${lon}` +
    "&hourly=uv_index" +
    "&forecast_days=1" +
    "&timezone=auto";


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
   APPLY LOCATION
----------------------------------------- */

async function applyLocation(
  location
) {

  latitude =
    location.latitude;

  longitude =
    location.longitude;

  currentLocationName =
    location.name;


  $("locationName").textContent =
    `${location.name}, ${location.state}`;


  $("locationMessage").textContent =
    "Getting the latest UV level…";


  try {

    const uv =
      await getUV(
        latitude,
        longitude
      );


    updateUV(uv);

    updateTimestamp();


    $("locationMessage").textContent =
      "Live UV data is being monitored for this location.";


    $("locationSuccess")
      .classList.add("show");


    startAutomaticUpdates();


    showToast(
      `UV checked for ${location.name}.`
    );

  }

  catch (error) {

    console.error(error);


    $("locationMessage").textContent =
      "We couldn't load the UV data right now. Try again shortly.";


    showToast(
      "The UV service could not be reached."
    );

  }

}


/* -----------------------------------------
   MANUAL LOCATION
----------------------------------------- */

async function checkManualLocation() {

  const selected =
    $("locationSelect").value;


  if (!selected) {

    showToast(
      "Please choose a location first."
    );

    return;

  }


  const location =
    locations[selected];


  if (!location) {

    showToast(
      "That location is unavailable."
    );

    return;

  }


  const button =
    $("manualButton");


  button.disabled = true;

  button.textContent =
    "☀️ Checking UV…";


  await applyLocation(
    location
  );


  button.disabled = false;

  button.textContent =
    "☀️ Check Selected Location";

}


/* -----------------------------------------
   BROWSER LOCATION
----------------------------------------- */

function connectLocation() {

  if (
    !navigator.geolocation
  ) {

    showToast(
      "Location isn't supported. Choose a location manually instead."
    );

    return;

  }


  const button =
    $("locationButton");


  button.disabled = true;

  button.textContent =
    "📡 Finding your location…";


  navigator.geolocation.getCurrentPosition(

    async (position) => {

      const location = {

        name:
          "Your current location",

        state:
          "",

        latitude:
          position.coords.latitude,

        longitude:
          position.coords.longitude

      };


      await applyLocation(
        location
      );


      $("locationName")
        .textContent =
        "Your current location";


      $("locationMessage")
        .textContent =
        "Live UV data is being monitored for your current location.";


      button.disabled = false;

      button.textContent =
        "🔄 Refresh My Location & UV";

    },


    (error) => {

      console.error(error);


      button.disabled = false;

      button.textContent =
        "📍 Use My Location";


      if (
        error.code === 1
      ) {

        showToast(
          "Location access was blocked. Choose a location manually instead."
        );

      }

      else {

        showToast(
          "Couldn't get your location. Try the manual location option."
        );

      }

    },


    {
      enableHighAccuracy: true,

      timeout: 12000,

      maximumAge: 300000

    }

  );

}


/* -----------------------------------------
   AUTOMATIC UV UPDATES
----------------------------------------- */

function startAutomaticUpdates() {

  clearInterval(
    autoUpdateTimer
  );


  autoUpdateTimer =
    setInterval(
      refreshCurrentUV,
      AUTO_UPDATE_TIME
    );

}


/* -----------------------------------------
   REFRESH CURRENT UV
----------------------------------------- */

async function refreshCurrentUV() {

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


    const previousUV =
      currentUV;


    updateUV(uv);

    updateTimestamp();


    /*
      Notify if UV has crossed
      from below 3 to 3+.
    */

    if (
      remindersEnabled &&
      previousUV !== null &&
      previousUV < 3 &&
      uv >= 3
    ) {

      sendProtectionNotification(
        uv
      );

    }

  }

  catch (error) {

    console.warn(
      "Automatic UV update failed:",
      error
    );

  }

}


/* -----------------------------------------
   NOTIFICATION
----------------------------------------- */

async function sendProtectionNotification(
  uv
) {

  const message =
    `UV is ${Number(uv).toFixed(1)}. ` +
    `Sun protection is recommended.`;


  /*
    Browser notification.
  */

  if (
    "Notification" in window &&
    Notification.permission === "granted"
  ) {

    try {

      new Notification(
        "Sun Safety Reminder ☀️",
        {
          body: message,
          icon: "favicon.png"
        }
      );

      return;

    }

    catch (error) {

      console.warn(
        "Notification failed:",
        error
      );

    }

  }


  /*
    Fallback if notifications
    aren't available.
  */

  showToast(
    message
  );

}


/* -----------------------------------------
   CHECK 2-HOUR REMINDER
----------------------------------------- */

async function checkReminderUV() {

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


    updateUV(uv);

    updateTimestamp();


    if (uv >= 3) {

      await sendProtectionNotification(
        uv
      );

    }

  }

  catch (error) {

    console.warn(
      "Reminder UV check failed:",
      error
    );

  }

}


/* -----------------------------------------
   TOGGLE REMINDERS
----------------------------------------- */

async function toggleReminders() {

  /*
    TURN ON
  */

  if (!remindersEnabled) {


    /*
      The user must have selected
      a location first.
    */

    if (
      latitude === null ||
      longitude === null
    ) {

      showToast(
        "Choose your location first, then turn reminders on."
      );

      return;

    }


    /*
      Request notification permission.
    */

    if (
      "Notification" in window
    ) {

      const permission =
        await Notification.requestPermission();


      if (
        permission === "denied"
      ) {

        showToast(
          "Notifications are blocked in your browser."
        );

        return;

      }

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


    showToast(
      "2-hour sun-safety reminders are on."
    );


    clearInterval(
      reminderTimer
    );


    reminderTimer =
      setInterval(
        checkReminderUV,
        REMINDER_TIME
      );


    /*
      Check the UV immediately.
    */

    await checkReminderUV();

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


    showToast(
      "2-hour reminders turned off."
    );

  }

}


/* -----------------------------------------
   BUTTON EVENTS
----------------------------------------- */

$("locationButton")
  .addEventListener(
    "click",
    connectLocation
  );


$("manualButton")
  .addEventListener(
    "click",
    checkManualLocation
  );


$("reminderToggle")
  .addEventListener(
    "click",
    toggleReminders
  );


/* -----------------------------------------
   FOOTER YEAR
----------------------------------------- */

$("year").textContent =
  new Date().getFullYear();
