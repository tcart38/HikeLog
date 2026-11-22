// Optional Garmin auto-sync. Enabled only when GARMIN_SYNC_INTERVAL_MIN is set. Suggestions only; never auto-imports.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const minutes = Number(process.env.GARMIN_SYNC_INTERVAL_MIN)
  if (!(minutes > 0)) return
  const g = globalThis as unknown as { __garminTimer?: ReturnType<typeof setInterval> }
  if (g.__garminTimer) return
  const { syncAllUsers } = await import("./lib/garmin/sync")
  const tick = () => void syncAllUsers().catch((e) => console.error("[garmin] auto-sync failed:", e))
  g.__garminTimer = setInterval(tick, Math.max(1, minutes) * 60_000)
  g.__garminTimer.unref?.()
  setTimeout(tick, 30_000).unref?.()
  console.log(`[garmin] auto-sync every ${minutes} min`)
}
