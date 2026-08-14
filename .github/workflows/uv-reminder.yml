name: UV Reminder Push Check

on:
  schedule:
    # Runs every 15 minutes. GitHub may delay this by a few minutes
    # under load — it's a best-effort schedule, not exact.
    - cron: "*/15 * * * *"
  workflow_dispatch: {} # lets you trigger it manually from the Actions tab, for testing

jobs:
  check-uv-and-notify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Check UV and send due reminders
        env:
          ONESIGNAL_APP_ID: ${{ secrets.ONESIGNAL_APP_ID }}
          ONESIGNAL_REST_API_KEY: ${{ secrets.ONESIGNAL_REST_API_KEY }}
        run: node scripts/check-uv-reminders.mjs
