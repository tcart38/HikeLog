import { CheckIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SEASON_LABEL, type Season } from "@/lib/seasons"
import { SEASON_STYLE } from "@/lib/format"
import { cn } from "@/lib/utils"

export function SeasonBadge({ season, className }: { season: Season; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", SEASON_STYLE[season].chip, className)}>
      {SEASON_LABEL[season]}
    </Badge>
  )
}

export function DoneBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent bg-done/15 text-done", className)}>
      <CheckIcon /> Done
    </Badge>
  )
}

export function NeededBadge({ className, children = "Needed" }: { className?: string; children?: React.ReactNode }) {
  return (
    <Badge variant="outline" className={cn("border-transparent bg-remaining text-remaining-foreground", className)}>
      {children}
    </Badge>
  )
}
