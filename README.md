# HikeLog

Self-hosted hike log for a household. Log a hike once and every peak list, season and person updates: who still needs what, and what you both still need.

![Dashboard](docs/screenshots/dashboard.png)

## Features

- **Lists and modes.** NH 48, NE 67, NEHH, NE 115, ADK 46, Catskill 3500, Maine/Vermont 4000s, NH 52 With a View, Southern Sixers, 14ers, state high points and more. Each list shows progress as All, Winter, Four-season, 12-month Grid, or Snow / No snow / Mix.
- **Compare.** Pick two or more people: "both still need", "only X needs", "done by all", plus a per-peak matrix.
- **Stats.** Peaks per year, season and month charts, partners.
- **Map and redlining.** GPS tracks per hike, peak map, and trail-network completion (AT, White Mountains, Adirondack High Peaks, Catskills) from OpenStreetMap.
- **Garmin import.** Pull hiking activities into a per-user inbox, get peak suggestions from the GPS track, import with one tap.
- **Spreadsheet import.** Upload your existing log (`.xlsx`) with a dry-run preview.
- **REST API and OpenAPI.** Everything the UI does is available to scripts and agents (`/docs`).
- **PWA.** Installable on iOS and Android, offline fallback page, phone tab bar with a "Log" button.

| Compare | Lists on a phone |
| --- | --- |
| ![Compare](docs/screenshots/compare.png) | ![List on mobile](docs/screenshots/list-mobile.png) |

## Quick start

```bash
git clone <this repo> hikelog && cd hikelog
cp .env.example .env        # set APP_URL to the URL you will use
docker compose up -d --build
```

Open http://localhost:3000. On first run you are sent to `/setup` to create the admin account. Data lives in the `hikelog-data` Docker volume (`/data` in the container): the SQLite database `hikelog.db` and a generated `secret.key`.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_URL` | `http://localhost:3000` (compose) | Public base URL. Used for secure cookies, the OpenAPI `servers` entry and the CSRF allow-list. |
| `ALLOWED_ORIGINS` | empty | Extra hosts (comma separated) allowed to POST with a session cookie. Rarely needed. |
| `ALLOWED_DEV_ORIGINS` | falls back to `ALLOWED_ORIGINS` | Extra hostnames for `pnpm dev` only (Next dev-server origin check). |
| `APP_TIMEZONE` | `America/New_York` | Zone used to decide which season a date falls in. Client and server both use it. |
| `ALLOW_SIGNUP` | `false` | `true` lets anyone create an account at `/setup`. The first account is always allowed and becomes admin. |
| `DATA_DIR` | `/data` in Docker, `./data/db` in dev | Where `hikelog.db` and `secret.key` live. |
| `APP_SECRET` | generated into `$DATA_DIR/secret.key` | Encrypts stored Garmin keys and tokens. Back it up with the DB. |
| `MAP_STYLE_URL` | OpenFreeMap (light/dark) | MapLibre style JSON URL for the maps. |
| `OVERPASS_URL` | public mirrors | Comma separated Overpass endpoints for trail-network downloads. |
| `OVERPASS_CONTACT` | empty | Email or URL appended to the Overpass User-Agent (their usage policy asks for contact info). |
| `GARMIN_SYNC_INTERVAL_MIN` | off | Auto-sync interval for connected users. |
| `GARMIN_ACTIVITY_TYPES` | `hiking,mountaineering,backpacking,snowshoeing` | Garmin activity types that become candidates. |
| `GARMIN_INITIAL_SYNC_DAYS` | `365` | First-sync lookback. |
| `GARMIN_PEAK_RADIUS_M`, `GARMIN_PEAK_ELEV_TOLERANCE_FT` | `150`, `300` | Track-to-peak matching. |
| `GARMIN_TOKEN_URL`, `GARMIN_API_BASE`, `GARMIN_ACTIVITIES_PATH`, `GARMIN_GPX_PATH` | Garmin defaults | Endpoint overrides, see [docs/garmin.md](docs/garmin.md). |
| `HIKELOG_PORT` | `3000` | Host port in `docker-compose.yml`. |

## Behind a reverse proxy / custom domain

HikeLog has **no host allow-list**: it works on whatever domain reaches it. Two things matter:

1. Forward `Host` or `X-Forwarded-Host`, and `X-Forwarded-Proto`. Cookies become `Secure` when the proto is https, and the CSRF check compares the browser `Origin` to the forwarded host.
2. Set `APP_URL=https://hike.example.com` so absolute URLs are right even without forwarded headers.

Caddy:

```caddy
hike.example.com {
    reverse_proxy hikelog:3000
}
```

Nginx Proxy Manager: proxy host `hike.example.com` to `hikelog:3000`, scheme `http`, enable SSL, and keep "Websockets Support" on. NPM forwards `X-Forwarded-Host/Proto` by default.

Traefik (labels on the service):

```yaml
labels:
  - traefik.enable=true
  - traefik.http.routers.hikelog.rule=Host(`hike.example.com`)
  - traefik.http.routers.hikelog.entrypoints=websecure
  - traefik.http.routers.hikelog.tls.certresolver=letsencrypt
  - traefik.http.services.hikelog.loadbalancer.server.port=3000
```

Cloudflare Tunnel: public hostname `hike.example.com` pointing at `http://hikelog:3000` (or `http://localhost:3000`). Cloudflare sets the forwarded headers.

