"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { SourceId } from "@/lib/import/meta"

export type SourceTab = { id: SourceId; label: string; connected: boolean; unofficial?: boolean }

/** Source picker. Panels are rendered on the server and passed in by id. */
export function SourceTabs({ tabs, initial, panels }: { tabs: SourceTab[]; initial: SourceId; panels: Record<SourceId, React.ReactNode> }) {
  return (
    <Tabs defaultValue={initial} className="gap-4">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1 group-data-horizontal/tabs:h-auto">
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="h-11 flex-none gap-2 px-3 md:h-8">
            {t.label}
            {t.connected && <span aria-label="connected" className="size-1.5 rounded-full bg-primary" />}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id} className="flex flex-col gap-4">
          {t.unofficial && (
            <Badge variant="outline" className="w-fit">
              Unofficial
            </Badge>
          )}
          {panels[t.id]}
        </TabsContent>
      ))}
    </Tabs>
  )
}
