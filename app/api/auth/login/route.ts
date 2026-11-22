import { cookies } from "next/headers"
import { z } from "zod"
import { SESSION_COOKIE, createSession, findUserByLogin, sessionCookieOptions } from "@/lib/auth"
import { error, handle, json, readJson } from "@/lib/api"
import { getPerson } from "@/lib/people"

const schema = z.object({ username: z.string().min(1), password: z.string().min(1) })

// Naive in-memory brute-force guard: 10 failures per username per 15 minutes.
const failures = new Map<string, { n: number; reset: number }>()

export const POST = handle(async (req) => {
  const { username, password } = schema.parse(await readJson(req))
  const key = username.trim().toLowerCase()
  const f = failures.get(key)
  if (f && f.reset > Date.now() && f.n >= 10) return error("Too many attempts. Try again later.", 429)
  const user = findUserByLogin(username, password)
  if (!user) {
    const cur = f && f.reset > Date.now() ? f : { n: 0, reset: Date.now() + 15 * 60_000 }
    cur.n++
    failures.set(key, cur)
    return error("Invalid username or password", 401)
  }
  failures.delete(key)
  const { token, expires } = createSession(user.id)
  ;(await cookies()).set(SESSION_COOKIE, token, await sessionCookieOptions(expires))
  return json({ user, person: user.person_id ? getPerson(user.person_id) : null })
})
