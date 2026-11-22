# Import sources

Settings > Activity import lets each person pick where their hikes come from. All sources feed the same inbox ("To review"): each activity arrives with peaks suggested from its GPS track (or its title), and nothing is added to your log until you confirm it.

| Source | Auth | Official? | Main risk |
|---|---|---|---|
| Garmin Personal API | Personal API key you create at Garmin | Yes | Keys expire; Garmin rate-limits (HTTP 429). See [garmin.md](garmin.md). |
| Garmin Connect login | Garmin email + password (+ MFA code) | **No** | Against Garmin's ToS, can break any time. |
| Strava | Your own free Strava API app, OAuth | Yes | Rate limits; per-person app setup. |
| GPX / FIT files | None | n/a | Manual export. |

## Garmin Connect login (unofficial)

Uses the open-source [python-garminconnect](https://github.com/cyberjunky/python-garminconnect) library through `scripts/garmin_bridge.py` (a subprocess; Python and the library live in a venv at `/opt/garmin` in the Docker image; override with `GARMIN_BRIDGE_PYTHON` / `GARMIN_BRIDGE_SCRIPT`).

- It imitates Garmin's mobile app login. Garmin has changed that login several times (breaking this and similar tools each time) and it is outside their Terms of Service. If it stops working, rebuild the image (`docker-compose build --no-cache && docker-compose up -d`) to pull the library's latest fix, or switch to another source.
- The password is sent to Garmin once and is **not stored**. HikeLog keeps only the session tokens, AES-256-GCM encrypted with `APP_SECRET`. When the session expires, sign in again.
- Garmin rate-limits logins. On HTTP 429 wait 30+ minutes; do not retry in a loop.
- Each Sync downloads up to 25 new activities. If there are more it tells you; press Sync again.
- Not part of the optional auto-sync.

## Strava

1. At https://www.strava.com/settings/api create an app (free). Set **Authorization Callback Domain** to the host you use for HikeLog (the page shows it, e.g. `192.168.x.x` or `hike.example.com`).
2. Paste the Client ID and Client Secret into HikeLog, then press Authorise with Strava.
3. If Strava refuses your host as a callback domain, set it to `localhost`, use the "paste route" (authorise, then paste the address of the page that fails to load).

Scope is `read,activity:read_all` (needed for private activities). Imports hikes, walks and snowshoes with their GPS streams. New Strava apps may be limited to one connected athlete until reviewed, which is fine for personal use. Default API limits are 100 requests / 15 min and 1,000 / day, so each Sync takes at most 30 new activities and says if there are more.

There is deliberately no scraping/"reverse-engineered" Strava option: those tools use your website session cookies, break often and put the account at risk, and the official API is free.

## GPX / FIT files

Drop `.gpx` or `.fit` files on the page (or use the API: `POST /api/v1/import/files`, multipart `file` parts). Name comes from the track name or file name, the date from the first timestamp (in `APP_TIMEZONE`), and distance, elevation gain and duration are computed from the points.

## API

`GET /api/v1/import/sources`, `PUT|DELETE /api/v1/import/garmin-connect/connection`, `POST /api/v1/import/garmin-connect/sync`, `GET|PUT|DELETE /api/v1/import/strava/connection`, `POST /api/v1/import/strava/authorize`, `POST /api/v1/import/strava/sync`, `POST /api/v1/import/files`. The inbox endpoints (`/api/v1/garmin/activities...`) cover all sources. See `/docs`.
