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
]
