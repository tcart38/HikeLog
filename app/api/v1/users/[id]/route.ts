import { z } from "zod"
import { listUsers, setPassword } from "@/lib/auth"
import { ApiError, intParam, json, readJson, withAuth } from "@/lib/api"
import { run } from "@/lib/db"

const schema = z.object({ password: z.string().min(8).max(200).optional(), isAdmin: z.boolean().optional() })

/** Admins can edit anyone; other users may only change their own password. */
export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  const id = intParam(params.id)
  const b = schema.parse(await readJson(req))
  if (!user.is_admin && (id !== user.id || b.isAdmin !== undefined)) throw new ApiError("Admin only", 403)
  const target = listUsers().find((u) => u.id === id)
  if (!target) throw new ApiError("User not found", 404)
  if (b.isAdmin === false && target.is_admin && listUsers().filter((u) => u.is_admin).length <= 1)
    throw new ApiError("Cannot remove the last admin", 409)
  if (b.isAdmin !== undefined) run("UPDATE users SET is_admin = ? WHERE id = ?", b.isAdmin ? 1 : 0, id)
  if (b.password) setPassword(id, b.password)
  return json({ user: listUsers().find((u) => u.id === id) })
})
