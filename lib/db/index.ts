import "server-only"
import { DatabaseSync } from "node:sqlite"
import fs from "node:fs"
import path from "node:path"
import { migrations } from "./migrations"
import { seedLists } from "./seed"

export type DB = DatabaseSync

const globalForDb = globalThis as unknown as { __hikelogDb?: DatabaseSync }

export function dataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data", "db")
}

function open(): DatabaseSync {
  const dir = dataDir()
  fs.mkdirSync(dir, { recursive: true })
  const db = new DatabaseSync(path.join(dir, "hikelog.db"))
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
  migrate(db)
  seedLists(db)
  return db
}

function migrate(db: DatabaseSync) {
  const version = Number(
    (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version
  )
  for (let i = version; i < migrations.length; i++) {
    db.exec("BEGIN")
    try {
      db.exec(migrations[i])
      db.exec(`PRAGMA user_version = ${i + 1}`)
      db.exec("COMMIT")
    } catch (e) {
      db.exec("ROLLBACK")
      throw e
    }
  }
}

/** Process-wide SQLite handle. Server-only. */
export function db(): DatabaseSync {
  if (!globalForDb.__hikelogDb) globalForDb.__hikelogDb = open()
  return globalForDb.__hikelogDb
}

/** Run fn inside a transaction (synchronous). */
export function tx<T>(fn: (d: DatabaseSync) => T): T {
  const d = db()
  d.exec("BEGIN IMMEDIATE")
  try {
    const out = fn(d)
    d.exec("COMMIT")
    return out
  } catch (e) {
    d.exec("ROLLBACK")
    throw e
  }
}

// node:sqlite returns null-prototype objects; this keeps typing light.
export function all<T>(sql: string, ...params: unknown[]): T[] {
  return db().prepare(sql).all(...(params as never[])) as T[]
}
export function get<T>(sql: string, ...params: unknown[]): T | undefined {
  return db().prepare(sql).get(...(params as never[])) as T | undefined
}
export function run(sql: string, ...params: unknown[]) {
  return db().prepare(sql).run(...(params as never[]))
}
