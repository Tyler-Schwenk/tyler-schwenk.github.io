# pac-tyler-updater

daily script that fetches new Strava activities and writes updated GeoJSON and
activity dataset files to disk. runs headlessly on fart-pi via systemd timer.
the website-backend FastAPI service then serves those files to the frontend.

## how it works

1. loads saved Strava token from `TOKEN_FILE` (default: `/home/tyler/pac-tyler-data/strava_token.json`)
2. refreshes the token if its expired
3. fetches any activities newer than the most recent one in the existing GeoJSON
4. applies a lookback window (`RECENT_ACTIVITY_LOOKBACK_DAYS`) to catch late uploads
5. deduplicates by `activity_id`, splits GPS tracks at large gaps, normalizes coords
6. writes `cleaned_output.geojson` and `pac-tyler-activities.json` to `DATA_DIR`

the website-backend API serves those two files at:
- `GET /pac-tyler/geojson`
- `GET /pac-tyler/activities`

## first-time setup

### 1. create the data directory

```bash
mkdir -p /home/tyler/pac-tyler-data
```

### 2. seed the geojson (if you have existing data)

copy your existing `cleaned_output.geojson` into the data dir:
```bash
cp /path/to/old/cleaned_output.geojson /home/tyler/pac-tyler-data/
```

### 3. create a virtualenv and install deps

```bash
cd ~/tyler-schwenk.github.io/pi/services/pac-tyler-updater
python3 -m venv /home/tyler/pac-tyler-venv
/home/tyler/pac-tyler-venv/bin/pip install -r requirements.txt
```

### 4. create the .env file

```bash
cp .env.example .env
# edit .env and fill in CLIENT_ID and CLIENT_SECRET from your Strava app
```

`.env` contents:
```
CLIENT_ID=your_strava_client_id
CLIENT_SECRET=your_strava_client_secret
```

### 5. do the one-time browser auth

run this from a machine that has a browser (can be your dev machine or the Pi via X forwarding):
```bash
cd ~/tyler-schwenk.github.io/pi/services/pac-tyler-updater
/home/tyler/pac-tyler-venv/bin/python auth_setup.py
```

this opens Strava in the browser, captures the callback, and saves a token to
`/home/tyler/pac-tyler-data/strava_token.json`. after this, the Pi can run
headlessly forever (tokens auto-refresh).

### 6. test a manual run

```bash
/home/tyler/pac-tyler-venv/bin/python main.py
```

### 7. install the systemd timer

```bash
sudo cp pac-tyler-updater.service /etc/systemd/system/
sudo cp pac-tyler-updater.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pac-tyler-updater.timer
```

check status:
```bash
systemctl status pac-tyler-updater.timer
journalctl -u pac-tyler-updater.service -n 50
```

## configuration

all paths and tuning values are in `config.py`. override the data dir with
the `PAC_TYLER_DATA_DIR` environment variable if needed.

key env vars (in `.env`):
| variable | description |
|---|---|
| `CLIENT_ID` | Strava app client ID |
| `CLIENT_SECRET` | Strava app client secret |
| `PAC_TYLER_DATA_DIR` | override for data directory (optional) |
| `PAC_TYLER_LOOKBACK_DAYS` | days to look back from most recent activity (optional) |

## file structure

```
pac-tyler-updater/
├── config.py             centralized constants and path config
├── main.py               headless daily entry point
├── auth_setup.py         one-time browser OAuth to bootstrap token
├── requirements.txt
├── pac-tyler-updater.service
├── pac-tyler-updater.timer
└── utils/
    ├── strava_client.py  strava API wrapper with refresh token support
    ├── file_utils.py     read/write GeoJSON and JSON
    ├── activity_dataset.py  build flat activity list for frontend charts
    ├── geojson_cleaner.py   normalize coords, types, dates
    ├── separate_pauses.py   split tracks at GPS pauses
    └── oauth_server.py   one-shot HTTP server for OAuth callback
```
