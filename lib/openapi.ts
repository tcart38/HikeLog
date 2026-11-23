/* Hand-written OpenAPI 3.1 document for the HikeLog REST API. Keep in sync with app/api/**. */

import { APP_VERSION } from "@/lib/version"

type Json = Record<string, unknown>
const ref = (n: string) => ({ $ref: `#/components/schemas/${n}` })
const obj = (properties: Json, required?: string[]): Json => ({ type: "object", properties, ...(required ? { required } : {}) })
const arr = (items: Json) => ({ type: "array", items })
const str = (description?: string, extra: Json = {}): Json => ({ type: "string", ...(description ? { description } : {}), ...extra })
const int = (description?: string): Json => ({ type: "integer", ...(description ? { description } : {}) })
const nullable = (s: Json): Json => ({ ...s, type: [s.type as string, "null"] })
const body = (schema: Json, example?: unknown) => ({
  required: true,
  content: { "application/json": { schema, ...(example !== undefined ? { example } : {}) } },
})
const ok = (description: string, schema?: Json, status = "200") => ({
  [status]: schema ? { description, content: { "application/json": { schema } } } : { description },
})
const errs = (...codes: string[]) =>
  Object.fromEntries(codes.map((c) => [c, { $ref: `#/components/responses/E${c}` }]))
const idParam = (name = "id", description = "Numeric id") => ({ name, in: "path", required: true, schema: { type: "integer" }, description })
const q = (name: string, description: string, schema: Json = { type: "string" }) => ({ name, in: "query", description, schema })
const modeParam = q("mode", "Tracking mode. `season` = four-season (peak in each of winter/spring/summer/fall), `grid` = 12 calendar months, `winter` = astronomical winter.", {
  type: "string",
  enum: ["all", "winter", "spring", "summer", "fall", "season", "grid", "snow", "no_snow", "mix"],
  default: "all",
})
const personParam = q("person", "Person id or name. Defaults to the caller's own person.")

const DESCRIPTION = `HikeLog tracks hikes against peakbagging lists (NH 48, NE 67, NEHH, ADK 46, 14ers...) and computes all-season, winter, four-season, 12-month grid and snow-condition progress for each person.

## For AI agents: quick start

**To log a hike:** \`POST /api/v1/hikes\` with \`{"date":"2026-01-17","peaks":["Lafayette","Lincoln"],"participants":["Sam"]}\`.

- Peaks can be **names** ("Mount Lafayette", "Owl's Head", "Wildcat A"), **slugs** or **ids**. Names are fuzzy-matched; check \`peakMatches\` in the response. Unmatched names are kept on the hike as \`unmatchedPeaks\` unless you send \`"strictPeaks": true\` (then 422). Use \`POST /api/v1/peaks/match\` to preview matching and \`stateHint\`/\`listHint\` to disambiguate (e.g. "Mount Abraham" in VT vs ME).
- Participants can be **person names**: unknown names create new people. Omit \`participants\` to log it for yourself. Use \`{"person":"Sam","counts":false}\` for someone who came along but gets no credit.
- Send a stable \`externalId\` to make the call **idempotent**: re-posting the same \`externalId\` updates the existing hike (200) instead of creating a duplicate (201).
- Seasons are computed from the date (astronomical, in the server time zone); never send them. A hike counts for winter only if it starts and ends inside one winter.

**Authentication:** create a token in Settings (or \`POST /api/v1/tokens\` while signed in) and send \`Authorization: Bearer hk_...\`. Errors are always \`{"error": string, "details"?: any}\`.

**Reading progress:** \`GET /api/v1/progress?person=Alex&mode=winter\`, \`GET /api/v1/lists/nh-48/progress?mode=grid\`, \`GET /api/v1/compare?list=nh-48&people=Alex,Sam\`. Responses use camelCase keys.`

const hikeInputExample = {
  date: "2026-01-17",
  endDate: "2026-01-18",
  peaks: ["Lafayette", "Lincoln"],
  participants: ["Sam", { person: "Jordan", counts: false, note: "turned around" }],
  conditions: "snow",
  weather: "Clear, windy on the ridge",
  notes: "Franconia Ridge loop",
  externalId: "my-agent:2026-01-17:franconia",
}

