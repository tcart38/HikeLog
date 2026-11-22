# Peak list seed format

One JSON file per list in `data/lists/<slug>.json`. The app loads every file at startup and
upserts lists, peaks and memberships. Peaks are shared across lists by `slug`, so the same
mountain in two lists MUST use the exact same peak slug.

```json
{
  "slug": "nh-48",
  "name": "New Hampshire 4000-Footers",
  "shortName": "NH 48",
  "region": "New Hampshire",
  "country": "US",
  "description": "One or two sentences for the UI.",
  "criteria": "Official inclusion rules (e.g. 4000 ft+, 200 ft prominence rule).",
  "organization": "AMC Four Thousand Footer Committee",
  "officialUrl": "https://...",
  "notes": "Optional: winter rules, required peaks, controversies, unranked peaks.",
  "sources": [{ "title": "...", "url": "https://...", "accessed": "2026-11-21" }],
  "peaks": [
    {
      "slug": "mount-washington-nh",
      "name": "Mount Washington",
      "aliases": ["Washington", "Mt Washington", "Mt. Washington"],
      "elevationFt": 6288,
      "state": "NH",
      "range": "Presidential Range",
      "lat": 44.2706,
      "lon": -71.3033,
      "rank": 1,
      "notes": "optional, e.g. 'unranked / soft-ranked', 'winter-required'"
    }
  ]
}
```

Rules
- Peak slug: kebab-case official name + `-` + lowercase 2-letter state, e.g. `mount-washington-nh`,
  `mount-abraham-me`, `mount-abraham-vt`, `mount-elbert-co`. For peaks on a state line use the
  state the list attributes it to (or the first listed).
- `aliases` must include the short form people write in logs ("Washington", "Owl's Head",
  "Wildcat A", "South Twin"), common abbreviations (Mt, Mt.), and alternative names.
- `elevationFt` is an integer from a cited source. `lat`/`lon` are decimal degrees and are
  optional: include them only when taken from a source (Wikipedia tables, peakbagger, USGS GNIS).
  Never guess coordinates.
- `rank` = position within this list ordered by elevation (1 = highest).
- Composite lists (e.g. NE 115) still list every peak object in full so the file is self-contained.
