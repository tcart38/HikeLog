import "server-only"
import { Readable } from "node:stream"
import ExcelJS from "exceljs"
import { get, tx } from "../db"
import { HikeError, saveHike, type HikeInput } from "../hikes"
import { matchPeak, type MatchResult, type PeakRow } from "../peaks/match"
import { normalizePeakName, splitPeakNames } from "../peaks/normalize"
import { findPerson } from "../people"
import { type Mode } from "../progress"
import { appTimeZone, isWinterHike, seasonOf } from "../seasons"
import { expandTraverse } from "./traverses"

type Cell = string | number | boolean | Date | null
type SheetRows = { name: string; rows: { n: number; cells: Cell[] }[] }

export type PreviewRow = {
  row: number
  action: "create" | "update" | "skipped"
  date: string | null
  endDate: string | null
  conditions: "snow" | "no_snow" | "mix" | null
  peaks: MatchResult[]
  unmatchedPeaks: string[]
  participants: { name: string; counts: boolean; note: string | null; isOwner: boolean; isNew: boolean }[]
  weather: string | null
  trailConditions: string | null
  otherLists: string | null
  notes: string | null
  externalId: string | null
  warnings: string[]
}

export type Reconcile = {
  sheet: string
  mode: Mode
  /** Sheet marks done, the imported log does not credit the owner. */
  sheetOnly: string[]
  /** Sheet marks not done, the imported log credits the owner. */
  logOnly: string[]
  unmatchedNames: string[]
}

export type ImportResult = {
  dryRun: boolean
  logSheet: string
  owner: { id: number | null; name: string }
  rows: PreviewRow[]
  summary: { rows: number; create: number; update: number; skipped: number; warnings: number; unmatchedPeaks: string[]; newPeople: string[] }
  reconcile: Reconcile[]
  created?: number
  updated?: number
  skipped?: number
}

// ---------- reading ----------
function cellValue(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join("")
    if ("result" in o) return cellValue(o.result as ExcelJS.CellValue)
    if (typeof o.text === "string") return o.text
    return null // errors etc.
  }
  return v
}

async function readSheets(buf: Buffer, filename: string): Promise<SheetRows[]> {
  const isXlsx = buf.length > 3 && buf[0] === 0x50 && buf[1] === 0x4b
  if (!isXlsx) {
    if (/\.xlsx?$/i.test(filename)) throw new HikeError("File is not a valid .xlsx workbook", undefined, 400)
    return [{ name: "csv", rows: parseCsv(buf.toString("utf8").replace(/^﻿/, "")).map((cells, i) => ({ n: i + 1, cells })) }]
  }
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.read(Readable.from(buf))
  } catch {
    throw new HikeError("Could not read the workbook", undefined, 400)
  }
  return wb.worksheets.map((ws) => {
    const rows: SheetRows["rows"] = []
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      const cells: Cell[] = []
      row.eachCell({ includeEmpty: true }, (c, col) => {
        cells[col - 1] = cellValue(c.value)
      })
      rows.push({ n, cells })
    })
    return { name: ws.name, rows }
  })
}

/** Minimal RFC 4180 parser (kept dependency-free so dates stay strings). */
function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let cur = ""
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else q = false
      } else cur += c
    } else if (c === '"') q = true
    else if (c === ",") {
      row.push(cur)
      cur = ""
    }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(cur)
      cur = ""
      out.push(row)
      row = []
    } else cur += c
  }
  if (cur || row.length) {
    row.push(cur)
    out.push(row)
  }
  return out
}

// ---------- header detection ----------
const key = (v: Cell) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
type Cols = Partial<Record<"date" | "season" | "conditions" | "mountains" | "otherLists" | "weather" | "trail" | "partners" | "notes", number>>

