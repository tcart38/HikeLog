import "server-only"
import { all, run } from "./db"
import { VIEWS, type View } from "./format"
import { allListsProgress } from "./progress"

/** Views a list can be tracked in. "all" is always available as the fallback. */
export const VIEW_VALUES = VIEWS.map((v) => v.value)

export type ListState = "auto" | "show" | "hide"

/** One user's settings, loaded once per request. */
export class UserPrefs {
  private map: Map<string, string>
  constructor(public userId: number) {
    this.map = new Map(all<{ key: string; value: string }>("SELECT key, value FROM user_prefs WHERE user_id = ?", userId).map((r) => [r.key, r.value]))
  }

  listState(slug: string): ListState {
    const v = this.map.get(`list:${slug}`)
    return v === "show" || v === "hide" ? v : "auto"
  }

  private parseViews(raw: string | undefined): View[] | null {
    if (!raw) return null
    try {
      const v = (JSON.parse(raw) as string[]).filter((x): x is View => VIEW_VALUES.includes(x as View))
      return v.length ? v : null
    } catch {
      return null
    }
  }

  /** Whether this list has its own view override (otherwise it follows the default). */
  hasOverride(slug: string): boolean {
    return this.parseViews(this.map.get(`views:${slug}`)) !== null
  }
  defaultViews(): View[] {
    return this.parseViews(this.map.get("views:default")) ?? VIEW_VALUES
  }
  /** Enabled views for a list, in display order. */
  views(slug: string): View[] {
    const v = this.parseViews(this.map.get(`views:${slug}`)) ?? this.defaultViews()
    return VIEW_VALUES.filter((x) => v.includes(x))
  }
}

export function setPref(userId: number, key: string, value: string | null) {
  if (value === null) run("DELETE FROM user_prefs WHERE user_id = ? AND key = ?", userId, key)
  else
    run(
      "INSERT INTO user_prefs (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value",
      userId,
      key,
      value
    )
}

/**
 * Lists a person has started (any ascent), plus lists they pinned, minus lists they hid.
 * `started` is by the person's progress; `visible` is what the nav and dashboard show.
 */
export function listVisibility(prefs: UserPrefs, personId: number | null) {
  const started = new Set<string>()
  if (personId) for (const r of allListsProgress(personId, "all")) if (r.credits > 0) started.add(r.list.slug)
  const visible = (slug: string) => {
    const s = prefs.listState(slug)
    return s === "show" ? true : s === "hide" ? false : started.has(slug)
  }
  return { started, visible }
}
