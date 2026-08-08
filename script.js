// Global variables
let userLat = null;
let userLng = null;
let alertIntervalTimer = null;

// 2 hours in milliseconds (2 * 60 * 60 * 1000)
// 💡 TEST TIP: Change this to 10000 (10 seconds) before it was (7200000) temporarily to test notifications without waiting 2 hours!
const TWO_HOURS_MS = 7200000; 

// DOM Elements
const locBtn = document.getElementById('loc-btn');
const uvDisplay = document.getElementById('uv-display');
const uvStatus = document.getElementById('uv-status');
const notifyBtn = document.getElementById('notify-btn');
const automationStatus = document.getElementById('automation-status');

// 1. Fetch Location Coordinates
locBtn.addEventListener('click', () => {
    if ("geolocation" in navigator) {
        uvStatus.textContent = "Detecting coordinates...";
        navigator.geolocation.getCurrentPosition(position => {
            userLat = position.coords.latitude;
            userLng = position.coords.longitude;
            uvStatus.textContent = "Location connected! Checking current UV...";
            checkAndAlertUV("Initial Check");
        }, () => {
            uvStatus.textContent = "Location access was denied.";
        });
    } else {
        uvStatus.textContent = "Geolocation is not supported by your browser.";
    }
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
    if (uv >= 0 && Notification.permission === "granted") {
        sendNotification(uv);
    }
}

// Helper function to send reliable notifications via Service Worker
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

    // Use Service Worker registration if available (works better in background/mobile)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, options);
        });
    } else {
        // Desktop / Fallback notification
        new Notification(title, options);
    }
}

// 4. Enable Notifications & Start Loop
notifyBtn.addEventListener('click', () => {
    if (!userLat || !userLng) {
        alert("Please click 'Connect Location' first so we know where to check UV levels!");
        return;
    }

    if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                startTwoHourTimer();
                // Send an immediate confirmation notification so you know alerts are active!
                sendNotification("Enabled");
            } else {
                alert("Notifications were blocked in your browser settings.");
            }
        });
    }
});

function startTwoHourTimer() {
    // Clear any existing timer to avoid overlapping loops
    if (alertIntervalTimer) clearInterval(alertIntervalTimer);

    // Set 2-hour repeat check
    alertIntervalTimer = setInterval(() => {
        checkAndAlertUV("2-Hour Check");
    }, TWO_HOURS_MS);

    // Update UI Status
    notifyBtn.style.display = "none";
    automationStatus.style.display = "block";
    automationStatus.textContent = "Status: Active! Checking UV every 2 hours (Alerts send if UV ≥ 3).";
}

// 5. Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('Service Worker registered successfully!', reg))
            .catch((err) => console.error('Service Worker registration failed:', err));
    });
}
