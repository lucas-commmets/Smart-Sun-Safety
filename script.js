

const SUPABASE_URL = "https://ndosqkrtkybeiafagjto.supabase.co";

// Put your Supabase PUBLISHABLE key between the quotes.
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3EOT86U57-09W4m7BZq1Xw_tcL68Iiv"

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);




let userLat = null;
let userLng = null;
let alertIntervalTimer = null;

// 2 hours in milliseconds
// TEST TIP: Use 10000 for 10 seconds while testing.
const TWO_HOURS_MS = 7200000;




const locBtn = document.getElementById("loc-btn");
const uvDisplay = document.getElementById("uv-display");
const uvStatus = document.getElementById("uv-status");
const notifyBtn = document.getElementById("notify-btn");
const automationStatus = document.getElementById("automation-status");




// Put your VAPID PUBLIC key here.
// Do NOT put your VAPID private key here.
const VAPID_PUBLIC_KEY = "BJq31EW9LM_gGYk6wD7-yNdHbMZDCt4Pbc0kveTRSehHw1kVJQ9EunJnkdVsVWvjwxDhRjkeVyNfpN9tOqxK_EY"




function updateLocationAndCheckUV(triggerLabel = "Routine Check") {
    return new Promise((resolve) => {

        if ("geolocation" in navigator) {

            uvStatus.textContent =
                "Updating location & checking UV...";

            navigator.geolocation.getCurrentPosition(

                async (position) => {

                    userLat = position.coords.latitude;
                    userLng = position.coords.longitude;

                    uvStatus.textContent =
                        "Location updated!";

                    await checkAndAlertUV(triggerLabel);

                    resolve();
                },

                (error) => {

                    console.warn(
                        "Geolocation error or denied:",
                        error
                    );

                    uvStatus.textContent =
                        "Location access denied.";

                    // Use last known location if available
                    if (
                        userLat !== null &&
                        userLng !== null
                    ) {

                        checkAndAlertUV(triggerLabel);

                    } else {

                        setTimeout(() => {

                            if (
                                confirm(
                                    "Location was denied. Would you like to enter your location manually?"
                                )
                            ) {

                                manualLocation();

                            }

                        }, 100);
                    }

                    resolve();
                },

                {
                    enableHighAccuracy: true,
                    timeout: 10000
                }
            );

        } else {

            uvStatus.textContent =
                "Geolocation is not supported by your browser.";

            resolve();
        }
    });
}




async function manualLocation() {

    const location = prompt(
        "Enter your city or suburb:"
    );

    if (!location) return;

    uvStatus.textContent =
        "Finding location...";

    try {

        const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`
        );

        const data = await response.json();

        if (
            !data.results ||
            data.results.length === 0
        ) {

            uvStatus.textContent =
                "❌ Location not found. Try again.";

            return;
        }

        userLat = data.results[0].latitude;
        userLng = data.results[0].longitude;

        uvStatus.textContent =
            `✅ Location set to ${data.results[0].name}! Checking UV...`;

        await checkAndAlertUV(
            "Manual Location"
        );

    } catch (error) {

        console.error(
            "Manual location error:",
            error
        );

        uvStatus.textContent =
            "❌ Couldn't find that location.";
    }
}




locBtn.addEventListener("click", () => {

    updateLocationAndCheckUV(
        "Initial Check"
    );

});




async function fetchUVIndex(lat, lng) {

    try {

        const response = await fetch(
            `https://api.openuv.io/api/v1/uv?lat=${lat}&lng=${lng}`,
            {
                headers: {
                    "x-access-token":
                        "x-access-token': 'openuv-dpcirmsirbzyn-io"
                }
            }
        );

        if (!response.ok) {

            console.error(
                "OpenUV request failed:",
                response.status
            );

            return null;
        }

        const data = await response.json();

        return Math.round(
            data.result.uv
        );

    } catch (error) {

        console.error(
            "Error fetching UV data:",
            error
        );

        return null;
    }
}


// ================================
// UV CHECK
// ================================

async function checkAndAlertUV(triggerType) {

    if (
        userLat === null ||
        userLng === null
    ) {
        return;
    }

    const uv = await fetchUVIndex(
        userLat,
        userLng
    );

    if (uv === null) {
        return;
    }

    // Update dashboard
    uvDisplay.textContent =
        `UV Index: ${uv}`;

    if (uv <= 2) {

        uvDisplay.style.backgroundColor =
            "#4caf50";

        uvStatus.textContent =
            "Low UV level. Sun protection not strictly required.";

    } else if (uv <= 5) {

        uvDisplay.style.backgroundColor =
            "#fbc02d";

        uvStatus.textContent =
            "Moderate UV level. Sun protection recommended!";

    } else {

        uvDisplay.style.backgroundColor =
            "#d32f2f";

        uvStatus.textContent =
            "High UV level! Reapply sunscreen and wear a hat.";
    }

    // Send notification only when UV >= 3
    if (
        uv >= 3 &&
        "Notification" in window &&
        Notification.permission === "granted"
    ) {

        sendNotification(uv);
    }
}


