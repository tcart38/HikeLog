import "server-only"
import { ApiError, requirePerson } from "./api"
import type { User } from "./auth"

/** `?person=1,Sam` -> person ids. Defaults to the caller's own person; throws 404 for unknown people. */
export function peopleParam(v: string | null, user: User): number[] {
  const refs = (v ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  if (!refs.length) {
    if (!user.person_id) throw new ApiError("Pass ?person= (this user has no linked person)", 400)
    return [user.person_id]
  }
  return [...new Set(refs.map((r) => requirePerson(r).id))]
}
