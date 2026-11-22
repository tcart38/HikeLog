import { cookies } from "next/headers"
import { z } from "zod"
import { SESSION_COOKIE, createSession, createUser, sessionCookieOptions, signupOpen } from "@/lib/auth"
import { error, handle, json, readJson } from "@/lib/api"

const schema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9._-]+$/, "letters, digits, . _ - only"),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(80).optional(),
})

export const POST = handle(async (req) => {
  if (!signupOpen()) return error("Signup is closed. Ask an admin to create your account.", 403)
  const body = schema.parse(await readJson(req))
  let user
  try {
    user = createUser(body.username, body.password, body.displayName)
  } catch (e) {
    if (String(e).includes("UNIQUE")) return error("Username already taken", 409)
    throw e
  }
  const { token, expires } = createSession(user.id)
  ;(await cookies()).set(SESSION_COOKIE, token, await sessionCookieOptions(expires))
  return json({ user }, 201)
})
