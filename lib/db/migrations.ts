// Ordered, append-only schema migrations. Never edit a shipped migration; add a new one.
export const migrations: string[] = [
  /* 1: initial schema */ `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);

  CREATE TABLE people (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX people_name_ci ON people(name COLLATE NOCASE);

  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,               -- sha256 of the cookie value
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE api_tokens (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,   -- sha256 of the full token
    prefix TEXT NOT NULL,              -- first chars, shown in UI
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
  );

  CREATE TABLE peaks (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    elevation_ft INTEGER,
    state TEXT,
    range TEXT,
    lat REAL,
    lon REAL,
    notes TEXT,
    is_custom INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE peak_aliases (
    peak_id INTEGER NOT NULL REFERENCES peaks(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,               -- normalized (see lib/peaks/normalize.ts)
    PRIMARY KEY (peak_id, alias)
  );
  CREATE INDEX peak_aliases_alias ON peak_aliases(alias);

  CREATE TABLE lists (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    short_name TEXT,
    region TEXT,
    description TEXT,
    criteria TEXT,
    organization TEXT,
    official_url TEXT,
    notes TEXT,
    sources_json TEXT NOT NULL DEFAULT '[]',
    is_custom INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER
  );

  CREATE TABLE list_peaks (
    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    peak_id INTEGER NOT NULL REFERENCES peaks(id) ON DELETE CASCADE,
    rank INTEGER,
    notes TEXT,
    PRIMARY KEY (list_id, peak_id)
  );

  CREATE TABLE hikes (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,                -- YYYY-MM-DD (start)
    end_date TEXT,                     -- YYYY-MM-DD for multi-day trips
    title TEXT,
    conditions TEXT CHECK (conditions IN ('snow','no_snow','mix')),
    weather TEXT,
    trail_conditions TEXT,
    notes TEXT,
    distance_mi REAL,
    elevation_gain_ft INTEGER,
    duration_min INTEGER,
    route_type TEXT,                   -- loop | out_and_back | traverse | other
    other_lists TEXT,                  -- free text, e.g. "Huntington Ravine"
    unmatched_peaks TEXT,              -- free text of names that did not match a peak
    source TEXT NOT NULL DEFAULT 'web',-- web | api | import
    external_id TEXT,                  -- optional idempotency key for agents
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX hikes_date ON hikes(date);
  CREATE UNIQUE INDEX hikes_external_id ON hikes(external_id) WHERE external_id IS NOT NULL;

  CREATE TABLE hike_peaks (
    hike_id INTEGER NOT NULL REFERENCES hikes(id) ON DELETE CASCADE,
    peak_id INTEGER NOT NULL REFERENCES peaks(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (hike_id, peak_id)
  );
  CREATE INDEX hike_peaks_peak ON hike_peaks(peak_id);

  CREATE TABLE hike_participants (
    hike_id INTEGER NOT NULL REFERENCES hikes(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    counts INTEGER NOT NULL DEFAULT 1, -- 0 = came along but does not get credit (e.g. turned around)
    note TEXT,
    PRIMARY KEY (hike_id, person_id)
  );
  CREATE INDEX hike_participants_person ON hike_participants(person_id);
  `,
  /* 2: Garmin Personal API import */ `
  CREATE TABLE garmin_connections (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    api_key_enc TEXT NOT NULL,           -- AES-256-GCM, see lib/garmin/crypto.ts
    key_expires_at TEXT,                 -- ISO date, if known
    access_token_enc TEXT,
    access_token_expires_at TEXT,
    last_sync_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE garmin_activities (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id TEXT NOT NULL,
    start_date TEXT NOT NULL,            -- YYYY-MM-DD (local start)
    name TEXT,
    type TEXT,
    distance_mi REAL,
    elevation_gain_ft INTEGER,
    duration_min INTEGER,
    start_lat REAL,
    start_lon REAL,
    end_lat REAL,
    end_lon REAL,
    raw_json TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','imported','ignored')),
    hike_id INTEGER REFERENCES hikes(id) ON DELETE SET NULL,
    suggested_peaks_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, activity_id)
  );
  CREATE INDEX garmin_activities_user_status ON garmin_activities(user_id, status, start_date);
  `,
  /* 3: GPS tracks, trail networks and redlining coverage */ `
  CREATE TABLE hike_tracks (
    hike_id INTEGER PRIMARY KEY REFERENCES hikes(id) ON DELETE CASCADE,
    geojson TEXT NOT NULL,               -- LineString / MultiLineString, simplified (~10 m Douglas-Peucker)
    simplified INTEGER NOT NULL DEFAULT 1,
    point_count INTEGER NOT NULL DEFAULT 0,
    original_point_count INTEGER,
    length_mi REAL NOT NULL DEFAULT 0,
    min_lon REAL, min_lat REAL, max_lon REAL, max_lat REAL,
    source TEXT NOT NULL DEFAULT 'gpx' CHECK (source IN ('gpx','garmin','manual')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- A Garmin activity's GPS track is fetched during sync; keep it (simplified) until the activity is imported.
  ALTER TABLE garmin_activities ADD COLUMN track_geojson TEXT;

  CREATE TABLE trail_networks (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    group_slug TEXT,                     -- e.g. appalachian-trail for its state sections
    group_name TEXT,
    name TEXT NOT NULL,
    description TEXT,
    source TEXT NOT NULL DEFAULT 'osm-overpass',
    osm_query TEXT,                      -- the Overpass QL that was run
    osm_ref TEXT,                        -- relation id(s) or bbox, human readable
    segment_length_m INTEGER NOT NULL DEFAULT 150,
    fetched_at TEXT,
    total_length_mi REAL NOT NULL DEFAULT 0,
    trail_count INTEGER NOT NULL DEFAULT 0,
    segment_count INTEGER NOT NULL DEFAULT 0,
    min_lon REAL, min_lat REAL, max_lon REAL, max_lat REAL,
    sort INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE trails (
    id INTEGER PRIMARY KEY,
    network_id INTEGER NOT NULL REFERENCES trail_networks(id) ON DELETE CASCADE,
    osm_id TEXT,                         -- first way/relation id, stable key for re-downloads
    osm_way_ids TEXT NOT NULL DEFAULT '[]',
    name TEXT NOT NULL,
    ref TEXT,
    geojson TEXT NOT NULL,               -- MultiLineString, in walking order
    length_mi REAL NOT NULL DEFAULT 0,
    min_lon REAL, min_lat REAL, max_lon REAL, max_lat REAL
  );
  CREATE INDEX trails_network ON trails(network_id);

  CREATE TABLE trail_segments (
    id INTEGER PRIMARY KEY,
    trail_id INTEGER NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
    network_id INTEGER NOT NULL REFERENCES trail_networks(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    geojson TEXT NOT NULL,               -- LineString coordinates array, one piece of ~segment_length_m
    length_m REAL NOT NULL,
    min_lon REAL NOT NULL, min_lat REAL NOT NULL, max_lon REAL NOT NULL, max_lat REAL NOT NULL
  );
  CREATE INDEX trail_segments_trail ON trail_segments(trail_id, idx);
  CREATE INDEX trail_segments_network ON trail_segments(network_id, min_lat);

  CREATE TABLE segment_coverage (
    id INTEGER PRIMARY KEY,
    segment_id INTEGER NOT NULL REFERENCES trail_segments(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    hike_id INTEGER REFERENCES hikes(id) ON DELETE CASCADE,
    covered_at TEXT,                     -- YYYY-MM-DD when known
    source TEXT NOT NULL CHECK (source IN ('track','manual'))
  );
  CREATE UNIQUE INDEX segment_coverage_uniq ON segment_coverage(segment_id, person_id, COALESCE(hike_id, 0), source);
  CREATE INDEX segment_coverage_person ON segment_coverage(person_id, segment_id);
  CREATE INDEX segment_coverage_hike ON segment_coverage(hike_id);
  `,
  /* 4: trail items + electives (Terrifying 25), per-user prefs, hike media, imported weather */ `
  ALTER TABLE peaks ADD COLUMN kind TEXT NOT NULL DEFAULT 'peak';            -- peak | trail
  ALTER TABLE list_peaks ADD COLUMN elective INTEGER NOT NULL DEFAULT 0;     -- 1 = optional item (pick N of these)
  ALTER TABLE lists ADD COLUMN electives_needed INTEGER;                      -- how many electives complete the list

  -- Per-user settings: list visibility ("list:<slug>" = show|hide) and enabled views ("views:default" / "views:<slug>").
  CREATE TABLE user_prefs (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  );

  CREATE TABLE hike_media (
    id INTEGER PRIMARY KEY,
    hike_id INTEGER NOT NULL REFERENCES hikes(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('image','video')),
    file TEXT NOT NULL,                  -- path relative to $DATA_DIR/media
    original_name TEXT,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    caption TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX hike_media_hike ON hike_media(hike_id);

  ALTER TABLE hikes ADD COLUMN weather_json TEXT;                             -- imported daily weather, see lib/weather.ts
  `,
  /* 5: pluggable import sources (Garmin Connect unofficial, Strava, file uploads) share the activity inbox */ `
  ALTER TABLE garmin_activities ADD COLUMN source TEXT NOT NULL DEFAULT 'garmin';  -- garmin | garmin_connect | strava | file

  -- One row per (user, provider) for the providers that need stored secrets. 'secret_enc' is AES-256-GCM JSON.
  CREATE TABLE import_connections (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,              -- garmin_connect | strava
    status TEXT NOT NULL DEFAULT 'connected',  -- connected | pending (Strava app saved, not yet authorised)
    secret_enc TEXT NOT NULL,
    meta_json TEXT NOT NULL DEFAULT '{}',      -- non-secret display info (athlete name, ...)
    last_sync_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, provider)
  );
  `,
]
