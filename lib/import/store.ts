import "server-only"
import { get, run } from "../db"
import { decrypt, encrypt } from "../garmin/crypto"

export type Provider = "garmin_connect" | "strava"

export type ConnRow = {
  user_id: number
  provider: Provider
  status: "connected" | "pending"
  secret_enc: string
  meta_json: string
  last_sync_at: string | null
  last_error: string | null
  created_at: string
}

export function getConn(userId: number, provider: Provider): ConnRow | undefined {
  return get<ConnRow>("SELECT * FROM import_connections WHERE user_id = ? AND provider = ?", userId, provider)
}

export function readSecret<T>(c: ConnRow): T {
  return JSON.parse(decrypt(c.secret_enc)) as T
}

export function saveConn(userId: number, provider: Provider, status: "connected" | "pending", secret: unknown, meta: Record<string, unknown> = {}) {
  run(
    `INSERT INTO import_connections (user_id, provider, status, secret_enc, meta_json) VALUES (?,?,?,?,?)
     ON CONFLICT(user_id, provider) DO UPDATE SET status = excluded.status, secret_enc = excluded.secret_enc,
       meta_json = excluded.meta_json, last_error = NULL`,
    userId, provider, status, encrypt(JSON.stringify(secret)), JSON.stringify(meta)
  )
}

export function updateSecret(userId: number, provider: Provider, secret: unknown) {
  run("UPDATE import_connections SET secret_enc = ? WHERE user_id = ? AND provider = ?", encrypt(JSON.stringify(secret)), userId, provider)
}

export function deleteConn(userId: number, provider: Provider) {
  run("DELETE FROM import_connections WHERE user_id = ? AND provider = ?", userId, provider)
}

export function markSynced(userId: number, provider: Provider) {
  run("UPDATE import_connections SET last_sync_at = ?, last_error = NULL WHERE user_id = ? AND provider = ?", new Date().toISOString(), userId, provider)
}

export function markError(userId: number, provider: Provider, message: string) {
  run("UPDATE import_connections SET last_error = ? WHERE user_id = ? AND provider = ?", message, userId, provider)
}

export function connStatus(userId: number, provider: Provider) {
  const c = getConn(userId, provider)
  if (!c) return { state: "none" as const }
  let meta: Record<string, unknown> = {}
  try {
    meta = JSON.parse(c.meta_json)
  } catch {}
  return {
    state: c.status,
    meta,
    lastSyncAt: c.last_sync_at,
    lastError: c.last_error,
    connectedAt: c.created_at,
  }
}

export class ImportError extends Error {
  constructor(message: string, public status = 502) {
    super(message)
  }
}
