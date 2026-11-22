import "server-only"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { dataDir } from "../db"

let secretCache: string | null = null

/** APP_SECRET, or a random secret generated once and persisted in $DATA_DIR/secret.key (0600). */
function appSecret(): string {
  if (secretCache) return secretCache
  const env = process.env.APP_SECRET?.trim()
  if (env) return (secretCache = env)
  const dir = dataDir()
  const file = path.join(dir, "secret.key")
  try {
    secretCache = fs.readFileSync(file, "utf8").trim()
    if (secretCache) return secretCache
  } catch {}
  fs.mkdirSync(dir, { recursive: true })
  const fresh = crypto.randomBytes(32).toString("hex")
  try {
    fs.writeFileSync(file, fresh, { mode: 0o600, flag: "wx" })
    secretCache = fresh
  } catch {
    // lost a race with another process: use what it wrote
    secretCache = fs.readFileSync(file, "utf8").trim()
  }
  return secretCache
}

function key(): Buffer {
  return crypto.createHash("sha256").update(`hikelog:garmin:v1:${appSecret()}`).digest()
}

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv)
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()])
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".")
}

export function decrypt(blob: string): string {
  const [v, iv, tag, ct] = blob.split(".")
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognized encrypted value")
  const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"))
  d.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8")
}
