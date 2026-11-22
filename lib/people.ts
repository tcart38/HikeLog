import "server-only"
import { all, get, run, tx } from "./db"
import { HikeError } from "./hikes"

export type Person = {
  id: number
  name: string
  color: string | null
  created_at: string
  user_id: number | null
  username: string | null
  hike_count: number
  peak_count: number
}

const SELECT = `
  SELECT p.id, p.name, p.color, p.created_at, u.id user_id, u.username,
    (SELECT COUNT(*) FROM hike_participants hp WHERE hp.person_id = p.id AND hp.counts = 1) hike_count,
    (SELECT COUNT(DISTINCT hk.peak_id) FROM hike_participants hp JOIN hike_peaks hk ON hk.hike_id = hp.hike_id
       WHERE hp.person_id = p.id AND hp.counts = 1) peak_count
  FROM people p LEFT JOIN users u ON u.person_id = p.id`

export function listPeople(): Person[] {
  return all<Person>(`${SELECT} ORDER BY p.name COLLATE NOCASE`)
}

export function getPerson(id: number): Person | null {
  return get<Person>(`${SELECT} WHERE p.id = ?`, id) ?? null
}

/** Find by numeric id or case-insensitive name. */
export function findPerson(ref: string | number): { id: number; name: string; color: string | null } | null {
  const s = String(ref).trim()
  if (/^\d+$/.test(s)) {
    const r = get<{ id: number; name: string; color: string | null }>("SELECT id, name, color FROM people WHERE id = ?", Number(s))
    if (r) return r
  }
  return get<{ id: number; name: string; color: string | null }>("SELECT id, name, color FROM people WHERE name = ? COLLATE NOCASE", s) ?? null
}

function cleanName(name: unknown): string {
  if (typeof name !== "string" || !name.trim()) throw new HikeError("name is required", undefined, 400)
  return name.trim().slice(0, 80)
}
function cleanColor(color: unknown): string | null {
  if (color === null || color === undefined || color === "") return null
  if (typeof color !== "string" || !/^#[0-9a-fA-F]{3,8}$|^[a-z]{3,20}$/.test(color)) throw new HikeError("color must be a hex color like #3a7d44", undefined, 400)
  return color
}

export function createPerson(input: { name: unknown; color?: unknown }, userId: number | null): Person {
  const name = cleanName(input.name)
  if (findPerson(name)) throw new HikeError(`A person named "${name}" already exists`, undefined, 409)
  const id = Number(run("INSERT INTO people (name, color, created_by) VALUES (?, ?, ?)", name, cleanColor(input.color), userId).lastInsertRowid)
  return getPerson(id)!
}

export function updatePerson(id: number, input: { name?: unknown; color?: unknown }): Person {
  const cur = getPerson(id)
  if (!cur) throw new HikeError("Person not found", undefined, 404)
  const name = input.name === undefined ? cur.name : cleanName(input.name)
  const color = input.color === undefined ? cur.color : cleanColor(input.color)
  const clash = findPerson(name)
  if (clash && clash.id !== id) throw new HikeError(`A person named "${name}" already exists. Use merge instead.`, undefined, 409)
  run("UPDATE people SET name = ?, color = ? WHERE id = ?", name, color, id)
  return getPerson(id)!
}

/** Refuses when linked to a login, or (unless force) when they have hikes. */
export function deletePerson(id: number, force = false): void {
  const p = getPerson(id)
  if (!p) throw new HikeError("Person not found", undefined, 404)
  if (p.user_id) throw new HikeError(`Person is linked to user "${p.username}"; delete the account first`, undefined, 409)
  const n = get<{ n: number }>("SELECT COUNT(*) n FROM hike_participants WHERE person_id = ?", id)!.n
  if (n && !force) throw new HikeError(`Person is on ${n} hike(s). Merge into someone else, or pass ?force=1 to delete their participation.`, undefined, 409)
  run("DELETE FROM people WHERE id = ?", id)
}

/** Move all of `sourceId`'s participations to `targetId`, drop duplicates, delete the source. */
export function mergePeople(sourceId: number, targetId: number): Person {
  if (sourceId === targetId) throw new HikeError("Cannot merge a person into themselves", undefined, 400)
  const src = getPerson(sourceId)
  const dst = getPerson(targetId)
  if (!src || !dst) throw new HikeError("Person not found", undefined, 404)
  if (src.user_id) throw new HikeError(`"${src.name}" is linked to a user account; merge the other way round`, undefined, 409)
  tx((d) => {
    const parts = d.prepare("SELECT hike_id, counts, note FROM hike_participants WHERE person_id = ?").all(sourceId) as {
      hike_id: number
      counts: number
      note: string | null
    }[]
    for (const p of parts) {
      const ex = d.prepare("SELECT counts FROM hike_participants WHERE hike_id = ? AND person_id = ?").get(p.hike_id, targetId) as
        | { counts: number }
        | undefined
      if (ex) {
        if (p.counts > ex.counts) d.prepare("UPDATE hike_participants SET counts = 1 WHERE hike_id = ? AND person_id = ?").run(p.hike_id, targetId)
      } else {
        d.prepare("INSERT INTO hike_participants (hike_id, person_id, counts, note) VALUES (?, ?, ?, ?)").run(p.hike_id, targetId, p.counts, p.note)
      }
    }
    d.prepare("DELETE FROM people WHERE id = ?").run(sourceId) // cascades remaining source participations
  })
  return getPerson(targetId)!
}
