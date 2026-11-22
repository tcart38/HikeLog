import Link from "next/link"
import { FileSpreadsheetIcon, MapPinnedIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function EmptyHikes() {
  return (
    <Empty className="border py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MapPinnedIcon />
        </EmptyMedia>
        <EmptyTitle>No hikes logged yet</EmptyTitle>
        <EmptyDescription>
          Every list updates from your hikes. Log the one you just finished, or bring in your old spreadsheet and see all your progress at once.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center">
        <Button size="lg" className="h-10" nativeButton={false} render={<Link href="/hikes/new" />}>
          <PlusIcon /> Log a hike
        </Button>
        <Button size="lg" variant="outline" className="h-10" nativeButton={false} render={<Link href="/settings/data" />}>
          <FileSpreadsheetIcon /> Import your spreadsheet
        </Button>
      </EmptyContent>
    </Empty>
  )
}
