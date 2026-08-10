// Global variables
let userLat = null;
let userLng = null;
let alertIntervalTimer = null;

// 2 hours in milliseconds (2 * 60 * 60 * 1000)
// 💡 TEST TIP: Set to 10000 (10 seconds) during testing to see quick updates!
const TWO_HOURS_MS = 7200000; 

// DOM Elements
const locBtn = document.getElementById('loc-btn');
const uvDisplay = document.getElementById('uv-display');
const uvStatus = document.getElementById('uv-status');
const notifyBtn = document.getElementById('notify-btn');
const automationStatus = document.getElementById('automation-status');

// Helper function to get current position asynchronously
function updateLocationAndCheckUV(triggerLabel = "Routine Check") {
    return new Promise((resolve, reject) => {
        if ("geolocation" in navigator) {
            uvStatus.textContent = "Updating location & checking UV...";
            
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    userLat = position.coords.latitude;
                    userLng = position.coords.longitude;
                    uvStatus.textContent = "Location updated!";
                    
                    // Run the UV check with fresh coordinates
                    await checkAndAlertUV(triggerLabel);
                    resolve();
                },
            (error) => {
    console.warn("Geolocation error or denied:", error);

    uvStatus.textContent = "Location access denied.";

    if (userLat !== null && userLng !== null) {
        checkAndAlertUV(triggerLabel);
    } else {
        setTimeout(() => {
            if (confirm("Location was denied. Would you like to enter your location manually?")) {
                manualLocation();
            }
        }, 100);
    }

    resolve();
},
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            uvStatus.textContent = "Geolocation is not supported by your browser.";
            resolve();
        }
    });
}
async function manualLocation() {
    const location = prompt("Enter your city or suburb:");

    if (!location) return;

    uvStatus.textContent = "Finding location...";

    try {
        const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`
        );

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            uvStatus.textContent = "❌ Location not found. Try again.";
            return;
        }

        userLat = data.results[0].latitude;
        userLng = data.results[0].longitude;

        uvStatus.textContent =
            `✅ Location set to ${data.results[0].name}! Checking UV...`;

        await checkAndAlertUV("Manual Location");

    } catch (error) {
        console.error("Manual location error:", error);
        uvStatus.textContent = "❌ Couldn't find that location.";
    }
}
// 1. Fetch Location Coordinates (Initial Button Click)
locBtn.addEventListener('click', () => {
    updateLocationAndCheckUV("Initial Check");
});

// 2. Fetch Live UV Data from OpenUV API
async function fetchUVIndex(lat, lng) {
    try {
        const response = await fetch(`https://api.openuv.io/api/v1/uv?lat=${lat}&lng=${lng}`, {
            headers: { 'x-access-token': 'openuv-dpcirmsirbzyn-io' }
        });
        const data = await response.json();
        return Math.round(data.result.uv);
    } catch (error) {
        console.error("Error fetching UV data:", error);
        return null;
    }
}

// 3. UI Update & Threshold Notification Check
async function checkAndAlertUV(triggerType) {
    if (!userLat || !userLng) return;

    const uv = await fetchUVIndex(userLat, userLng);
    if (uv === null) return;

    // Update Dashboard UI
    uvDisplay.textContent = `UV Index: ${uv}`;
    if (uv <= 2) {
        uvDisplay.style.backgroundColor = "#4caf50"; // Low (Green)
        uvStatus.textContent = "Low UV level. Sun protection not strictly required.";
    } else if (uv <= 5) {
        uvDisplay.style.backgroundColor = "#fbc02d"; // Moderate (Yellow)
        uvStatus.textContent = "Moderate UV level. Sun protection recommended!";
    } else {
        uvDisplay.style.backgroundColor = "#d32f2f"; // High/Extreme (Red)
        uvStatus.textContent = "High UV level! Reapply sunscreen and wear a hat.";
    }

    // Send notification ONLY if UV is 3 or higher
    if (uv >= 3 && Notification.permission === "granted") {
        sendNotification(uv);
    }
}

// Helper function to send notifications reliably via Service Worker
function sendNotification(uv) {
    const title = "☀️ Sunscreen Reminder";
    const options = {
        body: typeof uv === 'number' 
            ? `Current UV Index is ${uv}. It has been 2 hours—reapply your sunscreen if you're outdoors!` 
            : `Automated UV alerts are active! We'll remind you every 2 hours when UV is 3 or higher.`,
        icon: "sun-icon-192.png",
        badge: "sun-icon-192.png",
        vibrate: [200, 100, 200]
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, options);
        });
    } else {
        new Notification(title, options);
    }
}

// 4. Enable Notifications & Start Auto-Refreshing Loop
notifyBtn.addEventListener('click', () => {
    if (!userLat || !userLng) {
        alert("Please click 'Connect Location' first so we know where to check UV levels!");
        return;
    }

    if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                startTwoHourTimer();
                sendNotification("Enabled");
            } else {
                alert("Notifications were blocked in your browser settings.");
            }
        });
    }
});

function startTwoHourTimer() {
    if (alertIntervalTimer) clearInterval(alertIntervalTimer);

    // Every 2 hours, fetch fresh GPS coordinates FIRST, then check UV
    alertIntervalTimer = setInterval(() => {
        updateLocationAndCheckUV("2-Hour Automated Check");
    }, TWO_HOURS_MS);

    // Update UI Status
    notifyBtn.style.display = "none";
    automationStatus.style.display = "block";
    automationStatus.textContent = "Status: Active! Auto-updating location & checking UV every 2 hours (Alerts send if UV ≥ 3).";
}

// 5. Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('Service Worker registered successfully!', reg))
            .catch((err) => console.error('Service Worker registration failed:', err));
    });
}
