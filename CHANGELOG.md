# Changelog

All notable changes to HikeLog are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org). HikeLog is **pre-1.0**: not yet a stable release.

## [Unreleased]

### Added
- Two kinds of people in Settings → People: plain hiking partners (only recorded on hikes) and people you can compare with. Each person has a "Compare" switch (also on the Add person dialog, and `canCompare` in the API). Compare and the Stats "vs" picker list only comparable people; partners still appear on hikes, hike forms and partner stats.

### Changed
- Migration 6 adds `people.can_compare`. Existing people who have a login stay comparable; everyone else becomes a plain hiking partner (flip the switch to change). `GET /api/v1/compare` rejects people who aren't comparable.

## [0.2.0] - 2026-11-22

### Added
- Published container image `ghcr.io/tcart38/hikelog` (linux/amd64 and arm64) built by GitHub Actions: `:latest` and `:edge` from `main`, `:X.Y.Z`, `:vX.Y.Z`, `:X.Y` and `:latest` from version tags.
- Unraid template (`hikelog.xml`) so the repository link can be added as a template repository, with update checks via the `:latest` digest. Template validated in CI (`scripts/check-unraid-template.py`).
- Install on Unraid and release-process docs in the README.

### Changed
- The container now starts through an entrypoint that fixes ownership of `/data` and runs the app as `PUID:PGID` (default 99:100, Unraid's `nobody:users`) instead of uid 1000. Existing volumes are re-owned automatically on start.

## [0.1.1] - 2026-11-22

### Changed
- Redlining page is easier to follow: a plain-language explanation of redlining, a progress summary for the selected region up front, "region or guide" instead of "network", a legend for done vs remaining trails, a note on how trails get marked (GPS track or by hand), and empty states.

## [0.1.0] - 2026-11-22

First tagged version, summarizing the work so far.

### Added
- Core data model on SQLite: people vs. users, hikes with participants, seasons, peak matching by name, seeded peak lists (NH 48, NE 67, NEHH, NE 115, ADK 46, Catskill 3500, Maine/Vermont 4000s, 14ers, state high points and more) with All, Winter, Four-season, Grid and snow modes.
- Web UI: dashboard, hikes, lists, compare, stats with charts, people, settings, authentication with first-run admin setup.
- REST API v1 with OpenAPI docs at `/docs`, API tokens, and idempotent hike logging via `externalId`.
- Spreadsheet (`.xlsx`) import with dry-run preview and drag-and-drop upload.
- Map with GPS tracks, peak map and trail-network completion (redlining) for the AT, White Mountains, Adirondack High Peaks and Catskills.
- Pluggable activity import: Garmin Personal API, Garmin Connect login (unofficial), Strava OAuth, GPX/FIT upload, with a per-user inbox, peak suggestions from tracks, and detection of likely matches with already-logged hikes (merge, keep as new, or skip).
- Garmin Personal API downloads the documented activity FIT (ZIP) for GPS tracks, with GPX fallback and backfill.
- Photos and videos per hike, Open-Meteo weather import, JSON/CSV export and admin database backup, Terrifying 25 trail list.
- Installable PWA with offline fallback and phone tab bar.
- Docker image and compose setup; version shown in Settings, `/api/health` and `/docs`.

[Unreleased]: https://github.com/tcart38/HikeLog/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/tcart38/HikeLog/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/tcart38/HikeLog/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/tcart38/HikeLog/releases/tag/v0.1.0