// ================================
// NOTIFICATION
// ================================

function sendNotification(uv) {

    const title =
        "☀️ Sunscreen Reminder";

    const options = {

        body:
            typeof uv === "number"
                ? `Current UV Index is ${uv}. It has been 2 hours—reapply your sunscreen if you're outdoors!`
                : "Automated UV alerts are active!! We'll remind you every 2 hours when the UV is 3 or higher.",

        icon:
            "sun-icon-192.png",

        badge:
            "sun-icon-192.png",

        vibrate:
            [200, 100, 200]
    };


    if (
        "serviceWorker" in navigator
    ) {

        navigator.serviceWorker.ready
            .then((registration) => {

                registration.showNotification(
                    title,
                    options
                );

            })
            .catch((error) => {

                console.error(
                    "Service worker notification failed:",
                    error
                );

            });

    } else if (
        "Notification" in window
    ) {

        new Notification(
            title,
            options
        );
    }
}


// ================================
// ENABLE NOTIFICATIONS
// ================================

notifyBtn.addEventListener(
    "click",
    async () => {

        if (
            userLat === null ||
            userLng === null
        ) {

            alert(
                "Please click 'Connect Location' first so we know where to check UV levels!"
            );

            return;
        }


        if (
            !("Notification" in window)
        ) {

            alert(
                "Notifications are not supported by this browser."
            );

            return;
        }


        try {

            const permission =
                await Notification.requestPermission();


            if (
                permission !== "granted"
            ) {

                alert(
                    "Notifications were blocked in your browser settings."
                );

                return;
            }


            // Opening notification
            sendNotification(
                "Enabled"
            );


            // Subscribe to push
            try {

                await subscribeToPushNotifications();

                console.log(
                    "✅ Push notification setup complete."
                );

            } catch (error) {

                console.error(
                    "Push subscription error:",
                    error
                );
            }


            // Start existing 2-hour timer
            startTwoHourTimer();

        } catch (error) {

            console.error(
                "Notification setup error:",
                error
            );

            alert(
                "Something went wrong while enabling notifications."
            );
        }

    }
);


// ================================
// TWO-HOUR TIMER
// ================================

function startTwoHourTimer() {

    if (alertIntervalTimer) {

        clearInterval(
            alertIntervalTimer
        );
    }


    alertIntervalTimer =
        setInterval(
            () => {

                updateLocationAndCheckUV(
                    "2-Hour Automated Check"
                );

            },
            TWO_HOURS_MS
        );


    notifyBtn.style.display =
        "none";

    automationStatus.style.display =
        "block";

    automationStatus.textContent =
        "Status: Active! Auto-updating location & checking UV every 2 hours (Alerts send if UV ≥ 3).";
}


// ================================
// SERVICE WORKER
// ================================

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker
                .register("./sw.js")

                .then((reg) => {

                    console.log(
                        "Service Worker registered successfully!",
                        reg
                    );

                })

                .catch((err) => {

                    console.error(
                        "Service Worker registration failed:",
                        err
                    );
                });

        }
    );
}


// ================================
// VAPID KEY CONVERSION
// ================================

function urlBase64ToUint8Array(
    base64String
) {

    const padding =
        "=".repeat(
            (4 - base64String.length % 4) % 4
        );

    const base64 =
        (
            base64String + padding
        )
            .replace(/-/g, "+")
            .replace(/_/g, "/");


    const rawData =
        window.atob(base64);


    return Uint8Array.from(
        [...rawData].map(
            (char) =>
                char.charCodeAt(0)
        )
    );
}


// ================================
// PUSH SUBSCRIPTION
// ================================

async function subscribeToPushNotifications() {

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


    try {

        const registration =
            await navigator.serviceWorker.ready;


        let subscription =
            await registration.pushManager.getSubscription();


        // Create subscription
        if (!subscription) {

            subscription =
                await registration.pushManager.subscribe({

                    userVisibleOnly: true,

                    applicationServerKey:
                        urlBase64ToUint8Array(
                            VAPID_PUBLIC_KEY
                        )
                });
        }


        console.log(
            "Push subscription:",
            subscription
        );


        // Save subscription to Supabase
        const {
            error
        } = await supabaseClient
            .from("push_subscriptions")
            .upsert(

                {
                    endpoint:
                        subscription.endpoint,

                    subscription:
                        subscription.toJSON(),

                    latitude:
                        userLat,

                    longitude:
                        userLng,

                    reminders_enabled:
                        true,

                    // First server check is 2 hours
                    // after the opening notification.
                    next_check_at:
                        new Date(
                            Date.now() +
                            TWO_HOURS_MS
                        ).toISOString()
                },

                {
                    onConflict:
                        "endpoint"
                }
            );


        if (error) {

            console.error(
                "Could not save push subscription:",
                error
            );

            throw error;
        }


        console.log(
            "✅ Push subscription saved!"
        );

    } catch (error) {

        console.error(
            "Push subscription failed:",
            error
        );

        throw error;
    }
}
