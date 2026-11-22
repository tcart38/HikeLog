import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** Card shell shared by every stats panel. */
export function ChartCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription className="mt-1 text-pretty">{description}</CardDescription>}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  )
}

/** Circular progress. Pure SVG, no animation, readable value in the middle. */
export function Ring({
  value,
  size = 48,
  stroke = 5,
  label,
  className,
  color = "var(--done)",
}: {
  value: number // 0..1
  size?: number
  stroke?: number
  label?: React.ReactNode
  className?: string
  color?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} role="img" aria-label={`${Math.round(v * 100)} percent`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tnum">{label ?? `${Math.round(v * 100)}%`}</span>
    </div>
  )
}

/** Quiet "nothing here yet" line inside a chart card. */
export function Sparse({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground text-pretty">{children}</p>
}

export const nf = (n: number) => n.toLocaleString("en-US")

/** Heatmap cell colour: 0 = quiet, then three steps of the "done" green. */
export function heatBg(count: number): string {
  if (count <= 0) return "var(--muted)"
  if (count === 1) return "color-mix(in oklab, var(--done) 32%, var(--card))"
  if (count === 2) return "color-mix(in oklab, var(--done) 58%, var(--card))"
  return "var(--done)"
}
