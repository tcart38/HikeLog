import "server-only"
import crypto from "node:crypto"
import { cookies, headers } from "next/headers"
import { all, get, run, tx } from "./db"

export const SESSION_COOKIE = "hikelog_session"
const SESSION_DAYS = 90

export type User = {
  id: number
  username: string
  is_admin: number
  person_id: number | null
  created_at: string
}

// ---------- passwords (scrypt, no native deps) ----------
export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(pw, salt, 64)
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, s, h] = stored.split("$")
  if (alg !== "scrypt" || !s || !h) return false
  const expected = Buffer.from(h, "base64")
  const actual = crypto.scryptSync(pw, Buffer.from(s, "base64"), expected.length)
  return crypto.timingSafeEqual(expected, actual)
}

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex")

// ---------- users ----------
export function userCount(): number {
  return get<{ n: number }>("SELECT COUNT(*) n FROM users")!.n
}

const SELF_SIGNUP_KEY = "self_signup"

/**
 * Whether anyone may create their own account. An admin setting (stored in `meta`) wins;
 * until one is saved, ALLOW_SIGNUP=true keeps working as the default. Off otherwise.
 */
export function selfSignupEnabled(): boolean {
  const row = get<{ value: string }>("SELECT value FROM meta WHERE key = ?", SELF_SIGNUP_KEY)
  return row ? row.value === "1" : process.env.ALLOW_SIGNUP === "true"
}

export function setSelfSignupEnabled(on: boolean) {
  run(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    SELF_SIGNUP_KEY,
    on ? "1" : "0"
  )
}

/** Sign-up is open for the first-run admin account, or while the admin setting is on. */
export function signupOpen(): boolean {
  return userCount() === 0 || selfSignupEnabled()
}

/**
 * Create a user. Also creates (or links) a person with the given display name,
 * since every account hikes as a person. First user is admin.
 */
export function createUser(
  username: string,
  password: string,
  displayName?: string,
  isAdmin?: boolean,
  opts: { linkExistingPerson?: boolean } = {}
): User {
  const link = opts.linkExistingPerson ?? true
  return tx((d) => {
    const first = (d.prepare("SELECT COUNT(*) n FROM users").get() as { n: number }).n === 0
    const name = (displayName || username).trim()
    let person = (link ? d.prepare("SELECT id FROM people WHERE name = ? COLLATE NOCASE").get(name) : undefined) as
      | { id: number }
      | undefined
    if (person && link) {
      const taken = d.prepare("SELECT 1 FROM users WHERE person_id = ?").get(person.id)
      if (taken) person = undefined
    }
    const personId =
      person?.id ??
      Number(d.prepare("INSERT INTO people (name) VALUES (?)").run(uniqueName(d, name)).lastInsertRowid)
    const id = Number(
      d
        .prepare("INSERT INTO users (username, password_hash, is_admin, person_id) VALUES (?, ?, ?, ?)")
        .run(username.trim(), hashPassword(password), first || isAdmin ? 1 : 0, personId).lastInsertRowid
    )
    d.prepare("UPDATE people SET created_by = COALESCE(created_by, ?) WHERE id = ?").run(id, personId)
    return d.prepare("SELECT id, username, is_admin, person_id, created_at FROM users WHERE id = ?").get(id) as User
  })
}

function uniqueName(d: import("node:sqlite").DatabaseSync, name: string) {
  let n = name
  let i = 2
  while (d.prepare("SELECT 1 FROM people WHERE name = ? COLLATE NOCASE").get(n)) n = `${name} ${i++}`
  return n
}

export function findUserByLogin(username: string, password: string): User | null {
  const row = get<User & { password_hash: string }>(
    "SELECT id, username, is_admin, person_id, created_at, password_hash FROM users WHERE username = ?",
    username.trim()
  )
  if (!row || !verifyPassword(password, row.password_hash)) return null
  const { password_hash: _ph, ...user } = row
  void _ph
  return user
}

export function listUsers(): User[] {
  return all<User>("SELECT id, username, is_admin, person_id, created_at FROM users ORDER BY id")
}

export function setPassword(userId: number, password: string) {
  run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(password), userId)
  run("DELETE FROM sessions WHERE user_id = ?", userId)
}

