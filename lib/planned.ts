import "server-only"
import { z } from "zod"
import { all, get, tx } from "./db"
import { HikeError } from "./hikes"

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`)
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
  }, "Not a real calendar date")

export const plannedInputSchema = z.object({
  personId: z.number().int(),
  name: z.string().trim().min(1, "Give the plan a name").max(200),
  targetDate: dateSchema.nullish(),
  notes: z.string().max(4000).nullish(),
  /** Peak ids in the order planned. */
  peakIds: z.array(z.number().int()).min(1, "Pick at least one peak").max(60),
})
export type PlannedInput = z.input<typeof plannedInputSchema>

export type PlannedPeak = { id: number; slug: string; name: string; elevationFt: number | null }
export type PlannedHike = {
  id: number
  personId: number
  name: string
  targetDate: string | null
  notes: string | null
  hikeId: number | null
  doneAt: string | null
  peaks: PlannedPeak[]
}

type Row = { id: number; person_id: number; name: string; target_date: string | null; notes: string | null; hike_id: number | null; done_at: string | null }

function hydrate(rows: Row[]): PlannedHike[] {
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  const peaks = all<{ planned_hike_id: number; id: number; slug: string; name: string; elevation_ft: number | null }>(
    `SELECT ph.planned_hike_id, p.id, p.slug, p.name, p.elevation_ft
     FROM planned_hike_peaks ph JOIN peaks p ON p.id = ph.peak_id
     WHERE ph.planned_hike_id IN (${ids.map(() => "?").join(",")}) ORDER BY ph.ordinal`,
    ...ids
  )
  return rows.map((r) => ({
    id: r.id,
    personId: r.person_id,
    name: r.name,
    targetDate: r.target_date,
    notes: r.notes,
    hikeId: r.hike_id,
    doneAt: r.done_at,
    peaks: peaks.filter((p) => p.planned_hike_id === r.id).map((p) => ({ id: p.id, slug: p.slug, name: p.name, elevationFt: p.elevation_ft })),
  }))
}

/** Plans for a person, soonest target date first (undated last). Open plans only unless `done` is set. */
export function listPlans(personId: number, opts: { done?: boolean } = {}): PlannedHike[] {
  return hydrate(
    all<Row>(
      `SELECT * FROM planned_hikes WHERE person_id = ? AND done_at IS ${opts.done ? "NOT" : ""} NULL
       ORDER BY target_date IS NULL, target_date, id`,
      personId
    )
  )
}

export function getPlan(id: number): PlannedHike | null {
  return hydrate(all<Row>("SELECT * FROM planned_hikes WHERE id = ?", id))[0] ?? null
}

function checkPeaks(personId: number, peakIds: number[], exceptPlanId?: number) {
  const unique = [...new Set(peakIds)]
  const found = all<{ id: number }>(`SELECT id FROM peaks WHERE id IN (${unique.map(() => "?").join(",")})`, ...unique)
  if (found.length !== unique.length) throw new HikeError("One or more peaks don't exist", undefined, 404)
  // A peak belongs to at most one open plan per person, so "unplanned" is unambiguous.
  const clash = get<{ name: string; peak: string }>(
    `SELECT ph.name, p.name peak FROM planned_hike_peaks pp
       JOIN planned_hikes ph ON ph.id = pp.planned_hike_id AND ph.person_id = ? AND ph.done_at IS NULL AND ph.id IS NOT ?
       JOIN peaks p ON p.id = pp.peak_id
     WHERE pp.peak_id IN (${unique.map(() => "?").join(",")}) LIMIT 1`,
    personId,
    exceptPlanId ?? null,
    ...unique
  )
  if (clash) throw new HikeError(`${clash.peak} is already in the planned hike "${clash.name}"`, undefined, 409)
  return unique
}

export function savePlan(input: unknown, opts: { id?: number; userId: number }): PlannedHike {
  const v = plannedInputSchema.parse(input)
  const id = tx((d) => {
    if (!get("SELECT 1 x FROM people WHERE id = ?", v.personId)) throw new HikeError("Person not found", undefined, 404)
    let planId = opts.id
    if (planId != null) {
      const cur = get<{ done_at: string | null }>("SELECT done_at FROM planned_hikes WHERE id = ?", planId)
      if (!cur) throw new HikeError("Planned hike not found", undefined, 404)
      if (cur.done_at) throw new HikeError("This planned hike is already done. Reopen it to edit.", undefined, 409)
    }
    const peakIds = checkPeaks(v.personId, v.peakIds, planId)
    if (planId == null) {
      planId = Number(
        d
          .prepare("INSERT INTO planned_hikes (person_id, name, target_date, notes, created_by) VALUES (?,?,?,?,?)")
          .run(v.personId, v.name, v.targetDate ?? null, v.notes?.trim() || null, opts.userId).lastInsertRowid
      )
    } else {
      d.prepare("UPDATE planned_hikes SET person_id = ?, name = ?, target_date = ?, notes = ?, updated_at = datetime('now') WHERE id = ?").run(
        v.personId,
        v.name,
        v.targetDate ?? null,
        v.notes?.trim() || null,
        planId
      )
      d.prepare("DELETE FROM planned_hike_peaks WHERE planned_hike_id = ?").run(planId)
    }
    const ins = d.prepare("INSERT INTO planned_hike_peaks (planned_hike_id, peak_id, ordinal) VALUES (?,?,?)")
    peakIds.forEach((pid, i) => ins.run(planId!, pid, i))
    return planId
  })
  return getPlan(id)!
}

/** Mark done, optionally linking the logged hike. `done: false` reopens it. */
export function setPlanDone(id: number, done: boolean, hikeId?: number | null): PlannedHike {
  tx((d) => {
    const cur = getPlan(id)
    if (!cur) throw new HikeError("Planned hike not found", undefined, 404)
    if (done) {
      if (hikeId != null && !get("SELECT 1 x FROM hikes WHERE id = ?", hikeId)) throw new HikeError("Hike not found", undefined, 404)
      d.prepare("UPDATE planned_hikes SET done_at = datetime('now'), hike_id = ?, updated_at = datetime('now') WHERE id = ?").run(hikeId ?? null, id)
    } else {
      // Reopening must not collide with a newer plan that took one of these peaks.
      checkPeaks(cur.personId, cur.peaks.map((p) => p.id), id)
      d.prepare("UPDATE planned_hikes SET done_at = NULL, hike_id = NULL, updated_at = datetime('now') WHERE id = ?").run(id)
    }
  })
  return getPlan(id)!
}

export function deletePlan(id: number): boolean {
  return tx((d) => d.prepare("DELETE FROM planned_hikes WHERE id = ?").run(id).changes > 0)
}

/**
 * "X peaks left across Y planned hikes": given the peaks still needed (ids), how many open plans cover at least one
 * of them, and which needed peaks are in no plan.
 */
export function planCoverage(plans: PlannedHike[], neededPeakIds: number[]) {
  const needed = new Set(neededPeakIds)
  const planned = new Set<number>()
  const active = plans.filter((p) => p.peaks.some((k) => needed.has(k.id)))
  for (const p of active) for (const k of p.peaks) if (needed.has(k.id)) planned.add(k.id)
  return {
    activePlans: active,
    plannedPeaks: planned.size,
    unplannedIds: neededPeakIds.filter((id) => !planned.has(id)),
  }
}
