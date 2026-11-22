import { MountainIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <MountainIcon className="size-4" />
      </span>
      {showName && <span className="text-base">HikeLog</span>}
    </span>
  )
}
