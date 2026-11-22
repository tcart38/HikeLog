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
