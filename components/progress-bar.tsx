import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

/** Thin labelled progress: "12 / 48" with tabular numerals. */
export function ProgressBar({
  done,
  total,
  className,
  label,
}: {
  done: number
  total: number
  className?: string
  label: string
}) {
  const value = total ? Math.round((done / total) * 100) : 0
  return (
    <Progress value={value} aria-label={label} className={cn("gap-1.5 [&_[data-slot=progress-track]]:h-1.5", className)} />
  )
}