function mapColumns(cells: Cell[]): Cols {
  const c: Cols = {}
  cells.forEach((h, i) => {
    const k = key(h)
    if (!k) return
    const set = (name: keyof Cols) => (c[name] ??= i)
    if (k.startsWith("date")) set("date")
    else if (k === "season") set("season")
    else if (k.includes("snow") || k === "conditions") set("conditions")
    else if (k.startsWith("mountain") || k.startsWith("peak") || k.startsWith("summit")) set("mountains")
    else if (k.includes("otherlist")) set("otherLists")
    else if (k.startsWith("weather")) set("weather")
    else if (k.includes("trail")) set("trail")
    else if (k.includes("partner") || k.includes("companion") || k === "hikingwith") set("partners")
    else if (k.startsWith("note") || k.startsWith("comment")) set("notes")
  })
  return c
}

function findLog(sheets: SheetRows[]): { sheet: SheetRows; headerIdx: number; cols: Cols } {
  for (const sheet of sheets) {
    for (let i = 0; i < Math.min(sheet.rows.length, 10); i++) {
      const cols = mapColumns(sheet.rows[i].cells)
      if (cols.date !== undefined && cols.mountains !== undefined) return { sheet, headerIdx: i, cols }
    }
  }
  throw new HikeError("Could not find a log sheet: need a header row with at least Date and Mountain(s) columns", undefined, 422)
}

// ---------- values ----------
const pad = (n: number) => String(n).padStart(2, "0")
function ymd(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null
}
const fullYear = (y: number) => (y < 100 ? 2000 + y : y)

export function parseDateCell(v: Cell): { date: string; endDate: string | null } | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : { date: ymd(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate())!, endDate: null }
  if (typeof v === "number") {
    const dt = new Date(Math.round((v - 25569) * 86400000))
    return { date: ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())!, endDate: null }
  }
  if (typeof v !== "string") return null
  const s = v.trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    const date = ymd(+m[1], +m[2], +m[3])
    return date ? { date, endDate: null } : null
  }
  // m/d/yy, m/d-d/yy, m/d-m/d/yy
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\s*[-–]\s*(?:(\d{1,2})\/)?(\d{1,2}))?\/(\d{2,4})$/)
  if (!m) return null
  const y = fullYear(+m[5])
  const m1 = +m[1]
  const m2 = m[3] ? +m[3] : m1
  const date = ymd(m2 < m1 ? y - 1 : y, m1, +m[2])
  if (!date) return null
  if (!m[4]) return { date, endDate: null }
  const endDate = ymd(y, m2, +m[4])
  return endDate && endDate >= date ? { date, endDate } : { date, endDate: null }
}

function text(v: Cell): string | null {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  return s || null
}

function parseConditions(s: string | null): { value: "snow" | "no_snow" | "mix" | null; bad: boolean } {
  if (!s) return { value: null, bad: false }
  const k = key(s)
  if (k === "snow") return { value: "snow", bad: false }
  if (k === "nosnow") return { value: "no_snow", bad: false }
  if (k === "mix" || k === "mixed") return { value: "mix", bad: false }
  return { value: null, bad: true }
}

type Partner = { name: string; counts: boolean; note: string | null }
function parsePartners(s: string | null, warnings: string[]): Partner[] {
  if (!s) return []
  const out: Partner[] = []
  for (const raw of s.split(/\s*(?:,|&|;|\/|\band\b)\s*/i)) {
    let name = raw.trim()
    if (!name || key(name) === "solo") continue
    let counts = true
    let note: string | null = null
    const ish = name.match(/^(.*?)[\s(]+ish\)?$/i)
    if (ish && ish[1].trim()) {
      name = ish[1].trim()
      counts = false
      note = "partial (ish)"
      warnings.push(`"${name}" marked "ish": added without credit (counts=false)`)
    }
    out.push({ name, counts, note })
  }
  return out
}

// ---------- main ----------
export type ImportOptions = {
  /** Person id or name of the log owner. */
  self?: string | number | null
  /** Used when `self` is not given (the caller's own person). */
  defaultPersonId: number | null
  userId: number
  dryRun: boolean
}

