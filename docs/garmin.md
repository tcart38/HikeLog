# Garmin import

Pulls hiking activities from Garmin Connect into a per-user inbox, suggests peaks, and lets you import each one as a hike. Nothing is ever imported automatically.

## Setup (each household member does this once)
1. Sign in to HikeLog with your own account, open `/settings/garmin`.
2. On Garmin Connect (web) open https://connect.garmin.com/app/settings/personalApiToken, choose Create Key, accept the terms, pick an expiry (30/90/180 days or 1 year), Create.
3. Copy the key immediately (Garmin shows it once) and paste it into HikeLog. HikeLog validates it by exchanging it for a token, then stores it encrypted.
4. Hit Sync now. The first sync looks back 365 days. Review each card: toggle suggested peaks, add others, pick participants, Import or Ignore.
5. When the key expires (Garmin emails a week ahead), create a new one and use "Replace key".

Each user has their own connection and inbox; nobody can see or act on another user's activities. Imported hikes are normal shared hikes (externalId `garmin:<activityId>`, source `api`), so re-importing never duplicates.

## Environment variables
| Var | Default | Purpose |
| --- | --- | --- |
| `APP_SECRET` | generated | Derives the AES-256-GCM key that encrypts stored API keys and tokens. If unset, a random secret is created once in `$DATA_DIR/secret.key` (0600). Back it up with the DB: without it stored keys can't be decrypted (just re-paste them). |
| `GARMIN_SYNC_INTERVAL_MIN` | off | Sync every connected user on this interval (via `instrumentation.ts`, Node runtime only). Adds suggestions only. |
| `GARMIN_TOKEN_URL` | Garmin's documented URL | Override the token endpoint (used by the mock test). |
| `GARMIN_API_BASE` | `https://personal.connectapi.garmin.com` | Data API host (assumed, see below). |
| `GARMIN_ACTIVITIES_PATH`, `GARMIN_GPX_PATH` | see `lib/garmin/config.ts` | Endpoint paths (`{id}` placeholder in the GPX path). |
| `GARMIN_ACTIVITY_TYPES` | `hiking,mountaineering,backpacking,snowshoeing` | Activity typeKeys that become candidates (add `walking`, `trail_running`...). |
| `GARMIN_INITIAL_SYNC_DAYS` | 365 | First-sync lookback. |
| `GARMIN_PEAK_RADIUS_M` / `GARMIN_PEAK_ELEV_TOLERANCE_FT` | 150 / 300 | Track-to-peak matching. |

## API
`GET/PUT/DELETE /api/v1/garmin/connection`, `POST /api/v1/garmin/sync`, `GET /api/v1/garmin/activities?status=`, `POST /api/v1/garmin/activities/:id/import`, `POST /api/v1/garmin/activities/:id/ignore` (`:id` is the inbox id). See `/docs`.

## Peak suggestions
(a) track: a GPS point within 150 m of a peak that has lat/lon and whose elevation is within 300 ft of the peak's; (b) title: peak names in the activity name, split on commas, `&`, `/`, "and", dashes, via matchPeaks. Only peaks with coordinates can match by track (currently mainly state high points, ADK 46, 14ers; the NH 48 seed has none, except Mount Washington via the state high points list). Title matching works for every peak.

## Verified vs assumed
Verified against Garmin's Personal API FAQ (developer.garmin.com/gc-developer-program/personal/personal-faq/):
- Key page URL; expiry options; key shown once.
- Token exchange: `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token` with `Authorization: ApiKey <key>`; OAuth2 access token valid 24 h or until key expiry; no refresh tokens (we re-exchange).
- Data is pull-only; activities available as JSON and FIT.
- Endpoint paths from Garmin's own `connect-personal-api-python` README: `/activitylist-service/activities/search/activities?start=&limit=&startDate=&endDate=`, `/activity-service/activity/{id}`, `/download-service/files/activity/{id}` (ZIP).

Assumed (unconfirmed; all isolated in `lib/garmin/config.ts` / `client.ts`, with TODOs):
- Data API host equals the token host (docs only give paths).
- Token response shape (`access_token` + `expires_in`; falls back to JWT `exp`, then 24 h) and `Authorization: Bearer` for data calls.
- Activity list is a JSON array (or `{activities: []}`) with `activityId`, `activityName`, `activityType.typeKey`, `startTimeLocal`, `distance` (m), `elevationGain` (m), `duration` (s), `startLatitude/Longitude`.
- GPS track via a GPX endpoint (`/download-service/export/gpx/activity/{id}`, from Garmin Connect's unofficial web API). The documented route returns a FIT ZIP, which we do not parse (no dependency added). If the GPX call fails the activity still imports; suggestions fall back to the title.
- Rate limits are not published; we make one list call per page of 100 plus one track call per new activity.
- Reports say Garmin strips some fields from API FIT files; irrelevant to GPS/elevation.

Test the real thing first: connect, Sync now, and check `last error` on the page. If field names or paths differ, adjust `parseActivity` / the env path overrides.

## Testing
`scripts/garmin-mock-test.mjs` runs a mocked Garmin server (activities near Mount Washington 44.2706,-71.3033) and exercises connect, sync, suggestions, import, ignore and per-user isolation against a running dev server. Start the app with `GARMIN_TOKEN_URL=http://127.0.0.1:3399/token GARMIN_API_BASE=http://127.0.0.1:3399 ALLOW_SIGNUP=true` and a fresh `DATA_DIR`, on port 3300, then `node scripts/garmin-mock-test.mjs`.