Service workers and "Add to Home Screen" need https (localhost is exempt).

## First run, people and users

- A **person** is anyone who hikes (Sam, Jordan, a friend). A **user** is a login linked to one person.
- The first signup becomes admin and creates your person. Add family members as people in **People** straight away, even if they never log in, then log hikes with them as participants.
- Give someone a login from **Settings > Users** (admin), or set `ALLOW_SIGNUP=true` temporarily. Signing up with the display name of an existing person links to that person.
- Participants can be "along but not counted". Everyone signed in sees and edits everything (single shared household).

## Importing your spreadsheet

**Settings > Import**: upload the `.xlsx`, review the preview (matches, warnings, unmatched peak names), then commit. Re-importing updates rather than duplicates. Scripted: `POST /api/v1/import/xlsx?dryRun=1` with multipart `file` (and `self` = the log owner's person name).

## API quick start (agents)

Create a token in **Settings > API tokens** (shown once), then:

```bash
curl -X POST https://hike.example.com/api/v1/hikes \
  -H "Authorization: Bearer hk_..." -H "Content-Type: application/json" \
  -d '{"date":"2026-09-07","peaks":["Lafayette","Lincoln"],"participants":["Sam"],"conditions":"no_snow","externalId":"trip-2026-09-07"}'
```

Peak and person names are matched for you (unmatched peaks are kept as text unless `"strictPeaks": true`), and `externalId` makes the call idempotent. Interactive docs at `/docs`, machine-readable spec at `/api/openapi.json`.

## Backups

All state is the volume. Simplest: stop the container and copy `hikelog.db` and `secret.key` from it. Online, consistent copy:

```bash
docker compose exec hikelog node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/hikelog.db').exec(\"VACUUM INTO '/data/backup.db'\")"
docker compose cp hikelog:/data/backup.db ./hikelog-backup.db
```

(or `sqlite3 hikelog.db ".backup backup.db"` on a host with sqlite3 and the file copied out).

## Development

```bash
pnpm install
pnpm dev            # http://localhost:3000, data in ./data/db
pnpm typecheck && pnpm lint && pnpm build
node scripts/generate-icons.mjs   # regenerate public/icons from app/icon.svg
```

Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui on Base UI, SQLite via Node's built-in `node:sqlite` (Node 24+). Read `AGENTS.md` before changing framework code.

## Data sources

Peak lists live in `data/lists/*.json` and are seeded on boot; every file carries its own cited sources and notes.

| List | Main sources |
| --- | --- |
| NH 48, NE 67, Maine, Vermont 4000s | [4000footers.com](https://4000footers.com/), [AMC Four Thousand Footer Committee](https://amc4000footer.org/) |
| NEHH, NE 115 | [AMC 4000-footer committee](https://amc4000footer.org/newenglandhundredhighest.html), [Wikipedia: Northeast 111](https://en.wikipedia.org/wiki/Northeast_111) |
| NH 52 With a View | [Scenic NH](https://www.scenicnh.com/new-hampshire-52-with-a-view/) |
| ADK 46 | [Adirondack 46ers](https://adk46er.org/) |
| Catskill 3500 | [Catskill 3500 Club](https://www.catskill3500club.org/peaks) |
| Southern Sixers | [Wikipedia](https://en.wikipedia.org/wiki/Southern_Sixers), [Carolina Mountain Club](https://www.carolinamountainclub.org/) |
| CO and CA 14ers | [Wikipedia CO](https://en.wikipedia.org/wiki/List_of_Colorado_fourteeners), [Wikipedia CA](https://en.wikipedia.org/wiki/List_of_California_14,000-foot_summits) |
| US state high points | [Wikipedia](https://en.wikipedia.org/wiki/List_of_U.S._states_and_territories_by_elevation), [Highpointers Club](https://www.highpointers.org/) |
| WA Bulgers and volcanoes, Cascade volcanoes | [Bulger list](https://rhinoclimbs.com/the-bulgers/), [Cascade Volcanoes](https://en.wikipedia.org/wiki/Cascade_Volcanoes) |

Trail networks (definitions in `data/networks`, geometry downloaded on demand) and many peak coordinates come from **OpenStreetMap** via the Overpass API. (c) OpenStreetMap contributors, available under the [Open Database License](https://www.openstreetmap.org/copyright). Any derived trail or peak data you export carries the same attribution. Base map tiles come from OpenFreeMap / OpenMapTiles unless you set `MAP_STYLE_URL`.

## Caveats

- Winter is **astronomical** (Dec solstice to Mar equinox) for every list, and a winter ascent must start and end inside one winter. The Catskill 3500 Club uses fixed Dec 21 to Mar 21 dates; the difference is at most a day.
- Catskill 3500 is seeded with the historical 35 peaks (the club now requires 33).
- About 40 peaks have no coordinates, so GPS-track matching can't suggest them; title matching still works.
- The Garmin Personal API endpoints and response shapes are not verified against a real account yet, see [docs/garmin.md](docs/garmin.md).
- Downloading a trail network from Overpass can take several minutes.
- Single shared household instance: every signed-in user can see and edit everything.
- Offline support is a fallback page plus cached static assets and recently visited pages; logging a hike needs a connection.

See `DECISIONS.md` for the reasoning behind these choices.