type Parsed = { preview: PreviewRow; input: HikeInput | null; peakIds: number[]; seasonModes: Mode[] }

export async function importLog(file: { name: string; buffer: Buffer }, opts: ImportOptions): Promise<ImportResult> {
  const sheets = await readSheets(file.buffer, file.name)
  const { sheet: logSheet, headerIdx, cols } = findLog(sheets)

  // owner
  let owner: { id: number | null; name: string }
  const selfRef = opts.self !== undefined && opts.self !== null && String(opts.self).trim() ? String(opts.self).trim() : null
  if (selfRef) {
    const p = findPerson(selfRef)
    owner = p ? { id: p.id, name: p.name } : { id: null, name: selfRef }
  } else if (opts.defaultPersonId) {
    const p = findPerson(opts.defaultPersonId)
    if (!p) throw new HikeError("Caller's person not found", undefined, 400)
    owner = { id: p.id, name: p.name }
  } else throw new HikeError("No log owner: pass `self` (a person id or name)", undefined, 400)

  const tz = appTimeZone()
  const seenKeys = new Map<string, number>()
  const parsed: Parsed[] = []
  const expandNames = (mountains: string | null) => {
    const names: string[] = []
    const expansions: string[] = []
    for (const nm of splitPeakNames(mountains ?? "")) {
      const ex = expandTraverse(nm)
      if (ex) {
        expansions.push(`Expanded "${nm}" to ${ex.join(", ")}`)
        names.push(...ex)
      } else names.push(nm)
    }
    return { names, expansions }
  }

  // Pre-pass: the log's dominant states (by unambiguous matches) resolve names like "Adams" or "Lincoln"
  // that exist in several states, when a single-peak row gives no sibling context.
  const stateCounts = new Map<string, number>()
  for (const { cells } of logSheet.rows.slice(headerIdx + 1)) {
    for (const nm of expandNames(text(cols.mountains === undefined ? null : (cells[cols.mountains] ?? null))).names) {
      const m = matchPeak(nm)
      if (m.status === "matched" && m.peak.state) stateCounts.set(m.peak.state, (stateCounts.get(m.peak.state) ?? 0) + 1)
    }
  }
  const statesByFreq = [...stateCounts.entries()].sort((a, b) => b[1] - a[1]).map(([st]) => st)

  const matchCache = new Map<string, MatchResult>()
  const cachedMatch = (n: string): MatchResult => {
    let m = matchCache.get(n)
    if (!m) {
      m = matchPeak(n)
      if (m.status === "ambiguous") {
        for (const st of statesByFreq) {
          const inState = m.candidates.filter((c) => c.state === st)
          if (inState.length === 1) {
            m = { input: n, status: "matched", peak: inState[0], via: "context" }
            break
          }
        }
      }
      matchCache.set(n, m)
    }
    return m
  }

  for (const { n, cells } of logSheet.rows.slice(headerIdx + 1)) {
    const at = (c: number | undefined) => (c === undefined ? null : (cells[c] ?? null))
    const dateCell = at(cols.date)
    const mountains = text(at(cols.mountains))
    if (text(dateCell) === null && !mountains) {
      // only report rows that have some other content; fully blank rows are ignored
      const any = cells.some((c) => text(c ?? null))
      if (any) parsed.push(skipped(n, "No date and no mountains"))
      continue
    }
    const warnings: string[] = []
    const dates = parseDateCell(dateCell)
    if (!dates) {
      parsed.push(skipped(n, `Missing or unreadable date: ${JSON.stringify(text(dateCell))}`))
      continue
    }

    const cond = parseConditions(text(at(cols.conditions)))
    if (cond.bad) warnings.push(`Unrecognised Snow/No Snow value "${text(at(cols.conditions))}"; left blank`)

    const seasonCell = text(at(cols.season))
    const computed = seasonOf(dates.date, tz)
    if (seasonCell && key(seasonCell) !== computed) warnings.push(`Season column says "${seasonCell}" but ${dates.date} is ${computed}; using computed`)

    // peaks
    const { names, expansions } = expandNames(mountains)
    warnings.push(...expansions)
    const peaks = names.map(cachedMatch)
    const matched = new Map<number, PeakRow>()
    const unmatched: string[] = []
    for (const m of peaks) {
      if (m.status === "matched") {
        matched.set(m.peak.id, m.peak)
        // sibling-context matches inside matchPeaks are not reached here (we match one name at a time)
        if (m.via === "context") warnings.push(`"${m.input}" was ambiguous; resolved to ${m.peak.name} (${m.peak.state}) from the log's most common states`)
      } else {
        unmatched.push(m.input)
        warnings.push(
          m.status === "ambiguous"
            ? `Ambiguous peak "${m.input}" (${m.candidates.map((c) => c.name).join(" / ")}); kept as unmatched text`
            : `Unmatched peak "${m.input}"${m.suggestions.length ? ` (did you mean ${m.suggestions.map((s) => s.name).join(", ")}?)` : ""}`
        )
      }
    }
    if (!names.length) warnings.push("No mountains listed")
    const peakIds = [...matched.keys()]

    // people
    const partners = parsePartners(text(at(cols.partners)), warnings)
    const ownerKey = owner.name.toLowerCase()
    const seen = new Set([ownerKey])
    const others = partners.filter((p) => {
      const k = p.name.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    const participants: PreviewRow["participants"] = [
      { name: owner.name, counts: true, note: null, isOwner: true, isNew: owner.id === null },
      ...others.map((p) => ({ ...p, isOwner: false, isNew: !findPerson(p.name) })),
    ]

    // idempotency
    const sig = [...[...matched.values()].map((p) => p.slug).sort(), ...unmatched.map(normalizePeakName).sort()].join(",") || normalizePeakName(mountains ?? "") || "none"
    const externalId = `xlsx:${dates.date}:${sig}`
    const dupOf = seenKeys.get(externalId)
    if (dupOf) warnings.push(`Same date and peaks as row ${dupOf}; this row will overwrite it`)
    seenKeys.set(externalId, n)
    const exists = !!get("SELECT 1 FROM hikes WHERE external_id = ?", externalId) || !!dupOf

    const weather = text(at(cols.weather))
    const trail = text(at(cols.trail))
    const other = text(at(cols.otherLists))
    const notes = text(at(cols.notes))

    const input: HikeInput = {
      date: dates.date,
      endDate: dates.endDate,
      peaks: [...peakIds, ...unmatched],
      participants: [
        owner.id !== null ? owner.id : owner.name,
        ...others.map((p) => (p.counts ? p.name : { person: p.name, counts: false, note: p.note ?? undefined })),
      ],
      conditions: cond.value,
      weather,
      trailConditions: trail,
      otherLists: other,
      notes,
      externalId,
    }
    const modes: Mode[] = ["all", computed]
    if (isWinterHike(dates.date, dates.endDate, tz)) modes.push("winter")
    if (cond.value) modes.push(cond.value)
    parsed.push({
      preview: {
        row: n,
        action: exists ? "update" : "create",
        date: dates.date,
        endDate: dates.endDate,
        conditions: cond.value,
        peaks,
        unmatchedPeaks: unmatched,
        participants,
        weather,
        trailConditions: trail,
        otherLists: other,
        notes,
        externalId,
        warnings,
      },
      input,
      peakIds,
      seasonModes: modes,
    })
  }

  const rows = parsed.map((p) => p.preview)
  const importable = parsed.filter((p) => p.input)
  const reconcile = reconcileSheets(sheets, logSheet, importable)
  const newPeople = [...new Set(rows.flatMap((r) => r.participants.filter((p) => p.isNew).map((p) => p.name)))]
  const summary = {
    rows: rows.length,
    create: rows.filter((r) => r.action === "create").length,
    update: rows.filter((r) => r.action === "update").length,
    skipped: rows.filter((r) => r.action === "skipped").length,
    warnings: rows.reduce((a, r) => a + r.warnings.length, 0),
    unmatchedPeaks: [...new Set(rows.flatMap((r) => r.unmatchedPeaks))],
    newPeople,
  }
  const result: ImportResult = { dryRun: opts.dryRun, logSheet: logSheet.name, owner, rows, summary, reconcile }
  if (opts.dryRun) return result

  // Commit all rows in one transaction (nested tx in saveHike uses savepoints).
  let created = 0
  let updated = 0
  tx(() => {
    for (const p of importable) {
      const r = saveHike(p.input!, { userId: opts.userId, userPersonId: owner.id, source: "import" })
      if (r.created) created++
      else updated++
    }
  })
  return { ...result, created, updated, skipped: summary.skipped }
}

function skipped(row: number, why: string): Parsed {
  return {
    preview: {
      row, action: "skipped", date: null, endDate: null, conditions: null, peaks: [], unmatchedPeaks: [], participants: [],
      weather: null, trailConditions: null, otherLists: null, notes: null, externalId: null, warnings: [why],
    },
    input: null,
    peakIds: [],
    seasonModes: [],
  }
}

// ---------- checklist reconciliation (never creates hikes) ----------
const MODE_BY_HEADER: Record<string, Mode> = {
  winter: "winter", spring: "spring", summer: "summer", fall: "fall", autumn: "fall",
  snow: "snow", nosnow: "no_snow", mix: "mix", mixed: "mix", hiked: "all", done: "all", completed: "all",
}

function mark(v: Cell): boolean | null {
  if (v === null || v === undefined || v === "") return null
  if (typeof v === "boolean") return v
  const s = String(v).toLowerCase()
  if (s.includes("✅") || s.includes("✔") || s === "yes" || s === "y" || s === "true" || s === "x") return true
  if (s.includes("❌") || s.includes("✖") || s === "no" || s === "n" || s === "false") return false
  return null
}

function reconcileSheets(sheets: SheetRows[], log: SheetRows, imported: Parsed[]): Reconcile[] {
  const credited = new Map<number, Set<Mode>>()
  for (const p of imported)
    for (const id of p.peakIds) {
      const s = credited.get(id) ?? new Set<Mode>()
      p.seasonModes.forEach((m) => s.add(m))
      credited.set(id, s)
    }
  const out: Reconcile[] = []
  for (const sheet of sheets) {
    if (sheet === log || !sheet.rows.length) continue
    const header = sheet.rows[0].cells
    const modeCols: [number, Mode][] = []
    const used = new Set<Mode>()
    header.forEach((h, i) => {
      const m = i > 0 ? MODE_BY_HEADER[key(h)] : undefined
      if (m && !used.has(m)) {
        used.add(m)
        modeCols.push([i, m])
      }
    })
    if (!modeCols.length) continue
    const acc = new Map<Mode, Reconcile>(modeCols.map(([, m]) => [m, { sheet: sheet.name, mode: m, sheetOnly: [], logOnly: [], unmatchedNames: [] }]))
    for (const { cells } of sheet.rows.slice(1)) {
      const name = text(cells[0] ?? null)
      if (!name) continue
      const m = cachedPeak(name)
      for (const [col, mode] of modeCols) {
        const r = acc.get(mode)!
        const v = mark(cells[col] ?? null)
        if (v === null) continue
        if (!m) {
          if (!r.unmatchedNames.includes(name)) r.unmatchedNames.push(name)
          continue
        }
        const logHas = credited.get(m.id)?.has(mode) ?? false
        if (v && !logHas) r.sheetOnly.push(m.name)
        if (!v && logHas) r.logOnly.push(m.name)
      }
    }
    out.push(...acc.values())
  }
  return out
}

function cachedPeak(name: string): PeakRow | null {
  const m = matchPeak(name)
  return m.status === "matched" ? m.peak : null
}
