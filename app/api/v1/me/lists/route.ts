import { z } from "zod"

import { ApiError, json, readJson, withAuth } from "@/lib/api"
import { VIEW_VALUES, UserPrefs, listVisibility, setPref } from "@/lib/prefs"
import { listLists } from "@/lib/progress"

/** Lists as this user sees them: whether each is shown, whether they've started it, and which views are on. */
export const GET = withAuth(async (_req, { user }) => {
  const prefs = new UserPrefs(user.id)
  const vis = listVisibility(prefs, user.person_id)
  return json({
    defaultViews: prefs.defaultViews(),
    lists: listLists().map((l) => ({
      slug: l.slug,
      name: l.name,
      shortName: l.short_name,
      region: l.region,
      peakCount: l.peak_count,
      started: vis.started.has(l.slug),
      state: prefs.listState(l.slug),
      visible: vis.visible(l.slug),
      views: prefs.views(l.slug),
      customViews: prefs.hasOverride(l.slug),
    })),
  })
})

const viewsSchema = z.array(z.enum(VIEW_VALUES as [string, ...string[]])).min(1, "Keep at least one view on")

const bodySchema = z.object({
  /** List slug to change. Omit to change the default views. */
  list: z.string().optional(),
  /** "show" pins a list you haven't started, "hide" hides one you have, "auto" shows it once you've started it. */
  state: z.enum(["auto", "show", "hide"]).optional(),
  /** Enabled views for this list (or the default when `list` is omitted). null removes the list's override. */
  views: viewsSchema.nullable().optional(),
})

export const PATCH = withAuth(async (req, { user }) => {
  const body = bodySchema.parse(await readJson(req))
  if (body.list && !listLists().some((l) => l.slug === body.list)) throw new ApiError(`List not found: ${body.list}`, 404)
  if (!body.list) {
    if (body.state !== undefined) throw new ApiError("`state` needs a `list`", 400)
    if (body.views) setPref(user.id, "views:default", JSON.stringify(body.views))
    else if (body.views === null) throw new ApiError("The default views can't be removed, only changed", 400)
  } else {
    if (body.state !== undefined) setPref(user.id, `list:${body.list}`, body.state === "auto" ? null : body.state)
    if (body.views !== undefined) setPref(user.id, `views:${body.list}`, body.views === null ? null : JSON.stringify(body.views))
  }
  return json({ ok: true })
})
