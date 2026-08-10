const $ = (id) => document.getElementById(id);

let latitude = null;
let longitude = null;
let currentUV = null;

let remindersEnabled = false;
let reminderTimer = null;


/* --------------------------------
   TOAST MESSAGE
-------------------------------- */

function showToast(message) {

  const toast = $("toast");

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}


/* --------------------------------
   UPDATE UV DISPLAY
-------------------------------- */

function updateUV(uv) {

  currentUV = Number(uv);

  $("uvNumber").textContent =
    Number.isFinite(currentUV)
      ? currentUV.toFixed(1)
      : "--";


  /*
    UV scale:
    0 = low
    3 = moderate
    6 = high
    8 = very high
    11+ = extreme
  */

  const percentage =
    Math.min(
      Math.max(currentUV / 12 * 100, 0),
      100
    );

  $("uvGauge").style.width =
    percentage + "%";


  let level = "Low";

  let advice =
    "Enjoy the outdoors and keep your usual sun-safety habits.";


  if (currentUV >= 3 && currentUV < 6) {

    level = "Moderate";

    advice =
      "Protection is recommended. Slip, slop, slap, seek and slide.";

  }

  else if (currentUV >= 6 && currentUV < 8) {

    level = "High";

    advice =
      "Sun protection is important. Reduce direct sun exposure where possible.";

  }

  else if (currentUV >= 8 && currentUV < 11) {

    level = "Very High";

    advice =
      "Extra protection is needed. Seek shade and avoid prolonged direct sun.";

  }

  else if (currentUV >= 11) {

    level = "Extreme";

    advice =
      "Extraordinary care is needed. Minimise direct sun exposure.";

  }


  $("uvLevel").textContent = level;

  $("uvAdvice").textContent = advice;


  /*
    Show protection warning at UV 3+
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


/* --------------------------------
   GET UV DATA
-------------------------------- */

async function getUV(lat, lon) {

  /*
    Open-Meteo does not require an API key.
    This avoids the old OpenUV 403 problem.
  */

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


  const now =
    Date.now();


  let closestIndex = 0;

  let smallestDifference =
    Infinity;


  data.hourly.time.forEach(
    (time, index) => {

      const difference =
        Math.abs(
          new Date(time) - now
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


/* --------------------------------
   GET LOCATION NAME
-------------------------------- */

async function getLocationName(
  lat,
  lon
) {

  try {

    const response =
      await fetch(
        `https://nominatim.openstreetmap.org/reverse` +
        `?format=jsonv2` +
        `&lat=${lat}` +
        `&lon=${lon}` +
        `&zoom=10`
      );


    const data =
      await response.json();


    const address =
      data.address || {};


    return (
      address.city ||
      address.town ||
      address.suburb ||
      address.village ||
      address.municipality ||
      "Your location"
    );

  }

  catch {

    return (
      `Your location (${lat.toFixed(2)}, ${lon.toFixed(2)})`
    );

  }

}


/* --------------------------------
   CONNECT LOCATION
-------------------------------- */

async function connectLocation() {

  if (!navigator.geolocation) {

    showToast(
      "Location is not supported by this browser."
    );

    return;

  }


  const button =
    $("locationButton");


  button.disabled = true;

  button.textContent =
    "📡 Checking your location…";


  navigator.geolocation.getCurrentPosition(

    async (position) => {

      latitude =
        position.coords.latitude;

      longitude =
        position.coords.longitude;


      try {

        const [
          locationName,
          uv
        ] = await Promise.all([

          getLocationName(
            latitude,
            longitude
          ),

          getUV(
            latitude,
            longitude
          )

        ]);


        $("locationName")
          .textContent =
          locationName;


        $("locationMessage")
          .textContent =
          "Your live location has been connected.";


        $("locationSuccess")
          .classList.add("show");


        $("updated")
          .textContent =
          "Updated " +
          new Date().toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit"
            }
          );


        updateUV(uv);


        showToast(
          `UV checked for ${locationName}.`
        );


      }

      catch {

        showToast(
          "We couldn't load the live UV level right now. Try again shortly."
        );

      }


      button.disabled = false;

      button.textContent =
        "🔄 Refresh Location & UV";

    },


    (error) => {

      button.disabled = false;

      button.textContent =
        "📍 Connect Location & Check UV";


      if (error.code === 1) {

        showToast(
          "Please allow location access to check your local UV."
        );

      }

      else {

        showToast(
          "Unable to determine your location. Try again."
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


/* --------------------------------
   CHECK UV FOR REMINDER
-------------------------------- */

async function checkReminderUV() {

  if (
    !remindersEnabled ||
    latitude === null
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


    if (
      uv >= 3 &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {

      new Notification(
        "Sun Safety Reminder ☀️",
        {
          body:
            `UV is ${uv.toFixed(1)}. ` +
            `Time to reapply sunscreen ` +
            `and check your sun protection.`
        }
      );

    }

    else if (uv >= 3) {

      showToast(
        `UV is ${uv.toFixed(1)} — remember your sun protection!`
      );

    }

  }

  catch {

    // Keep the previous UV value if the refresh fails.

  }

}


/* --------------------------------
   TURN REMINDERS ON/OFF
-------------------------------- */

async function toggleReminders() {

  /*
    Turning reminders ON
  */

  if (!remindersEnabled) {


    if ("Notification" in window) {

      const permission =
        await Notification.requestPermission();


      if (permission === "denied") {

        showToast(
          "Notifications are blocked in your browser settings."
        );

        return;

      }

    }


    remindersEnabled = true;


    $("reminderToggle")
      .classList.add("on");


    $("reminderToggle")
      .setAttribute(
        "aria-pressed",
        "true"
      );


    $("reminderStatus")
      .textContent =
      "On — checking every 2 hours";


    showToast(
      "2-hour sun-safety reminders are on."
    );


    clearInterval(
      reminderTimer
    );


    /*
      2 hours = 7,200,000 milliseconds
    */

    reminderTimer =
      setInterval(
        checkReminderUV,
        2 * 60 * 60 * 1000
      );


    /*
      Check immediately if
      UV is already 3+
    */

    if (
      currentUV !== null &&
      currentUV >= 3
    ) {

      checkReminderUV();

    }

  }


  /*
    Turning reminders OFF
  */

  else {

    remindersEnabled = false;


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


/* --------------------------------
   BUTTON EVENTS
-------------------------------- */

$("locationButton")
  .addEventListener(
    "click",
    connectLocation
  );


$("reminderToggle")
  .addEventListener(
    "click",
    toggleReminders
  );


/* --------------------------------
   FOOTER YEAR
-------------------------------- */

$("year")
  .textContent =
  new Date().getFullYear();