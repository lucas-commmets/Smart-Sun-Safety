self.addEventListener("push", event => {
    let data = {};

    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = {
            title: "Sun Safety Reminder ☀️",
            body: "It's time to check the UV level."
        };
    }

    const title = data.title || "Sun Safety Reminder ☀️";

    const options = {
        body: data.body || "It's time to check the UV level.",
        icon: "/favicon.ico",
        badge: "/favicon.ico"
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});