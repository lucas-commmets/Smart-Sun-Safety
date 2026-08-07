// Global variables
let userLat = null;
let userLng = null;
let alertIntervalTimer = null;

// 2 hours in milliseconds (2 * 60 * 60 * 1000)
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
    if (uv >= 3 && Notification.permission === "granted") {
        new Notification("☀️ Sunscreen Reminder", {
            body: `Current UV Index is ${uv}. It has been 2 hours—reapply your sunscreen if you're outdoors!`,
            icon: "https://cdn-icons-png.flaticon.com/512/869/869869.png"
        });
    }
}

// 4. Enable Notifications & Start 2-Hour Loop
notifyBtn.addEventListener('click', () => {
    if (!userLat || !userLng) {
        alert("Please click 'Connect Location' first so we know where to check UV levels!");
        return;
    }

    if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                startTwoHourTimer();
            } else {
                alert("Notifications were blocked in your browser settings.");
            }
        });
    }
});

function startTwoHourTimer() {
    // Clear any active timers to prevent duplicates
    if (alertIntervalTimer) clearInterval(alertIntervalTimer);

    // Set the repeat interval to exactly 2 hours
    alertIntervalTimer = setInterval(() => {
        checkAndAlertUV("2-Hour Check");
    }, TWO_HOURS_MS);

    // Update UI Status
    notifyBtn.style.display = "none";
    automationStatus.style.display = "block";
    automationStatus.textContent = "Status: Active! Checking UV every 2 hours (Alerts send if UV ≥ 3).";
}