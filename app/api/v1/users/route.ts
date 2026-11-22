import { z } from "zod"
import { createUser, listUsers } from "@/lib/auth"
import { ApiError, json, readJson, withAuth } from "@/lib/api"
import { getPerson } from "@/lib/people"

const schema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9._-]+$/),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(80).optional(),
  isAdmin: z.boolean().optional(),
})

export const GET = withAuth(
  async () => json({ users: listUsers().map((u) => ({ ...u, person: u.person_id ? getPerson(u.person_id) : null })) }),
  { admin: true }
)

export const POST = withAuth(
  async (req) => {
    const b = schema.parse(await readJson(req))
    try {
      const user = createUser(b.username, b.password, b.displayName, b.isAdmin)
      return json({ user, person: user.person_id ? getPerson(user.person_id) : null }, 201)
    } catch (e) {
      if (String(e).includes("UNIQUE")) throw new ApiError("Username already taken", 409)
      throw e
    }
  },
  { admin: true }
)
