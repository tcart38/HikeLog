"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export type SheetState = "peek" | "half" | "full"
const ORDER: SheetState[] = ["peek", "half", "full"]

/**
 * Persistent (non-modal) bottom sheet for phones. Three stops: a peek strip, half, and nearly full.
 * Drag the handle or tap it to cycle. The map stays interactive above it.
 */
export function BottomSheet({
  state,
  onStateChange,
  peek,
  children,
  className,
}: {
  state: SheetState
  onStateChange: (s: SheetState) => void
  /** Always-visible strip below the handle */
  peek: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const drag = React.useRef<{ startY: number; startH: number; moved: boolean } | null>(null)
  const [dragH, setDragH] = React.useState<number | null>(null)

  const [parentH, setParentH] = React.useState(700)
  React.useEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent) return
    const ro = new ResizeObserver(() => setParentH(parent.clientHeight))
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])
  const heights = () => ({ peek: 132, half: Math.round(parentH * 0.5), full: Math.round(parentH * 0.88) })

  const onDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { startY: e.clientY, startH: ref.current?.offsetHeight ?? 0, moved: false }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dy = d.startY - e.clientY
    if (Math.abs(dy) > 4) d.moved = true
    const h = heights()
    setDragH(Math.max(h.peek, Math.min(h.full, d.startH + dy)))
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moved) {
      setDragH(null)
      onStateChange(ORDER[(ORDER.indexOf(state) + 1) % ORDER.length])
      return
    }
    const h = heights()
    const cur = dragH ?? d.startH
    const nearest = ORDER.reduce((best, s) => (Math.abs(h[s] - cur) < Math.abs(h[best] - cur) ? s : best), "peek" as SheetState)
    setDragH(null)
    onStateChange(nearest)
  }

  const height = dragH ?? heights()[state]
  return (
    <div
      ref={ref}
      style={{ height }}
      className={cn(
        "absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-2xl border-t bg-background shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.35)]",
        dragH == null && "transition-[height] duration-200 ease-out",
        className
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={state === "full" ? "Collapse panel" : "Expand panel"}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onStateChange(ORDER[(ORDER.indexOf(state) + 1) % ORDER.length])
        }}
        className="flex min-h-9 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      >
        <span className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
      </div>
      <div className="shrink-0 px-4 pb-2">{peek}</div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t px-4 py-4">{children}</div>
    </div>
  )
}
