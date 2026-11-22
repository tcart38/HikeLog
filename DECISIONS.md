# Decisions

## Overnight build summary

**Built:** household hike log with people vs users and a shared instance; 16 seeded peak lists (NH 48, NE 67,
NEHH, NE 115, ADK 46, Catskill 3500, ME/VT 4000s, 52 With a View, Southern Sixers, CO/CA 14ers, state high
points, WA/Cascade lists) with modes All / Winter / Four-season / 12-month Grid / Snow-No snow-Mix; hike
form with live season and "counts for winter" badge; compare page; stats page and dashboard highlights;
map, GPS tracks, trail networks and redlining (AT, White Mountains, ADK High Peaks, Catskills) from OSM;
Garmin Personal API import with per-user keys and an activity inbox; spreadsheet import; REST API with
bearer tokens, OpenAPI 3.1 and `/docs`; installable PWA (PNG + maskable + Apple icons, service worker with
offline fallback, theme colors); phone tab bar (Home, Lists, Log, Map, More sheet); Docker image
(~434 MB, non-root, health check, volume at `/data`); README.

**Check first:**
1. **Garmin endpoints are unverified against a real account** (data API host, token response shape, GPX
   route). Connect, Sync now, read "last error" on `/settings/garmin`; fixes are isolated in `lib/garmin/`.
2. **Overpass downloads take minutes** (shared public servers, tiled requests, retries). Start one network
   at a time from `/redlining`; set `OVERPASS_CONTACT`.
3. **40 peaks lack coordinates** (ambiguous in OSM), so GPS-track suggestions skip them; title matching works.
4. Set `APP_URL` to your real domain before installing the PWA on phones (https required for the service worker).
5. Import your spreadsheet, then skim the dry-run warnings for unmatched peak names and ambiguous dates.
6. Catskill 3500 uses the historical 35 peaks; winter is astronomical everywhere (see below).
7. Service worker caches only static assets and visited pages (cleared on sign-out); API responses are never
   cached. Bump `CACHE_VERSION` in `public/sw.js` to force a refresh.
8. Docker verified on colima with `docker-compose` (the standalone binary); the `docker compose` plugin was not linked.

Choices made while building autonomously overnight (2026-11-21). Each one is easy to revisit.

## Platform
- **Next.js 16 + shadcn (your preset `b6rtA2Hia`)** scaffolded with exactly your command. shadcn is the
  design system: every screen uses its components and theme tokens. Impeccable and UI UX Pro Max were
  used only for planning and layout guidance (the UI UX Pro Max design-system output lives in
  `design-system/` for reference; its dark slate palette was *not* adopted because your preset wins).
- **Impeccable** installed with `npx impeccable install`; it chose the global Claude Code location (`~/.claude`).
- **UI UX Pro Max v2:** running the `uipro` installer was blocked by my permission guard (it installs
  agent skills/hooks). The copy already in `~/.claude/skills/ui-ux-pro-max` has the v2 design-system
  generator, so I used that. If you want the CLI version anyway, run `npx -p ui-ux-pro-max-cli uipro init --ai claude` yourself.
- **SQLite via Node's built-in `node:sqlite`** instead of better-sqlite3/Drizzle: no native module to
  compile in Docker, one file on a volume, trivial backups (`hikelog.db`). Raw SQL, append-only migrations.
- **Installed Docker tooling with Homebrew** (`colima`, `docker`, `docker-compose`, `docker-buildx`) because
  the Mac had no Docker, and you asked me to verify the build locally. `colima stop` shuts the VM down.

## Data model
- **People vs users.** A *person* is anyone who hikes (Sam, Jordan, Riley...). A *user* is a login, linked
  to one person. You can track Sam's progress before she ever has an account; when she signs up
  with the same display name, her account links to her existing person.
- **One shared household instance.** Every signed-in user can view and edit all hikes and people. Simpler
  than per-user privacy for a family server; revisit if you open it to friends.
- **Participants can be "along but not counted"** (`counts = 0`), for cases like "Sam ish".
- **Peaks are shared across lists** (Washington is in NH 48, NE 67, NEHH, NE 115 and state high points), so
  one hike credits every list at once.

## Seasons and modes
- **Winter = astronomical winter** (December solstice to March equinox), computed with Meeus' algorithm in
  `APP_TIMEZONE` (default America/New_York). This matches the AMC, ADK 46er and Catskill 3500 rules.
  At date resolution the solstice day counts as winter and the equinox day counts as spring.
- **A winter ascent must start and end inside the same winter** (AMC rule), so multi-day trips that cross
  the equinox don't count.