// ---------- sessions ----------
export function createSession(userId: number): { token: string; expires: Date } {
  const token = crypto.randomBytes(32).toString("base64url")
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000)
  run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", sha256(token), userId, expires.toISOString())
  run("DELETE FROM sessions WHERE expires_at < ?", new Date().toISOString())
  return { token, expires }
}

export function deleteSession(token: string) {
  run("DELETE FROM sessions WHERE id = ?", sha256(token))
}

function userForSession(token: string): User | null {
  return (
    get<User>(
      `SELECT u.id, u.username, u.is_admin, u.person_id, u.created_at FROM sessions s
       JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?`,
      sha256(token),
      new Date().toISOString()
    ) ?? null
  )
}

/** Cookie options. Secure is on when the public URL (or the forwarded proto) is https. */
export async function sessionCookieOptions(expires: Date) {
  const h = await headers()
  const proto = h.get("x-forwarded-proto") || (process.env.APP_URL?.startsWith("https") ? "https" : "http")
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: proto === "https",
    path: "/",
    expires,
  }
}

// ---------- API tokens ----------
export function createApiToken(userId: number, name: string): { token: string; id: number; prefix: string } {
  const token = `hk_${crypto.randomBytes(24).toString("base64url")}`
  const prefix = token.slice(0, 10)
  const id = Number(
    run("INSERT INTO api_tokens (user_id, name, token_hash, prefix) VALUES (?, ?, ?, ?)", userId, name, sha256(token), prefix)
      .lastInsertRowid
  )
  return { token, id, prefix }
}

export function listApiTokens(userId: number) {
  return all<{ id: number; name: string; prefix: string; created_at: string; last_used_at: string | null }>(
    "SELECT id, name, prefix, created_at, last_used_at FROM api_tokens WHERE user_id = ? ORDER BY id DESC",
    userId
  )
}

export function deleteApiToken(userId: number, id: number) {
  run("DELETE FROM api_tokens WHERE id = ? AND user_id = ?", id, userId)
}

function userForApiToken(token: string): User | null {
  const row = get<User & { token_id: number }>(
    `SELECT u.id, u.username, u.is_admin, u.person_id, u.created_at, t.id token_id FROM api_tokens t
     JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?`,
    sha256(token)
  )
  if (!row) return null
  run("UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?", row.token_id)
  const { token_id: _t, ...user } = row
  void _t
  return user
}

// ---------- request auth ----------
/** Current user from session cookie (server components, route handlers). */
export async function currentUser(): Promise<User | null> {
  const c = await cookies()
  const token = c.get(SESSION_COOKIE)?.value
  return token ? userForSession(token) : null
}

export type AuthResult = { user: User; via: "token" | "session" }

/**
 * Authenticate an API request: `Authorization: Bearer hk_...` or the session cookie.
 * Cookie-authenticated unsafe requests must pass a same-origin check (CSRF).
 */
export async function authenticate(req: Request): Promise<AuthResult | null> {
  const auth = req.headers.get("authorization")
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const user = userForApiToken(auth.slice(7).trim())
    return user ? { user, via: "token" } : null
  }
  const user = await currentUser()
  if (!user) return null
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !sameOrigin(req)) return null
  return { user, via: "session" }
}

/**
 * CSRF check that works behind reverse proxies and custom domains: the Origin
 * host must equal the request's public host (x-forwarded-host / host) or a
 * host listed in APP_URL / ALLOWED_ORIGINS.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin")
  if (!origin) return true // same-origin fetches from older browsers / non-browser clients with cookies
  let originHost: string
  try {
    originHost = new URL(origin).host.toLowerCase()
  } catch {
    return false
  }
  const allowed = new Set<string>()
  const fwd = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  if (fwd) allowed.add(fwd.toLowerCase())
  const host = req.headers.get("host")
  if (host) allowed.add(host.toLowerCase())
  for (const v of [process.env.APP_URL, ...(process.env.ALLOWED_ORIGINS || "").split(",")]) {
    if (!v?.trim()) continue
    try {
      allowed.add(new URL(v.includes("://") ? v.trim() : `https://${v.trim()}`).host.toLowerCase())
    } catch {}
  }
  return allowed.has(originHost)
}
