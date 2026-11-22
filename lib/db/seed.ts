import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import type { DatabaseSync } from "node:sqlite"
import { normalizePeakName } from "../peaks/normalize"

export type SeedPeak = {
  slug: string
  name: string
  aliases?: string[]
  elevationFt?: number
  state?: string
  range?: string
  lat?: number
  lon?: number
  rank?: number
  notes?: string
}

export type SeedList = {
  slug: string
  name: string
  shortName?: string
  region?: string
  description?: string
  criteria?: string
  organization?: string
  officialUrl?: string
  notes?: string
  sources?: { title: string; url: string; accessed?: string }[]
  peaks: SeedPeak[]
}

export function seedDir(): string {
  return process.env.SEED_DIR || path.join(process.cwd(), "data", "lists")
}

export function readSeedFiles(): SeedList[] {
  const dir = seedDir()
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as SeedList)
}

/**
 * Upsert built-in lists and peaks from data/lists/*.json. Runs on every boot
 * but only does work when the seed files changed (content hash in meta).
 * Never deletes user data: hikes reference peaks by id, and peaks are matched by slug.
 */
export function seedLists(db: DatabaseSync, force = false) {
  const lists = readSeedFiles()
  const hash = crypto.createHash("sha256").update(JSON.stringify(lists)).digest("hex")
  const row = db.prepare("SELECT value FROM meta WHERE key = 'seed_hash'").get() as
    | { value: string }
    | undefined
  if (!force && row?.value === hash) return

  const upsertPeak = db.prepare(`
    INSERT INTO peaks (slug, name, elevation_ft, state, range, lat, lon, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      elevation_ft = COALESCE(excluded.elevation_ft, peaks.elevation_ft),
      state = COALESCE(excluded.state, peaks.state),
      range = COALESCE(excluded.range, peaks.range),
      lat = COALESCE(excluded.lat, peaks.lat),
      lon = COALESCE(excluded.lon, peaks.lon)
    RETURNING id`)
  const addAlias = db.prepare("INSERT OR IGNORE INTO peak_aliases (peak_id, alias) VALUES (?, ?)")
  const upsertList = db.prepare(`
    INSERT INTO lists (slug, name, short_name, region, description, criteria, organization, official_url, notes, sources_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name, short_name = excluded.short_name, region = excluded.region,
      description = excluded.description, criteria = excluded.criteria,
      organization = excluded.organization, official_url = excluded.official_url,
      notes = excluded.notes, sources_json = excluded.sources_json
    RETURNING id`)
  const clearMembers = db.prepare("DELETE FROM list_peaks WHERE list_id = ?")
  const addMember = db.prepare(
    "INSERT OR REPLACE INTO list_peaks (list_id, peak_id, rank, notes) VALUES (?, ?, ?, ?)"
  )

  db.exec("BEGIN")
  try {
    for (const list of lists) {
      const { id: listId } = upsertList.get(
        list.slug,
        list.name,
        list.shortName ?? null,
        list.region ?? null,
        list.description ?? null,
        list.criteria ?? null,
        list.organization ?? null,
        list.officialUrl ?? null,
        list.notes ?? null,
        JSON.stringify(list.sources ?? [])
      ) as { id: number }
      clearMembers.run(listId)
      list.peaks.forEach((p, i) => {
        const { id: peakId } = upsertPeak.get(
          p.slug,
          p.name,
          p.elevationFt ?? null,
          p.state ?? null,
          p.range ?? null,
          p.lat ?? null,
          p.lon ?? null,
          null
        ) as { id: number }
        for (const a of [p.name, ...(p.aliases ?? [])]) {
          const n = normalizePeakName(a)
          if (n) addAlias.run(peakId, n)
        }
        addMember.run(listId, peakId, p.rank ?? i + 1, p.notes ?? null)
      })
    }
    db.prepare(
      "INSERT INTO meta (key, value) VALUES ('seed_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(hash)
    db.exec("COMMIT")
  } catch (e) {
    db.exec("ROLLBACK")
    throw e
  }
}