- **Four-season** = the peak in each astronomical season; the winter slot needs a valid winter ascent.
- **Grid** = the peak in each of the 12 calendar months, using the hike's start date.
- **Snow / No snow / Mix** tracked as hike conditions, because your spreadsheet tracks them per peak.

## Peak lists
Researched by subagents with sources cited inside each `data/lists/*.json`. Known caveats:
- Catskill 3500 is seeded with the historical 35 peaks; the club cut the required list to 33 in 2021
  (Graham and Doubletop closed). Both are flagged in notes. The 4 winter-required peaks are flagged.
- Elevations follow 4000footers.com/AMC for New England (e.g. Lafayette 5,260, Tecumseh 4,003).
- Coordinates are only included where a source had them (ADK 46, CO/CA 14ers, state high points,
  volcanoes). No coordinates were guessed.
- Utah 13ers were skipped (no clean authoritative list found).
- NE 111/115: 115 = NE 67 + ADK 46 + Slide + Hunter.
- WA Bulgers ranges are coarse groupings, not from a source.

## API
- Bearer tokens (`hk_...`) per user, stored hashed, shown once. Sessions use an httpOnly cookie.
- Agents can send peak *names* instead of ids; unknown names are kept on the hike as "unmatched" text
  unless `strictPeaks: true`. `externalId` makes posting idempotent.
- UI mutations go through the REST route handlers rather than Server Actions, which keeps reverse
  proxies / custom domains from tripping Next's Server Action origin check.

## Custom domain
- No host allow-list anywhere. CSRF protection compares the browser `Origin` to the forwarded host,
  `Host`, `APP_URL` and `ALLOWED_ORIGINS`, so it works at `https://hike.example.com` behind Caddy/Traefik/
  Cloudflare Tunnel/NPM without extra config.
- Catskill 3500 Club by-laws define winter as Dec 21 – Mar 21 inclusive (fixed dates). The app uses
  astronomical winter for every list; the difference is at most a day at each end.
- Coordinates for 370 more peaks were matched from OpenStreetMap `natural=peak` nodes (name + elevation
  within 60 ft, inside the state). 40 ambiguous/unmatched peaks were left without coordinates.


## Follow-up round (2026-11-22)

- **Settings is a section** (Account, Lists, People, Import & export, Garmin, API & tokens). The pages drop down under Settings in the sidebar; on phones they are a chip row at the top of every settings page. API docs are the `/docs` page embedded in an iframe next to the token manager.
- **Lists are opt-out by default only until you start them.** A list shows in the nav, `/lists` and the dashboard once the signed-in person has any ascent on it. Settings > Lists can pin an unstarted list ("show") or hide a started one ("hide"). Stored per login in `user_prefs`.
- **View toggles** (All, Winter, Four-season, Grid, Conditions) are per login: a default set for every list plus an optional override per list. At least one view must stay on. The dashboard only offers modes some list still has on.
- **Terrifying 25 is a trail list, not a peak list.** Each trail is a row in `peaks` with `kind = 'trail'` (no elevation, excluded from peak stats), so you log it by picking it in the peak picker like any other item. 20 trails are required and 5 of the 14 electives complete it, so `lists.electives_needed = 5` and progress counts all required items plus at most 5 electives. Source: newenglandwaterfalls.com table (required/elective split and class ratings); Trailspotting cross-checked. Compare shows every trail as plain items and does not apply the "any 5 electives" rule.
- **Photos and videos** are files in `$DATA_DIR/media/<hikeId>/`, rows in `hike_media`. Uploads stream to disk (raw body or multipart). Limits: 60 MB photos, 1 GB videos. No thumbnails are generated (originals are served; the grid uses CSS cropping). HEIC is stored but only Safari displays it.
- **Weather uses Open-Meteo, not Mountain Forecast.** Mountain Forecast (Snow-Forecast.com Ltd.) publishes no API and its terms are for personal use of the site and app, so scraping it is out. Open-Meteo is free for non-commercial use, needs no key, has hourly ERA5 history back to 1940 and a forecast service for recent days, and corrects temperature to a given elevation. Caveat: wind is modelled at 10 m on a ~10 km grid, so summit wind and gusts are underestimated. Attribution (CC BY 4.0) is shown on each hike. Imported weather is stored in `hikes.weather_json` and never overwrites your own weather note.
- **Export:** JSON (everything except media files), `hikes.csv`, `ascents.csv`, and an admin-only SQLite snapshot (`VACUUM INTO`). Media is not inside the downloads; back up the data volume to get it.
- **People page bug:** the page imported `initials` from a `"use client"` file and called it on the server. It now lives in `lib/format.ts`.
