import { cookies } from "next/headers"
import { z } from "zod"
import { SESSION_COOKIE, createSession, createUser, sameOrigin, sessionCookieOptions, signupOpen, userCount } from "@/lib/auth"
import { error, handle, json, readJson } from "@/lib/api"

const schema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9._-]+$/, "letters, digits, . _ - only"),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(80).optional(),
})

// Naive in-memory rate limit: 5 attempts per client per hour, 50 per hour overall.
const WINDOW_MS = 60 * 60_000
const attempts = new Map<string, number[]>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  for (const k of [key, "*"]) {
    const recent = (attempts.get(k) ?? []).filter((t) => now - t < WINDOW_MS)
    if (recent.length >= (k === "*" ? 50 : 5)) {
      attempts.set(k, recent)
      return true
    }
    recent.push(now)
    attempts.set(k, recent)
  }
  return false
}

export const POST = handle(async (req) => {
  // Enforced here, not just by hiding the link: the setting is checked on every request.
  if (!signupOpen()) return error("Sign-up is closed. Ask an admin to create your account.", 403)
  if (!sameOrigin(req)) return error("Cross-origin request blocked", 403)
  const first = userCount() === 0
  // The first-run admin account is not rate limited; public sign-ups are.
  if (!first) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
    if (rateLimited(ip)) return error("Too many sign-up attempts. Try again later.", 429)
  }
  const body = schema.parse(await readJson(req))
  let user
  try {
    // Self-registered accounts always get a fresh person, so signing up with someone's
    // name can never attach to (and expose) an existing person's hikes.
    user = createUser(body.username, body.password, body.displayName, false, { linkExistingPerson: first })
  } catch (e) {
    if (String(e).includes("UNIQUE")) return error("Username already taken", 409)
    throw e
  }
  const { token, expires } = createSession(user.id)
  ;(await cookies()).set(SESSION_COOKIE, token, await sessionCookieOptions(expires))
  return json({ user }, 201)
})