export function buildOpenApi(serverUrl: string): Json {
  const schemas: Record<string, Json> = {
    Error: obj({ error: str(), details: { description: "Extra context, e.g. zod `issues` for 400 or `peakMatches` for 422" } }, ["error"]),
    Media: obj({ id: int(), hikeId: int(), kind: { type: "string", enum: ["image", "video"] }, name: nullable(str()), mime: str(), size: int("bytes"), caption: nullable(str()), createdAt: str(), url: str("Path to fetch the file (needs auth)") }),
    HikeWeather: obj({
      source: str(),
      fetchedAt: str(),
      location: obj({ lat: { type: "number" }, lon: { type: "number" }, elevationFt: nullable(int()), label: str() }),
      days: arr(obj({ date: str(), code: nullable(int("WMO weather code")), summary: str(), tMaxF: nullable({ type: "number" }), tMinF: nullable({ type: "number" }), windMaxMph: nullable({ type: "number" }), gustMaxMph: nullable({ type: "number" }), precipIn: nullable({ type: "number" }), snowIn: nullable({ type: "number" }) })),
    }),
    Conditions: { type: "string", enum: ["snow", "no_snow", "mix"] },
    Season: { type: "string", enum: ["winter", "spring", "summer", "fall"] },
    Peak: obj(
      { id: int(), slug: str(), name: str(), elevationFt: nullable(int()), state: nullable(str()), range: nullable(str()), lat: nullable({ type: "number" }), lon: nullable({ type: "number" }), kind: { type: "string", enum: ["peak", "trail"], description: "Trails are items on trail lists such as the Terrifying 25" } },
      ["id", "slug", "name"]
    ),
    PeakMatch: {
      description: "Result of matching one input name",
      oneOf: [
        obj({ input: str(), status: { const: "matched" }, via: { enum: ["exact", "fuzzy", "context"] }, peak: ref("Peak") }, ["input", "status", "peak"]),
        obj({ input: str(), status: { const: "ambiguous" }, candidates: arr(ref("Peak")) }, ["input", "status", "candidates"]),
        obj({ input: str(), status: { const: "unmatched" }, suggestions: arr(ref("Peak")) }, ["input", "status", "suggestions"]),
      ],
    },
    Network: obj({
      id: int(), slug: str(), groupSlug: nullable(str()), groupName: nullable(str()), name: str(), description: nullable(str()), source: str(), osmRef: nullable(str()),
      segmentLengthM: int(), fetchedAt: nullable(str()), totalLengthMi: { type: "number" }, trailCount: int(), segmentCount: int(),
      minLon: nullable({ type: "number" }), minLat: nullable({ type: "number" }), maxLon: nullable({ type: "number" }), maxLat: nullable({ type: "number" }),
      downloaded: { type: "boolean" }, coverage: arr(ref("NetworkCoverage")),
    }, ["slug", "name"]),
    NetworkCoverage: obj({ personId: int(), coveredMi: { type: "number" }, totalMi: { type: "number" }, percent: { type: "number" }, trailsDone: int("Trails at 95% or more") }, ["personId"]),
    TrailProgress: obj({
      id: int(), name: str(), ref: nullable(str()), lengthMi: { type: "number" }, segments: int(),
      byPerson: { type: "object", description: "Person id -> {coveredMi, share (0..1), percent}" },
      neededByAllMi: { type: "number", description: "Miles none of the listed people have hiked" }, bbox: nullable(arr({ type: "number" })),
    }),
    HikeTrack: obj({
      hikeId: int(), geojson: { type: "object", description: "LineString or MultiLineString" }, pointCount: int(), originalPointCount: nullable(int()),
      lengthMi: { type: "number" }, bbox: nullable(arr({ type: "number" })), source: { enum: ["gpx", "garmin", "manual"] }, createdAt: str(),
    }),
    Person: obj(
      {
        id: int(), name: str(), color: nullable(str()), createdAt: str(),
        canCompare: { type: "boolean", description: "True for people you can compare progress with; false for plain hiking partners" },
        userId: nullable(int()), username: nullable(str("Login linked to this person, if any")),
        hikeCount: int("Hikes where this person gets credit"), peakCount: int("Distinct peaks credited"),
      },
      ["id", "name"]
    ),
    User: obj({ id: int(), username: str(), isAdmin: int("1 or 0"), personId: nullable(int()), createdAt: str() }, ["id", "username"]),
    GarminConnection: obj({
      connected: { type: "boolean" }, keyExpiresAt: nullable(str()), lastSyncAt: nullable(str()), lastError: nullable(str()), connectedAt: str(), pendingCount: int(),
    }, ["connected"]),
    GarminActivity: obj({
      id: int(), activityId: str("Garmin's id"), startDate: str(), name: nullable(str()), type: nullable(str()),
      distanceMi: nullable({ type: "number" }), elevationGainFt: nullable(int()), durationMin: nullable(int()),
      startLat: nullable({ type: "number" }), startLon: nullable({ type: "number" }), endLat: nullable({ type: "number" }), endLon: nullable({ type: "number" }),
      status: { enum: ["pending", "imported", "ignored"] }, hikeId: nullable(int()),
      suggestedPeaks: arr(obj({ id: int(), slug: str(), name: str(), elevationFt: nullable(int()), state: nullable(str()), reason: { enum: ["track", "title"] }, detail: str() })),
      possibleMatches: { ...arr(obj({ hikeId: int(), date: str(), title: nullable(str()), peaks: arr(obj({ id: int(), name: str() })), newPeaks: arr(obj({ id: int(), name: str() })), hasTrack: { type: "boolean" }, score: int(), reasons: arr(str()) })), description: "Pending activities only: hikes you already logged that this probably is (same day plus shared peaks, start inside the hike's GPS area, or similar stats). Merge with /merge instead of importing a duplicate." },
    }, ["id", "activityId", "startDate", "status"]),
    ParticipantInput: {
      description: "A person id, a person name (unknown names are created), or an object.",
      oneOf: [
        int(), str(),
        obj({ person: { oneOf: [int(), str()] }, counts: { type: "boolean", default: true, description: "false = came along, no credit" }, note: str() }, ["person"]),
      ],
    },
    HikeInput: obj(
      {
        date: str("Start date", { format: "date" }),
        endDate: nullable(str("End date for multi-day trips", { format: "date" })),
        title: nullable(str()),
        peaks: { ...arr({ oneOf: [int(), str()] }), description: "Peak **names**, slugs or ids. Comma-separated strings are split. Unmatched names are stored on the hike as unmatchedPeaks." },
        participants: { ...arr(ref("ParticipantInput")), description: "Person names, ids or objects. Omit to default to the caller's person." },
        conditions: nullable(ref("Conditions")),
        weather: nullable(str()),
        trailConditions: nullable(str()),
        notes: nullable(str()),
        distanceMi: nullable({ type: "number", minimum: 0 }),
        elevationGainFt: nullable(int()),
        durationMin: nullable(int()),
        routeType: nullable(str("loop | out_and_back | traverse | other")),
        otherLists: nullable(str("Free text, e.g. 'Huntington Ravine'")),
        externalId: nullable(str("Idempotency key: re-posting the same value updates the existing hike", { maxLength: 200 })),
        stateHint: nullable(str("2-letter state to disambiguate peak names", { minLength: 2, maxLength: 2 })),
        listHint: nullable(str("List slug to disambiguate peak names")),
        strictPeaks: { type: "boolean", description: "Reject (422) if any peak name is unmatched or ambiguous" },
      },
      ["date"]
    ),
    Hike: obj(
      {
        id: int(), date: str(undefined, { format: "date" }), endDate: nullable(str()), title: nullable(str()),
        season: ref("Season"), isWinter: { type: "boolean", description: "Counts for the winter list" },
        conditions: nullable(ref("Conditions")), weather: nullable(str()), trailConditions: nullable(str()), notes: nullable(str()),
        distanceMi: nullable({ type: "number" }), elevationGainFt: nullable(int()), durationMin: nullable(int()), routeType: nullable(str()),
        otherLists: nullable(str()), unmatchedPeaks: arr(str()), source: { enum: ["web", "api", "import"] }, externalId: nullable(str()),
        createdBy: nullable(int()), createdAt: str(), updatedAt: str(),
        peaks: arr(obj({ id: int(), slug: str(), name: str(), elevationFt: nullable(int()), state: nullable(str()) })),
        participants: arr(obj({ id: int(), name: str(), color: nullable(str()), counts: { type: "boolean" }, note: nullable(str()) })),
      },
      ["id", "date", "peaks", "participants"]
    ),
    List: obj(
      {
        id: int(), slug: str(), name: str(), shortName: nullable(str()), region: nullable(str()), description: nullable(str()),
        criteria: nullable(str()), organization: nullable(str()), officialUrl: nullable(str()), notes: nullable(str()),
        isCustom: { type: "boolean" }, electivesNeeded: nullable(int("Electives that complete the list (e.g. 5 of 14 for the Terrifying 25)")), peakCount: int(), sources: { type: "array", items: { type: "object" }, description: "Parsed source citations" },
      },
      ["id", "slug", "name"]
    ),
    ListPeak: { allOf: [ref("Peak"), obj({ rank: nullable(int()), notes: nullable(str()), kind: { type: "string", enum: ["peak", "trail"] }, elective: int("1 = elective item") })] },
    PeakStatus: obj({
      count: int(), first: nullable(str()), last: nullable(str()), firstWinter: nullable(str()),
      seasons: arr(ref("Season")), months: arr(int("1-12")), conditions: arr(ref("Conditions")), hikeIds: arr(int()),
    }),
    Progress: obj(
      {
        list: ref("List"), mode: str(), personId: int(), person: obj({ id: int(), name: str(), color: nullable(str()) }),
        peaks: arr({ allOf: [ref("ListPeak"), obj({ status: ref("PeakStatus"), credit: int("Units earned"), done: { type: "boolean" } })] }),
        completed: int("Peaks fully done for the mode"), total: int(), credits: int(), creditsTotal: int(),
      },
      ["list", "mode", "peaks", "completed", "total"]
    ),
    Compare: obj(
      {
        list: ref("List"), mode: str(), personIds: arr(int()), people: arr(obj({ id: int(), name: str(), color: nullable(str()) })),
        peaks: arr({
          allOf: [
            ref("ListPeak"),
            obj({
              byPerson: { type: "object", description: "Keyed by person id", additionalProperties: obj({ status: ref("PeakStatus"), credit: int(), done: { type: "boolean" } }) },
              missingFor: { ...arr(int()), description: "Person ids who still need this peak" },
            }),
          ],
        }),
        summary: obj({
          total: int(), allDone: int("Done by everyone"), allNeed: int("Needed by everyone"),
          perPerson: { type: "object", description: "Keyed by person id", additionalProperties: obj({ done: int(), remaining: int(), onlyThem: int(), onlyTheyNeed: int() }) },
        }),
      },
      ["list", "mode", "peaks", "summary"]
    ),
    ImportRow: obj({
      row: int("Spreadsheet row number"), action: { enum: ["create", "update", "skipped"] }, date: nullable(str()), endDate: nullable(str()),
      conditions: nullable(ref("Conditions")), peaks: arr(ref("PeakMatch")), unmatchedPeaks: arr(str()),
      participants: arr(obj({ name: str(), counts: { type: "boolean" }, note: nullable(str()), isOwner: { type: "boolean" }, isNew: { type: "boolean" } })),
      weather: nullable(str()), trailConditions: nullable(str()), otherLists: nullable(str()), notes: nullable(str()), externalId: nullable(str()), warnings: arr(str()),
    }),
    ImportResult: obj({
      dryRun: { type: "boolean" }, logSheet: str(), owner: obj({ id: nullable(int()), name: str() }),
      rows: arr(ref("ImportRow")),
      summary: obj({ rows: int(), create: int(), update: int(), skipped: int(), warnings: int(), unmatchedPeaks: arr(str()), newPeople: arr(str()) }),
      reconcile: {
        description: "Checklist sheets compared with the imported log (never creates hikes)",
        ...arr(obj({ sheet: str(), mode: str(), sheetOnly: { ...arr(str()), description: "Sheet says done, log does not credit the owner" }, logOnly: { ...arr(str()), description: "Sheet says not done, log credits the owner" }, unmatchedNames: arr(str()) })),
      },
      created: int("Only when committed"), updated: int("Only when committed"), skipped: int("Only when committed"),
    }),
  }

  const paths: Record<string, Json> = {
    "/api/health": {
      get: { tags: ["System"], summary: "Health check (no auth)", security: [], operationId: "health", responses: { ...ok("Healthy", obj({ ok: { type: "boolean" }, version: str() })), "503": { description: "Database unavailable" } } },
    },
    "/api/auth/signup": {
      post: {
        tags: ["Auth"], summary: "Create an account and sign in (sets session cookie)", security: [], operationId: "signup",
        description: "Only when no users exist yet or ALLOW_SIGNUP=true. The first user becomes admin. Also creates or links a person with the display name.",
        requestBody: body(obj({ username: str(undefined, { minLength: 3 }), password: str(undefined, { minLength: 8 }), displayName: str() }, ["username", "password"])),
        responses: { ...ok("Created", obj({ user: ref("User") }), "201"), ...errs("400", "403", "409") },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"], summary: "Sign in (sets `hikelog_session` cookie)", security: [], operationId: "login",
        requestBody: body(obj({ username: str(), password: str() }, ["username", "password"])),
        responses: { ...ok("Signed in", obj({ user: ref("User"), person: { oneOf: [ref("Person"), { type: "null" }] } })), ...errs("400", "401", "429") },
      },
    },
    "/api/auth/logout": {
      post: { tags: ["Auth"], summary: "Sign out (clears cookie)", security: [], operationId: "logout", responses: ok("Signed out", obj({ ok: { type: "boolean" } })) },
    },
    "/api/v1/me": {
      get: { tags: ["Auth"], summary: "Current user and their person", operationId: "me", responses: { ...ok("OK", obj({ user: ref("User"), person: { oneOf: [ref("Person"), { type: "null" }] } })), ...errs("401") } },
    },
    "/api/v1/hikes": {
      get: {
        tags: ["Hikes"], summary: "List hikes (newest first)", operationId: "listHikes",
        parameters: [
          q("person", "Person id or name"), q("peak", "Peak name, slug or id"), q("list", "List slug"),
          q("from", "Earliest date (YYYY-MM-DD)", { type: "string", format: "date" }), q("to", "Latest date (YYYY-MM-DD)", { type: "string", format: "date" }),
          q("q", "Free-text search in title, notes, weather, trail conditions and peak names"),
          q("limit", "Page size (1-1000)", { type: "integer", default: 50 }), q("offset", "Offset", { type: "integer", default: 0 }),
        ],
        responses: { ...ok("OK", obj({ hikes: arr(ref("Hike")), total: int() }, ["hikes", "total"])), ...errs("400", "401", "404") },
      },
      post: {
        tags: ["Hikes"], summary: "Log a hike", operationId: "createHike",
        description: "**To log a hike:** POST {date, peaks:[names], participants:[names]}. Peaks and participants may be names. Include `externalId` for idempotency: a repeat returns 200 with `created:false` and updates the existing hike.",
        requestBody: body(ref("HikeInput"), hikeInputExample),
        responses: {
          ...ok("Created", obj({ hike: ref("Hike"), peakMatches: arr(ref("PeakMatch")), created: { type: "boolean" } }), "201"),
          "200": { description: "Updated an existing hike with the same externalId", content: { "application/json": { schema: obj({ hike: ref("Hike"), peakMatches: arr(ref("PeakMatch")), created: { const: false } }) } } },
          ...errs("400", "401", "422"),
        },
      },
    },
    "/api/v1/hikes/{id}": {
      parameters: [idParam("id", "Hike id")],
      get: { tags: ["Hikes"], summary: "Get a hike", operationId: "getHike", responses: { ...ok("OK", obj({ hike: ref("Hike") })), ...errs("401", "404") } },
      patch: {
        tags: ["Hikes"], summary: "Update a hike (partial)", operationId: "updateHike",
        description: "Any HikeInput field. The body is shallow-merged over the existing hike, so omitted fields are kept. `peaks` and `participants` replace the whole list when given.",
        requestBody: body({ ...ref("HikeInput"), required: [] } as Json, { notes: "Updated notes", conditions: "mix" }),
        responses: { ...ok("OK", obj({ hike: ref("Hike"), peakMatches: arr(ref("PeakMatch")) })), ...errs("400", "401", "404", "422") },
      },
      delete: { tags: ["Hikes"], summary: "Delete a hike", operationId: "deleteHike", responses: { ...ok("Deleted", obj({ ok: { type: "boolean" } })), ...errs("401", "404") } },
    },
    "/api/v1/peaks": {
      get: {
        tags: ["Peaks"], summary: "Search or list peaks", operationId: "listPeaks",
        parameters: [q("q", "Name search (aliases, fuzzy contains)"), q("list", "Restrict to a list slug"), q("limit", "Max results (default 100, max 2000)", { type: "integer" }), q("offset", "Offset", { type: "integer" })],
        responses: { ...ok("OK", obj({ peaks: arr(ref("Peak")), total: int() })), ...errs("401", "404") },
      },
    },
    "/api/v1/peaks/match": {
      post: {
        tags: ["Peaks"], summary: "Match free-text names to peaks", operationId: "matchPeaks",
        description: "Use before logging a hike to check how names resolve.",
        requestBody: body(obj({ names: { oneOf: [arr(str()), str()], description: "Array of names or one comma-separated string" }, stateHint: str("2-letter state"), listHint: str("List slug") }, ["names"]), { names: ["Lafayette", "Owl's Head"] }),
        responses: { ...ok("OK", obj({ results: arr(ref("PeakMatch")) })), ...errs("400", "401") },
      },
    },
    "/api/v1/peaks/{idOrSlug}": {
      parameters: [{ name: "idOrSlug", in: "path", required: true, schema: { type: "string" }, description: "Peak id or slug" }],
      get: {
        tags: ["Peaks"], summary: "Peak detail with lists and every ascent", operationId: "getPeak",
        responses: {
          ...ok("OK", obj({
            peak: ref("Peak"),
            lists: arr(obj({ slug: str(), name: str(), shortName: nullable(str()), region: nullable(str()), rank: nullable(int()) })),
            ascents: arr(obj({ hikeId: int(), date: str(), endDate: nullable(str()), conditions: nullable(ref("Conditions")), personId: int(), personName: str(), counts: int("1 or 0"), season: ref("Season"), isWinter: { type: "boolean" } })),
          })),
          ...errs("401", "404"),
        },
      },
    },
    "/api/v1/lists": { get: { tags: ["Lists"], summary: "All peak lists", operationId: "listLists", responses: { ...ok("OK", obj({ lists: arr(ref("List")) })), ...errs("401") } } },
    "/api/v1/lists/{slug}": {
      parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" }, example: "nh-48" }],
      get: { tags: ["Lists"], summary: "One list with its peaks", operationId: "getList", responses: { ...ok("OK", obj({ list: ref("List"), peaks: arr(ref("ListPeak")) })), ...errs("401", "404") } },
    },
    "/api/v1/lists/{slug}/progress": {
      parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
      get: { tags: ["Progress"], summary: "Progress on one list", operationId: "listProgress", parameters: [personParam, modeParam], responses: { ...ok("OK", ref("Progress")), ...errs("400", "401", "404") } },
    },
    "/api/v1/progress": {
      get: {
        tags: ["Progress"], summary: "Progress on every list", operationId: "allProgress", parameters: [personParam, modeParam],
        responses: { ...ok("OK", obj({ person: obj({ id: int(), name: str(), color: nullable(str()) }), mode: str(), lists: arr(obj({ list: ref("List"), completed: int(), total: int(), credits: int(), creditsTotal: int() })) })), ...errs("400", "401", "404") },
      },
    },
    "/api/v1/stats": {
      get: {
        tags: ["Progress"], summary: "Statistics and aggregates", operationId: "stats",
        description: "Everything behind the /stats page: KPIs, hikes and peaks per year, month heatmap, calendar days for `year`, season and conditions mix, winter seasons, rankings, partners, streaks, per-list burn-up series with projected finish, closest-to-finishing lists, grid slots and fun facts. `with` adds a second person (same shape) for overlays. Distance and vertical are only summed where recorded.",
        parameters: [personParam, q("with", "Second person id or name to compare against"), q("year", "Year for the calendar and year summary (defaults to the current or latest year)", { type: "integer" })],
        responses: { ...ok("OK", obj({ today: str(), core: { type: "object", description: "Aggregates for `person` (camelCase)" }, compare: { type: ["object", "null"], description: "Same shape for `with`, or null" } })), ...errs("400", "401", "404") },
      },
    },
    "/api/v1/compare": {
      get: {
        tags: ["Progress"], summary: "Compare people on a list", operationId: "compare",
        description: "Shows who still needs what. `summary.allNeed` = peaks nobody has done, `allDone` = done by everyone.",
        parameters: [{ ...q("list", "List slug"), required: true }, q("people", "Comma-separated person ids or names, all of whom must have canCompare on (default: every comparable person with hikes)"), modeParam],
        responses: { ...ok("OK", ref("Compare")), ...errs("400", "401", "404") },
      },
    },
    "/api/v1/people": {
      get: { tags: ["People"], summary: "List people", operationId: "listPeople", responses: { ...ok("OK", obj({ people: arr(ref("Person")) })), ...errs("401") } },
      post: { tags: ["People"], summary: "Create a person", operationId: "createPerson", requestBody: body(obj({ name: str(), color: str("CSS hex color"), canCompare: { type: "boolean", description: "Default false (plain hiking partner)" } }, ["name"])), responses: { ...ok("Created", obj({ person: ref("Person") }), "201"), ...errs("400", "401", "409") } },
    },
    "/api/v1/people/{id}": {
      parameters: [idParam("id", "Person id")],
      get: { tags: ["People"], summary: "Get a person", operationId: "getPerson", responses: { ...ok("OK", obj({ person: ref("Person") })), ...errs("401", "404") } },
      patch: { tags: ["People"], summary: "Rename / recolor / set whether they can be compared", operationId: "updatePerson", requestBody: body(obj({ name: str(), color: nullable(str()), canCompare: { type: "boolean" } })), responses: { ...ok("OK", obj({ person: ref("Person") })), ...errs("400", "401", "404", "409") } },
      delete: {
        tags: ["People"], summary: "Delete a person", operationId: "deletePerson",
        description: "Refused (409) if linked to a user account, or if the person is on hikes unless `force=1` (which removes their participation).",
        parameters: [q("force", "Delete even if they are on hikes", { type: "string", enum: ["1", "true"] })],
        responses: { ...ok("Deleted", obj({ ok: { type: "boolean" } })), ...errs("401", "404", "409") },
      },
    },
    "/api/v1/people/{id}/merge": {
      parameters: [idParam("id", "Source person id (deleted after merge)")],
      post: {
        tags: ["People"], summary: "Merge this person into another", operationId: "mergePeople",
        description: "Moves participations to the target, dropping duplicates (a counted participation wins), then deletes the source. The source must not be linked to a user.",
        requestBody: body(obj({ into: { oneOf: [int(), str()], description: "Target person id or name" } }, ["into"])),
        responses: { ...ok("Merged", obj({ person: ref("Person") })), ...errs("400", "401", "404", "409") },
      },
    },
    "/api/v1/tokens": {
      get: { tags: ["Tokens"], summary: "List your API tokens", operationId: "listTokens", responses: { ...ok("OK", obj({ tokens: arr(obj({ id: int(), name: str(), prefix: str(), createdAt: str(), lastUsedAt: nullable(str()) })) })), ...errs("401") } },
      post: {
        tags: ["Tokens"], summary: "Create an API token", operationId: "createToken", description: "The plaintext token is returned once only.",
        requestBody: body(obj({ name: str() }, ["name"])),
        responses: { ...ok("Created", obj({ token: str("hk_..."), id: int(), prefix: str(), name: str() }), "201"), ...errs("400", "401") },
      },
    },
    "/api/v1/tokens/{id}": {
      parameters: [idParam("id", "Token id")],
      delete: { tags: ["Tokens"], summary: "Revoke a token", operationId: "deleteToken", responses: { ...ok("Revoked", obj({ ok: { type: "boolean" } })), ...errs("401", "404") } },
    },
    "/api/v1/users": {
      get: { tags: ["Users"], summary: "List users (admin)", operationId: "listUsers", responses: { ...ok("OK", obj({ users: arr({ allOf: [ref("User"), obj({ person: { oneOf: [ref("Person"), { type: "null" }] } })] }) })), ...errs("401", "403") } },
      post: {
        tags: ["Users"], summary: "Create a user and their person (admin)", operationId: "createUser",
        requestBody: body(obj({ username: str(), password: str(undefined, { minLength: 8 }), displayName: str(), isAdmin: { type: "boolean" } }, ["username", "password"])),
        responses: { ...ok("Created", obj({ user: ref("User"), person: ref("Person") }), "201"), ...errs("400", "401", "403", "409") },
      },
    },
    "/api/v1/users/{id}": {
      parameters: [idParam("id", "User id")],
      patch: {
        tags: ["Users"], summary: "Change password / admin flag", operationId: "updateUser",
        description: "Admins can edit anyone. Other users can only change their own password. Changing a password signs that user out everywhere.",
        requestBody: body(obj({ password: str(undefined, { minLength: 8 }), isAdmin: { type: "boolean" } })),
        responses: { ...ok("OK", obj({ user: ref("User") })), ...errs("400", "401", "403", "404", "409") },
      },
    },
    "/api/v1/import/xlsx": {
      post: {
        tags: ["Import"], summary: "Import a hike-log spreadsheet (.xlsx or .csv)", operationId: "importXlsx",
        description:
          "Finds the log sheet by headers (Date, Season, Snow/No Snow, Mountain(s), Other Lists, Weather, Trail Conditions, Hiking Partner(s), Notes). Dates may be real dates or text like `1/17-18/26`. Traverse names (Franconia Ridge, Bonds, Presi traverse...) are expanded. The log owner (`self`) is always a participant; partners ending in 'ish' are added with counts=false. Re-imports update (externalId `xlsx:<date>:<peaks>`). With `dryRun=1` nothing is written. Other sheets that look like ✅/❌ checklists are compared against the log in `reconcile`; they never create hikes.",
        parameters: [q("dryRun", "Preview only", { type: "string", enum: ["1", "true"] })],
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: obj({ file: { type: "string", format: "binary" }, self: str("Person id or name of the log owner (default: caller's person)"), dryRun: str("Alternative to the query parameter") }, ["file"]) } },
        },
        responses: { ...ok("Preview or commit result", ref("ImportResult")), ...errs("400", "401", "413", "422") },
      },
    },
    "/api/v1/garmin/connection": {
      get: { tags: ["Garmin"], summary: "Your Garmin connection status", operationId: "getGarminConnection", description: "Never returns the API key.", responses: { ...ok("OK", ref("GarminConnection")), ...errs("401") } },
      put: {
        tags: ["Garmin"], summary: "Connect (or replace) your Garmin Personal API key", operationId: "putGarminConnection",
        description: "The key is validated with a token exchange against Garmin, then stored encrypted (AES-256-GCM). Each user has their own connection.",
        requestBody: body(obj({ apiKey: str("Personal API key from connect.garmin.com/app/settings/personalApiToken"), keyExpiresAt: str("Optional YYYY-MM-DD expiry you chose") }, ["apiKey"])),
        responses: { ...ok("Connected", ref("GarminConnection")), ...errs("400", "401", "422") },
      },
      delete: { tags: ["Garmin"], summary: "Disconnect Garmin (keeps imported hikes and the activity inbox)", operationId: "deleteGarminConnection", responses: { ...ok("Disconnected", obj({ ok: { type: "boolean" } })), ...errs("401") } },
    },
    "/api/v1/garmin/sync": {
      post: {
        tags: ["Garmin"], summary: "Pull new hiking activities from Garmin", operationId: "syncGarmin",
        description: "First sync looks back 365 days (GARMIN_INITIAL_SYNC_DAYS). New activities land in the inbox as `pending` with peak suggestions. Nothing is imported automatically.",
        responses: { ...ok("OK", obj({ fetched: int(), added: int(), skipped: int(), since: str(), connection: ref("GarminConnection") })), ...errs("401", "404", "409") },
      },
    },
    "/api/v1/import/sources": {
      get: { tags: ["Import sources"], summary: "Import sources and your connection to each", operationId: "listImportSources", description: "Sources: garmin (official personal API), garmin_connect (UNOFFICIAL, python-garminconnect), strava (official OAuth), file (GPX/FIT upload). All land in the same inbox (`/api/v1/garmin/activities`).", responses: { ...ok("OK", obj({ sources: arr(obj({}, [])) })), ...errs("401") } },
    },
    "/api/v1/import/garmin-connect/connection": {
      get: { tags: ["Import sources"], summary: "Garmin Connect (unofficial) status", operationId: "getGarminConnectLogin", responses: { ...ok("OK", obj({})), ...errs("401") } },
      put: {
        tags: ["Import sources"], summary: "Sign in to Garmin Connect (unofficial) or submit an MFA code", operationId: "putGarminConnectLogin",
        description: "UNOFFICIAL: uses python-garminconnect, outside Garmin's Terms of Service and may break. Send {email, password}, or {mfaCode} when the result is `needs_mfa`. The password is never stored, only encrypted session tokens.",
        requestBody: body(obj({ email: str(), password: str(), mfaCode: str() })),
        responses: { ...ok("OK", obj({ result: { enum: ["connected", "needs_mfa"] } })), ...errs("401", "422", "429", "502") },
      },
      delete: { tags: ["Import sources"], summary: "Forget the Garmin Connect session", operationId: "deleteGarminConnectLogin", responses: { ...ok("OK", obj({ ok: { type: "boolean" } })), ...errs("401") } },
    },
    "/api/v1/import/garmin-connect/sync": {
      post: { tags: ["Import sources"], summary: "Pull new hiking activities via Garmin Connect (unofficial)", operationId: "syncGarminConnectLogin", description: "At most 25 new activities per call; `more: true` means call again.", responses: { ...ok("OK", obj({ fetched: int(), added: int(), since: str(), more: { type: "boolean" } })), ...errs("401", "404", "409", "422", "429", "502") } },
    },
    "/api/v1/import/strava/connection": {
      get: { tags: ["Import sources"], summary: "Strava status and authorise links", operationId: "getStrava", responses: { ...ok("OK", obj({})), ...errs("401") } },
      put: { tags: ["Import sources"], summary: "Save your own Strava API app credentials", operationId: "putStrava", description: "Create a free app at strava.com/settings/api. Stored encrypted; you then authorise via `authorizeUrl`.", requestBody: body(obj({ clientId: str(), clientSecret: str() }, ["clientId", "clientSecret"])), responses: { ...ok("OK", obj({})), ...errs("400", "401") } },
      delete: { tags: ["Import sources"], summary: "Remove the Strava connection", operationId: "deleteStrava", responses: { ...ok("OK", obj({ ok: { type: "boolean" } })), ...errs("401") } },
    },
    "/api/v1/import/strava/authorize": {
      post: { tags: ["Import sources"], summary: "Finish Strava authorisation from a pasted code or redirect address", operationId: "authorizeStrava", requestBody: body(obj({ code: str("The code, or the whole address Strava redirected to") }, ["code"])), responses: { ...ok("OK", obj({})), ...errs("400", "401", "422", "429") } },
    },
    "/api/v1/import/strava/sync": {
      post: { tags: ["Import sources"], summary: "Pull new hikes, walks and snowshoes from Strava", operationId: "syncStrava", description: "At most 30 new activities per call (Strava allows 100 requests per 15 min); `more: true` means call again later.", responses: { ...ok("OK", obj({ fetched: int(), added: int(), since: str(), more: { type: "boolean" } })), ...errs("401", "404", "409", "429", "502") } },
    },
    "/api/v1/import/files": {
      post: { tags: ["Import sources"], summary: "Upload GPX or FIT files into the review inbox", operationId: "importFiles", description: "multipart/form-data, one or more `file` parts. Max 50 files, 25 MB each.", responses: { ...ok("Created", obj({ added: int(), results: arr(obj({ name: str(), status: { enum: ["added", "duplicate", "error"] }, message: str() })) }), "201"), ...errs("400", "401") } },
    },
    "/api/v1/garmin/activities": {
      get: {
        tags: ["Garmin"], summary: "Your Garmin activity inbox", operationId: "listGarminActivities",
        parameters: [q("status", "Filter by status", { type: "string", enum: ["pending", "imported", "ignored"] })],
        responses: { ...ok("OK", obj({ activities: arr(ref("GarminActivity")) })), ...errs("400", "401") },
      },
    },
    "/api/v1/garmin/activities/{id}/import": {
      parameters: [idParam("id", "Inbox activity id (not the Garmin activity id)")],
      post: {
        tags: ["Garmin"], summary: "Import an activity as a hike", operationId: "importGarminActivity",
        description: "Creates a hike with externalId `garmin:<activityId>` (re-importing updates it). `peaks` defaults to the suggested peaks; participants default to your own person.",
        requestBody: { required: false, content: { "application/json": { schema: obj({ peaks: arr({ oneOf: [int(), str()] }), participants: arr({ oneOf: [int(), str(), ref("ParticipantInput")] }), conditions: ref("Conditions"), notes: str(), weather: str() }) } } },
        responses: { ...ok("Imported", obj({ hike: { type: "object" }, peakMatches: arr({ type: "object" }), activity: ref("GarminActivity") }), "201"), ...errs("401", "404", "422") },
      },
    },
    "/api/v1/garmin/activities/{id}/merge": {
      parameters: [idParam("id", "Inbox activity id")],
      post: {
        tags: ["Garmin"], summary: "Merge an activity into a hike you already logged", operationId: "mergeGarminActivity",
        description: "Attaches the GPS track (only when the hike has none) and fills empty title, distance, climb and duration. Nothing already on the hike is overwritten and participants are untouched. `addPeaks` lists extra peak ids to add (e.g. from `possibleMatches[].newPeaks`); none are added by default.",
        requestBody: body(obj({ hikeId: int(), addPeaks: arr(int()) }, ["hikeId"])),
        responses: { ...ok("Merged", obj({ hike: { type: "object" }, activity: ref("GarminActivity") })), ...errs("401", "404", "409", "422") },
      },
    },
    "/api/v1/garmin/activities/{id}/ignore": {
      parameters: [idParam("id", "Inbox activity id")],
      post: { tags: ["Garmin"], summary: "Dismiss an activity from the inbox", operationId: "ignoreGarminActivity", responses: { ...ok("OK", obj({ activity: ref("GarminActivity") })), ...errs("401", "404") } },
    },
    "/api/v1/networks": {
      get: {
        tags: ["Map"], summary: "Trail networks (AT sections, White Mountains...) with coverage", operationId: "listNetworks",
        description: "Every network defined in data/networks/*.json, downloaded or not. `coverage` has one entry per requested person: miles hiked, total miles, percent and trails done. Network data comes from OpenStreetMap, so it approximates (not copies) guidebooks such as the AMC White Mountain Guide.",
        parameters: [q("person", "Comma-separated person ids or names. Defaults to the caller's person.")],
        responses: { ...ok("OK", obj({ networks: arr(ref("Network")), groups: { type: "object", description: "Group slug -> {name, description, note}" } })), ...errs("401") },
      },
    },
    "/api/v1/networks/{slug}/download": {
      parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" }, description: "A network slug (e.g. `at-new-hampshire`, `white-mountains`) or a group slug (`appalachian-trail` downloads every state)" }],
      post: {
        tags: ["Map"], summary: "Download a network from OpenStreetMap (admin)", operationId: "downloadNetwork",
        description: "Fetches geometry from the Overpass API at request time (descriptive User-Agent, retries and mirror fallback) and stores trails plus ~150-250 m segments. Can take a minute or more; the public Overpass servers are sometimes at capacity (503). Re-downloading keeps hand-made marks and recomputes GPS coverage for every hike with a track.",
        responses: { ...ok("Downloaded", obj({ results: arr(obj({ slug: str(), name: str(), trails: int(), segments: int(), totalMi: { type: "number" }, seconds: { type: "number" }, coverage: obj({ hikes: int(), segments: int() }) })), networks: arr(ref("Network")) })), ...errs("401", "403", "404", "409", "503") },
      },
    },
    "/api/v1/networks/{slug}/coverage": {
      parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
      get: {
        tags: ["Map"], summary: "Coverage of a network per person, with a per-trail breakdown", operationId: "networkCoverage",
        description: "A segment counts as hiked for a person when a GPS track of a hike they were counted on has at least 70% of its sample points within ~30 m of it, or when it was marked by hand. `trails[].neededByAllMi` is the mileage none of the listed people have done (the redlining equivalent of \"both still need\").",
        parameters: [q("person", "Comma-separated person ids or names. Defaults to the caller's person."), q("trails", "Pass 0 to leave out the per-trail list", { type: "string", enum: ["0", "1"] })],
        responses: { ...ok("OK", obj({ network: ref("Network"), coverage: arr(ref("NetworkCoverage")), trails: arr(ref("TrailProgress")) })), ...errs("401", "404") },
      },
    },
    "/api/v1/networks/{slug}/geojson": {
      parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
      get: {
        tags: ["Map"], summary: "Network geometry as GeoJSON with a covered flag", operationId: "networkGeoJson",
        description: "FeatureCollection of MultiLineString runs. Consecutive segments of a trail with the same coverage state are merged into one feature. Properties: `trailId`, `name`, `ref`, `covered` (1 when the FIRST listed person has hiked that stretch), `by` (comma-separated ids of every listed person who has), `fromIdx`/`toIdx` (segment index range).",
        parameters: [q("person", "Comma-separated person ids or names; the first sets `covered`. Defaults to the caller's person.")],
        responses: { ...ok("GeoJSON FeatureCollection", { type: "object" }), ...errs("401", "404") },
      },
    },
    "/api/v1/trails/{id}/segments": {
      parameters: [idParam("id", "Trail id")],
      get: {
        tags: ["Map"], summary: "Segments of one trail with who covered each", operationId: "trailSegments",
        parameters: [q("person", "Comma-separated person ids or names. Defaults to the caller's person.")],
        responses: { ...ok("OK", obj({ trail: obj({ id: int(), name: str(), networkId: int(), lengthMi: { type: "number" } }), segments: arr(obj({ idx: int(), lengthM: int(), coords: arr(arr({ type: "number" })), coveredBy: arr(obj({ person: int(), source: { enum: ["track", "manual"] } })) })), bbox: arr({ type: "number" }) })), ...errs("401", "404") },
      },
    },
    "/api/v1/hikes/{id}/track": {
      parameters: [idParam("id", "Hike id")],
      get: { tags: ["Map"], summary: "A hike's GPS track", operationId: "getHikeTrack", responses: { ...ok("OK", obj({ track: ref("HikeTrack") })), ...errs("401", "404") } },
      post: {
        tags: ["Map"], summary: "Attach (or replace) a GPS track: GPX or GeoJSON", operationId: "putHikeTrack",
        description: "Send multipart/form-data with a `file` (.gpx or GeoJSON LineString / MultiLineString / Feature / FeatureCollection), or post the raw GPX/GeoJSON as the body. The track is simplified (Douglas-Peucker, ~10 m) before it is stored, then trail coverage is recomputed for every counted participant. Imported Garmin activities get their track automatically when Garmin provides a GPX.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": { schema: obj({ file: { type: "string", format: "binary" } }, ["file"]) },
            "application/gpx+xml": { schema: { type: "string" } },
            "application/geo+json": { schema: { type: "object" } },
          },
        },
        responses: { ...ok("Saved", obj({ track: ref("HikeTrack") }), "201"), ...errs("400", "401", "404", "413") },
      },
      delete: { tags: ["Map"], summary: "Remove a hike's GPS track (and the coverage it produced)", operationId: "deleteHikeTrack", responses: { ...ok("Removed", obj({ ok: { type: "boolean" } })), ...errs("401", "404") } },
    },
    "/api/v1/tracks": {
      get: {
        tags: ["Map"], summary: "Simplified GPS tracks for the map", operationId: "listTracks",
        parameters: [q("person", "Only hikes this person was on"), q("hike", "Only this hike", { type: "integer" })],
        responses: { ...ok("OK", obj({ tracks: arr(obj({ hikeId: int(), date: str(), title: nullable(str()), lengthMi: { type: "number" }, bbox: arr({ type: "number" }), people: arr(obj({ id: int(), name: str() })), geojson: { type: "object" } })) })), ...errs("401", "404") },
      },
    },
    "/api/v1/coverage/manual": {
      post: {
        tags: ["Map"], summary: "Mark a trail (or a section of it) as hiked by hand", operationId: "markCoverage",
        description: "For old hikes without GPS. `fromIdx`/`toIdx` are inclusive segment indexes within the trail (see `/trails/{id}/segments`); leave both out for the whole trail. `covered: false` clears hand-made marks only; GPS-derived coverage stays. Marks survive a network re-download.",
        requestBody: body(obj({ trailId: int(), person: { oneOf: [int(), str()], description: "Person id or name. Defaults to the caller's person." }, fromIdx: int(), toIdx: int(), covered: { type: "boolean", default: true }, date: str("YYYY-MM-DD"), hikeId: int("Optional hike to link") }, ["trailId"]), { trailId: 12, person: "Alex", date: "2021-07-04" }),
        responses: { ...ok("OK", obj({ ok: { type: "boolean" }, segments: int() })), ...errs("400", "401", "404") },
      },
    },
    "/api/v1/hikes/{id}/media": {
      parameters: [idParam("id", "Hike id")],
      get: { tags: ["Media"], summary: "Photos and videos on a hike", operationId: "listHikeMedia", responses: { ...ok("OK", obj({ media: arr(ref("Media")) })), ...errs("401", "404") } },
      post: {
        tags: ["Media"], summary: "Add photos or videos to a hike", operationId: "addHikeMedia",
        description: "Either multipart/form-data with one or more `file` parts, or a raw body whose Content-Type is the file's type and `X-Filename` is its (URL-encoded) name. The raw form streams straight to disk, so use it for large videos. Photos up to 60 MB (JPEG, PNG, WebP, HEIC, GIF, AVIF), videos up to 1 GB (MP4, MOV, WebM). Files live in the data volume under `media/`.",
        requestBody: { required: true, content: { "multipart/form-data": { schema: obj({ file: { type: "string", format: "binary" } }, ["file"]) }, "application/octet-stream": { schema: { type: "string", format: "binary" } } } },
        responses: { ...ok("Saved", obj({ media: arr(ref("Media")) }), "201"), ...errs("400", "401", "404", "413", "415") },
      },
    },
    "/api/v1/media/{id}": {
      parameters: [idParam("id", "Media id")],
      get: { tags: ["Media"], summary: "Download or stream a photo or video (supports Range requests)", operationId: "getMedia", responses: { "200": { description: "The file" }, "206": { description: "Partial content" }, ...errs("401", "404") } },
      delete: { tags: ["Media"], summary: "Delete a photo or video", operationId: "deleteMedia", responses: { ...ok("Deleted", obj({ ok: { type: "boolean" } })), ...errs("401", "404") } },
    },
    "/api/v1/hikes/{id}/weather": {
      parameters: [idParam("id", "Hike id")],
      get: { tags: ["Weather"], summary: "Imported weather for a hike", operationId: "getHikeWeather", responses: { ...ok("OK", obj({ weather: ref("HikeWeather") })), ...errs("401", "404") } },
      post: {
        tags: ["Weather"], summary: "Import (or refresh) weather for a hike from Open-Meteo", operationId: "importHikeWeather",
        description: "Looks up daily weather (up to 7 days from the hike's start) at the highest peak on the hike that has coordinates, or the start of its GPS track. Temperature is adjusted to the peak's elevation; wind is modelled at 10 m. Mountain Forecast has no public API, so Open-Meteo (CC BY 4.0, no key) is used.",
        responses: { ...ok("Imported", obj({ weather: ref("HikeWeather") })), ...errs("401", "404", "422", "502") },
      },
      delete: { tags: ["Weather"], summary: "Remove a hike's imported weather", operationId: "deleteHikeWeather", responses: { ...ok("Removed", obj({ ok: { type: "boolean" } })), ...errs("401", "404") } },
    },
    "/api/v1/weather/backfill": {
      post: {
        tags: ["Weather"], summary: "Import weather for hikes that don't have it", operationId: "backfillWeather",
        parameters: [q("limit", "Hikes to process in this call (default 20, max 50)", { type: "integer" })],
        description: "Call repeatedly while `remaining` is above 0.",
        responses: { ...ok("OK", obj({ imported: int(), remaining: int(), failed: arr(obj({ id: int(), error: str() })) })), ...errs("401") },
      },
    },
    "/api/v1/export": {
      get: {
        tags: ["Export"], summary: "Download your data", operationId: "exportData",
        parameters: [q("format", "`json` (everything), `hikes.csv`, `ascents.csv`, or `database` (admins: the raw SQLite file)", { type: "string", enum: ["json", "hikes.csv", "ascents.csv", "database"], default: "json" })],
        responses: { "200": { description: "A file download" }, ...errs("400", "401", "403") },
      },
    },
    "/api/v1/me/lists": {
      get: { tags: ["Lists"], summary: "Lists as you see them: visibility and enabled views", operationId: "getMyLists", responses: { ...ok("OK", obj({ defaultViews: arr(str()), lists: arr(obj({ slug: str(), name: str(), started: { type: "boolean" }, state: { type: "string", enum: ["auto", "show", "hide"] }, visible: { type: "boolean" }, views: arr(str()), customViews: { type: "boolean" } })) })), ...errs("401") } },
      patch: {
        tags: ["Lists"], summary: "Show or hide a list, or choose which views it offers", operationId: "updateMyLists",
        description: "With `list`: set `state` (`show` pins a list you haven't started, `hide` hides one you have, `auto` shows it once you've started it) and/or `views` (any of all, winter, season, grid, conditions; `null` removes the list's override). Without `list`: `views` sets your default views for every list.",
        requestBody: body(obj({ list: str("List slug"), state: { type: "string", enum: ["auto", "show", "hide"] }, views: { type: ["array", "null"], items: { type: "string", enum: ["all", "winter", "season", "grid", "conditions"] } } })),
        responses: { ...ok("Saved", obj({ ok: { type: "boolean" } })), ...errs("400", "401", "404") },
      },
    },
    "/api/openapi.json": { get: { tags: ["System"], summary: "This document", security: [], operationId: "openapi", responses: ok("OpenAPI 3.1 JSON") } },
  }

  const errorResponse = (description: string) => ({ description, content: { "application/json": { schema: ref("Error") } } })
  return {
    openapi: "3.1.0",
    info: { title: "HikeLog API", version: APP_VERSION, description: DESCRIPTION },
    servers: [{ url: serverUrl }],
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    tags: ["System", "Auth", "Hikes", "Peaks", "Lists", "Progress", "People", "Tokens", "Users", "Import", "Garmin", "Map", "Media", "Weather", "Export"].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "hk_...", description: "API token created in Settings or via POST /api/v1/tokens" },
        cookieAuth: { type: "apiKey", in: "cookie", name: "hikelog_session", description: "Browser session from /api/auth/login (unsafe methods need a same-origin Origin header)" },
      },
      schemas,
      responses: {
        E400: errorResponse("Invalid request (zod `details.issues`)"),
        E401: errorResponse("Missing or invalid credentials"),
        E403: errorResponse("Forbidden"),
        E404: errorResponse("Not found"),
        E409: errorResponse("Conflict"),
        E413: errorResponse("Payload too large"),
        E415: errorResponse("Unsupported media type"),
        E422: errorResponse("Unprocessable (e.g. strictPeaks with unmatched names)"),
        E429: errorResponse("Too many attempts"),
        E502: errorResponse("Upstream service (weather) failed"),
      },
    },
  }
}
