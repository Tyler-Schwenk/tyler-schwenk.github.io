# Trash Reminder Service

Automated weekly SMS alerts that remind you and your roommates to take out the trash. Runs as part of the website-backend service on fart-pi.

## How It Works

1. Every Thursday at the configured hour (default 6 PM), a text goes out to all roommates
2. If no one replies, a follow-up text goes out every hour until confirmed
3. Anyone can reply with "done", "yes", "took it", etc. to stop the reminders for the week
4. When confirmed, everyone gets a "trash is out!" confirmation text
5. Reminders pause during quiet hours (default 10 PM to 8 AM)
6. Follow-ups stop after Friday — if it's Saturday and nobody took it out, you're on your own

## Twilio Setup

### 1. Create a Twilio account

- Sign up at https://www.twilio.com
- Get your Account SID and Auth Token from the console dashboard

### 2. Buy a phone number

- In the Twilio console: Phone Numbers > Manage > Buy a number
- Get a US number with SMS capability (~$1/month)

### 3. Configure the webhook

- In the Twilio console, go to your phone number's configuration
- Under "Messaging", set "A message comes in" to:
  - Webhook: `https://api.tyler-schwenk.com/trash/reply`
  - Method: HTTP POST
- Save

### 4. Add environment variables to `.env`

In `pi/services/website-backend/.env`:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567

# comma-separated E.164 phone numbers for all roommates (including yourself)
ROOMMATE_PHONES=+15551111111,+15552222222,+15553333333
```

### 5. Redeploy

```bash
cd ~/tyler-schwenk.github.io/pi/services/website-backend
docker compose down
docker compose up -d --build
```

## Configuration

All settings have defaults. Override via environment variables:

| Variable | Default | Description |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | (required) | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | (required) | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | (required) | Your Twilio number (E.164) |
| `ROOMMATE_PHONES` | (required) | Comma-separated E.164 numbers |
| `TRASH_REMINDER_HOUR` | `18` | Hour to send initial reminder (24h, local tz) |
| `TRASH_TIMEZONE` | `America/Los_Angeles` | Timezone for scheduling |
| `TRASH_QUIET_START_HOUR` | `22` | Suppress texts from this hour... |
| `TRASH_QUIET_END_HOUR` | `8` | ...until this hour |
| `TRASH_INITIAL_MESSAGE` | (see code) | Text of the first reminder |
| `TRASH_FOLLOWUP_MESSAGE` | (see code) | Text of hourly follow-ups |
| `TRASH_WEBHOOK_URL` | `https://api.tyler-schwenk.com/trash/reply` | Must match Twilio console exactly |

## API Endpoints

### `GET /trash/status`

Returns the current week's reminder state — useful for debugging.

```json
{
  "current_week": "2026-W19",
  "state": {
    "week_iso": "2026-W19",
    "confirmed": false,
    "confirmed_by": null,
    "last_sent": "2026-05-07T18:00:00.123456"
  }
}
```

### `POST /trash/reply`

Twilio webhook — not for direct use. Validates the Twilio signature and marks the week confirmed if the sender is a known roommate and the message contains a confirmation keyword.

Confirmation keywords: done, yes, took, got it, yep, yup, did it, i did, taken, out, finished

## State File

State is persisted at `/app/data/trash_state.json` (inside the container, mapped to `./data/` on the host). It resets each Thursday when the initial reminder fires.

Example:
```json
{
  "week_iso": "2026-W19",
  "confirmed": true,
  "confirmed_by": "+15551111111",
  "last_sent": "2026-05-07T19:00:00.000000"
}
```

## Disabling

If you want to temporarily disable reminders without removing the config, leave `TWILIO_ACCOUNT_SID` or `ROOMMATE_PHONES` unset — the scheduler won't register jobs and will log a warning instead.
