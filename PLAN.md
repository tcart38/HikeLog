# HikeLog build plan (contract for implementers)

Self-hosted Docker app to log hikes against peakbagging lists (NH 48, NE 67, NEHH, ADK 46,
14ers...), track all-season / winter / four-season / 12-month grid / snow-condition progress,
and compare people (e.g. Alex and Sam: who still needs what, what both still need).

## Stack (already scaffolded — do not re-scaffold)
- Next.js 16 App Router (read `node_modules/next/dist/docs/` before using unfamiliar APIs; middleware
  is now `proxy.ts`), React 19, TypeScript, Tailwind v4, pnpm.
- **shadcn/ui is THE design system** (preset `base-nova`, olive base, green primary, Inter). Components
  live in `components/ui/*` and are built on **Base UI** (`@base-ui/react`), NOT Radix: there is no
  `asChild`; use the `render` prop (read the component file before using it). Add more with
  `CI=1 pnpm dlx shadcn@latest add <name> < /dev/null`. Use the theme tokens in `app/globals.css`;
  do not invent a parallel palette. Icons: lucide-react.
- Storage: SQLite via Node's built-in `node:sqlite` (no native deps). DB file at `$DATA_DIR/hikelog.db`
  (default `./data/db`). Raw SQL helpers in `lib/db/index.ts` (`db()`, `all`, `get`, `run`, `tx`).
  Schema in `lib/db/migrations.ts` (append-only). Peak lists are seeded from `data/lists/*.json`
  on boot (`lib/db/seed.ts`).
- Validation: zod v4.

## Core libraries (done — reuse, don't duplicate)
- `lib/seasons.ts` — astronomical seasons (`seasonOf`, `isWinterHike`, `winterSeasonYear`, `monthOf`,
  `SEASONS`, `MONTH_LABEL`). Client-safe.
- `lib/peaks/normalize.ts` — `normalizePeakName`, `splitPeakNames`. Client-safe.
- `lib/peaks/match.ts` — `matchPeak`, `matchPeaks`, `searchPeaks`, `invalidatePeakCache`.
- `lib/auth.ts` — users, scrypt passwords, sessions (cookie `hikelog_session`), API tokens (`hk_...`),
  `currentUser()`, `authenticate(req)` (Bearer token or cookie + same-origin CSRF check),
  `signupOpen()`, `createUser`, `createSession`, `sessionCookieOptions`, `createApiToken`...
- `lib/hikes.ts` — `hikeInputSchema`, `saveHike(input, {userId, userPersonId, source, id?})`,
  `getHike`, `listHikes(filter)`, `deleteHike`, `HikeError` (has `.status`, `.details`).
- `lib/progress.ts` — `MODES`, `listLists`, `getList`, `listPeaks`, `listProgress(slug, personId, mode)`,
  `allListsProgress(personId, mode)`, `compare(slug, personIds, mode)`, `unitsFor`, `creditFor`.

Modes: `all | winter | spring | summer | fall | season (4 seasons) | grid (12 months) | snow | no_snow | mix`.

Data model notes: a **person** is anyone who hikes (may or may not have a login). Each user links to
one person (`users.person_id`). Hikes have peaks and participants (people). `hike_participants.counts=0`
means they came but don't get credit. Single shared household instance: every signed-in user can see
and edit everything (see DECISIONS.md).

## REST API (`/api/v1`, JSON, auth = `Authorization: Bearer hk_...` or session cookie)
Errors: `{ "error": string, "details"?: any }` with proper status codes.
- `POST /api/auth/signup` {username, password, displayName?} — only when `signupOpen()`; sets cookie.
- `POST /api/auth/login` {username, password} — sets cookie. `POST /api/auth/logout`.
- `GET /api/v1/me` → {user, person}
- `GET /api/v1/hikes?person=&peak=&list=&from=&to=&q=&limit=&offset=` → {hikes, total}
- `POST /api/v1/hikes` body = `hikeInputSchema` → 201 {hike, peakMatches}. Peaks may be names; agents
  can send `"peaks": ["Lafayette", "Lincoln"]`, `"participants": ["Sam"]`, `externalId` for idempotency.
- `GET|PATCH|DELETE /api/v1/hikes/:id` (PATCH takes full or partial input; merge with existing then saveHike)
- `GET /api/v1/peaks?q=&list=` ; `GET /api/v1/peaks/:idOrSlug` (with lists it belongs to + ascents by person)
- `POST /api/v1/peaks/match` {names: string[] | string, stateHint?, listHint?} → {results}
- `GET /api/v1/lists` (with peak_count) ; `GET /api/v1/lists/:slug` (with peaks, sources parsed)
- `GET /api/v1/lists/:slug/progress?person=<id>&mode=` (person defaults to caller's person)
- `GET /api/v1/progress?person=&mode=` (every list)
- `GET /api/v1/compare?list=<slug>&people=1,2&mode=`
- `GET|POST /api/v1/people` ; `PATCH|DELETE /api/v1/people/:id` ; `POST /api/v1/people/:id/merge` {into}
- `GET|POST /api/v1/tokens` (POST returns the plaintext token once) ; `DELETE /api/v1/tokens/:id`
- `GET|POST /api/v1/users` (admin: create user + person) ; `PATCH /api/v1/users/:id` (password, admin flag)
- `POST /api/v1/import/xlsx?dryRun=1` multipart `file` (+ fields `self` = person name/id for the log
  owner) → preview {rows: [{row, date, endDate, peaks: matches, participants, warnings}], summary};
  without dryRun commits and returns {created, updated, skipped}.
- `GET /api/openapi.json` (OpenAPI 3.1) and `/docs` (interactive docs page).

## Pages (desktop sidebar layout ≥ md, bottom tab bar on mobile; PWA)
- `/setup` first-run admin account (when no users) ; `/login`
- `/` Dashboard: my progress on pinned/most-active lists (mode toggle), recent hikes, quick "Log a hike".
- `/hikes` table (desktop) / cards (mobile), filters ; `/hikes/new` ; `/hikes/[id]` ; `/hikes/[id]/edit`
  Hike form: date (+ optional end date), peak multi-picker (search, chips), participants picker
  (people, add new inline), conditions (snow/no snow/mix), weather, trail conditions, distance,
  vert, route type, notes. Shows computed season + "counts for winter" badge live.
- `/lists` browse lists grouped by region, with my progress bar on each.
- `/lists/[slug]` peak table with status per mode; mode tabs: All · Winter · Four-season · Grid · Conditions;
  grid mode = peaks × 12 months matrix; four-season = peaks × 4 seasons; person switcher;
  "what's left" filter; list info (criteria, notes, sources with links).
- `/peaks/[slug]` peak detail: elevation, lists, every ascent by every person.
- `/people` people list ; `/compare?list=&people=&mode=` compare 2+ people: summary counts, sections
  "Both still need", "Only X needs", "Done by all", plus a per-peak matrix.
- `/settings` profile/password, API tokens (create/revoke, copy-once), users (admin), people,
  import spreadsheet (upload → preview → commit), link to /docs.

## Deployment
- `output: "standalone"`, Dockerfile (node:24-slim), docker-compose.yml with a named volume at `/data`.
- Custom domains: no host allow-list anywhere. Env: `APP_URL` (public base URL, e.g.
  https://hike.example.com), `ALLOWED_ORIGINS` (extra hosts for CSRF check), `DATA_DIR`, `APP_TIMEZONE`
  (default America/New_York), `ALLOW_SIGNUP`. UI mutations go through route handlers (not Server
  Actions) so reverse proxies that rewrite Host don't break anything.
