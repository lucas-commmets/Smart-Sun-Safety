// Checks UV for every subscribed OneSignal user's saved location, and
// sends a push notification to anyone who is due a reminder:
//   - reminders_enabled tag is "true"
//   - current UV at their location is >= 3
//   - it's been 2+ hours since their last reminder (or they've never had one)
//
// Requires env vars: ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY
// Run on a schedule via .github/workflows/uv-reminder.yml

import zlib from "node:zlib";

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

if (!APP_ID || !API_KEY) {
  console.error("Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY env vars.");
  process.exit(1);
}

const oneSignalHeaders = {
  Authorization: `Key ${API_KEY}`,
  "Content-Type": "application/json"
};

/* -----------------------------
   1. Export current subscriptions (with tags) from OneSignal
----------------------------- */

async function exportSubscriptions() {
  const res = await fetch(
    `https://api.onesignal.com/players/csv_export?app_id=${APP_ID}`,
    {
      method: "POST",
      headers: oneSignalHeaders,
      body: JSON.stringify({})
    }
  );

  if (!res.ok) {
    throw new Error(`csv_export failed: ${res.status} ${await res.text()}`);
  }

  const { csv_file_url } = await res.json();
  if (!csv_file_url) throw new Error("No csv_file_url returned.");

  // OneSignal can return this URL slightly before the file has finished
  // being written on their end — give it a moment before fetching.
  await new Promise((resolve) => setTimeout(resolve, 4000));

  const fileRes = await fetch(csv_file_url);
  if (!fileRes.ok) {
    throw new Error(`Fetching export file failed: ${fileRes.status}`);
  }

  const gzipped = Buffer.from(await fileRes.arrayBuffer());

  // Gzip files always start with bytes 0x1f 0x8b. If they don't,
  // something other than the expected file came back — log it so
  // it's actually visible next time instead of a bare zlib error.
  if (gzipped.length < 2 || gzipped[0] !== 0x1f || gzipped[1] !== 0x8b) {
    console.error("Response wasn't gzip. First 300 bytes:", gzipped.toString("utf-8", 0, 300));
    throw new Error("Export file wasn't valid gzip — see logged content above.");
  }

  const csvText = zlib.gunzipSync(gzipped).toString("utf-8");

  return parseCsv(csvText);
}

// Minimal CSV parser — good enough for OneSignal's export (no embedded
// newlines in fields we care about). Handles quoted fields with commas.
function parseCsv(text) {
  const lines = text.trim().split("\n");
  const headers = splitCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, i) => {
      row[header.trim()] = values[i];
    });
    return row;
  });
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((v) => v.trim().replace(/^"|"$/g, ""));
}

/* -----------------------------
   2. Filter to reminder-eligible subscribers
----------------------------- */

// OneSignal's CSV export writes tags in its own loose, unquoted format —
// e.g. {latitude:-33.8688,longitude:151.2093,reminders_enabled:true} —
// which is NOT valid JSON, so it needs its own small parser.
function parseTagsField(raw) {
  if (!raw) return {};
  const inner = raw.trim().replace(/^\{/, "").replace(/\}$/, "");
  if (!inner) return {};

  const tags = {};
  for (const pair of inner.split(",")) {
    const idx = pair.indexOf(":");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    tags[key] = value;
  }
  return tags;
}

function getEligibleSubscribers(rows) {
  const eligible = [];

  for (const row of rows) {
    const tags = parseTagsField(row.tags);

    if (tags.reminders_enabled !== "true") continue;
    if (!tags.loc) continue;

    const [latStr, lonStr] = tags.loc.split("_");
    if (!latStr || !lonStr) continue;

    const subscriptionId = row.id || row.subscription_id || row.player_id;
    if (!subscriptionId) continue;

    eligible.push({
      subscriptionId,
      latitude: Number(latStr),
      longitude: Number(lonStr),
      lastReminderSent: tags.last_reminder_sent ? Number(tags.last_reminder_sent) : null
    });
  }

  return eligible;
}

/* -----------------------------
   3. UV lookup (same logic as script.js)
----------------------------- */

const uvCache = new Map();

async function getUV(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (uvCache.has(key)) return uvCache.get(key);

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=uv_index&forecast_days=1&timezone=UTC`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`UV lookup failed for ${key}`);
  const data = await res.json();
  if (!data.hourly?.uv_index) throw new Error(`No UV data for ${key}`);

  const now = Date.now();
  let closestIndex = 0;
  let smallestDiff = Infinity;
  data.hourly.time.forEach((time, i) => {
    // Times come back UTC-labeled but without a "Z" suffix, so append
    // one to make sure JS parses them as UTC rather than local time.
    const diff = Math.abs(new Date(time + "Z").getTime() - now);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestIndex = i;
    }
  });

  const uv = Number(data.hourly.uv_index[closestIndex]);
  uvCache.set(key, uv);
  return uv;
}

/* -----------------------------
   4. Send push + update last_reminder_sent tag
----------------------------- */

async function sendReminder(subscriptionId, uv) {
  const res = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: oneSignalHeaders,
    body: JSON.stringify({
      app_id: APP_ID,
      include_subscription_ids: [subscriptionId],
      headings: { en: "Sun Safety Reminder ☀️" },
      contents: {
        en: `Current UV index is ${uv.toFixed(1)}. Don't forget sunscreen and a hat!`
      }
    })
  });

  if (!res.ok) {
    console.error(`Push failed for ${subscriptionId}: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

async function updateLastReminderTag(subscriptionId, timestamp) {
  const res = await fetch(`https://api.onesignal.com/players/${subscriptionId}`, {
    method: "PUT",
    headers: oneSignalHeaders,
    body: JSON.stringify({
      app_id: APP_ID,
      tags: { last_reminder_sent: String(timestamp) }
    })
  });

  if (!res.ok) {
    console.error(`Tag update failed for ${subscriptionId}: ${res.status} ${await res.text()}`);
  }
}

/* -----------------------------
   Main
----------------------------- */

async function main() {
  console.log("Exporting subscriptions...");
  const rows = await exportSubscriptions();

  console.log(`Total rows exported: ${rows.length}`);
  rows.forEach((row, i) => {
    console.log(`Row ${i}: id=${row.id}, device_type=${row.device_type}, tags=${row.tags}`);
  });

  const subscribers = getEligibleSubscribers(rows);
  console.log(`${subscribers.length} subscriber(s) with reminders enabled.`);

  const now = Date.now();
  let sentCount = 0;

  for (const sub of subscribers) {
    const due = true; // TEMP: cooldown bypassed for testing — restore the real check after
    // const due = sub.lastReminderSent === null || now - sub.lastReminderSent >= TWO_HOURS_MS;

    if (!due) continue;

    try {
      const uv = await getUV(sub.latitude, sub.longitude);
      console.log(`${sub.subscriptionId}: UV ${uv.toFixed(1)} at (${sub.latitude}, ${sub.longitude})`);

      if (uv >= -1) { // TEMP: forced for testing — change back to 3 after
        const sent = await sendReminder(sub.subscriptionId, uv);
        if (sent) {
          await updateLastReminderTag(sub.subscriptionId, now);
          sentCount++;
        }
      }
    } catch (err) {
      console.error(`Failed processing ${sub.subscriptionId}:`, err.message);
    }
  }

  console.log(`Done. Sent ${sentCount} reminder(s).`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
