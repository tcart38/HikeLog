import type { Metadata } from "next"

import { ListSettings, type ListSettingsRow } from "@/components/settings/list-settings"
import { PageHeader } from "@/components/page-header"
import { UserPrefs, listVisibility } from "@/lib/prefs"
import { allListsProgress, listLists } from "@/lib/progress"
import { requireUser } from "@/lib/queries"

export const metadata: Metadata = { title: "List settings" }

export default async function SettingsListsPage() {
  const user = await requireUser()
  const prefs = new UserPrefs(user.id)
  const vis = listVisibility(prefs, user.person_id)
  const prog = new Map((user.person_id ? allListsProgress(user.person_id, "all") : []).map((r) => [r.list.slug, r]))
  const rows: ListSettingsRow[] = listLists().map((l) => ({
    slug: l.slug,
    name: l.name,
    region: l.region ?? "Other",
    started: vis.started.has(l.slug),
    visible: vis.visible(l.slug),
    done: prog.get(l.slug)?.completed ?? 0,
    total: prog.get(l.slug)?.total ?? l.peak_count,
    views: prefs.views(l.slug),
    customViews: prefs.hasOverride(l.slug),
  }))
  return (
    <>
      <PageHeader
        title="Lists"
        description="Choose which lists show up in your navigation and dashboard, and which views each one offers. Lists you haven't started stay out of the way until you turn them on."
      />
      <ListSettings rows={rows} defaultViews={prefs.defaultViews()} />
    </>
  )
}
