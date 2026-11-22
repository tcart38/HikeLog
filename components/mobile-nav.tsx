"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpenIcon, EllipsisIcon, PlusIcon } from "lucide-react"

import { NAV_MAIN, NAV_MANAGE, isActive } from "@/components/nav-items"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const byHref = (href: string) => NAV_MAIN.find((i) => i.href === href)!
const TABS = [byHref("/"), byHref("/lists")] as const
const MAP = byHref("/map")
// Everything that does not fit in the tab bar.
const MORE = [byHref("/hikes"), byHref("/stats"), byHref("/compare"), ...NAV_MANAGE] as const

const tabClass = (active: boolean) =>
  cn("flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors", active ? "text-primary" : "text-muted-foreground")

/** Bottom tab bar for phones: Home, Lists, a prominent "Log" action, Map, and a More sheet. */
export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const moreActive = MORE.some((i) => isActive(pathname, i.href))

  const tab = (item: (typeof NAV_MAIN)[number]) => {
    const active = isActive(pathname, item.href)
    return (
      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
        <item.icon className="size-5" strokeWidth={active ? 2.4 : 2} />
        {item.short}
      </Link>
    )
  }

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t bg-background/95 pb-safe backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
      >
        {TABS.map(tab)}
        <div className="flex flex-1 items-center justify-center">
          <Link
            href="/hikes/new"
            aria-label="Log a hike"
            className="flex size-12 -translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-background transition-transform active:scale-95"
          >
            <PlusIcon className="size-6" />
          </Link>
        </div>
        {tab(MAP)}
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className={tabClass(moreActive || open)}>
          <EllipsisIcon className="size-5" strokeWidth={moreActive ? 2.4 : 2} />
          More
        </button>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe md:hidden">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
            <SheetDescription className="sr-only">Other sections of HikeLog</SheetDescription>
          </SheetHeader>
          <ul className="grid grid-cols-3 gap-2 px-4 pb-4">
            {MORE.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-colors active:bg-muted",
                      active ? "border-primary/40 bg-primary/10 text-primary" : "text-foreground"
                    )}
                  >
                    <item.icon className="size-5" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
            <li>
              {/* /docs is a route handler, not an App Router page: use a plain anchor. */}
              <a
                href="/docs"
                className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-xs font-medium text-foreground transition-colors active:bg-muted"
              >
                <BookOpenIcon className="size-5" />
                API docs
              </a>
            </li>
          </ul>
        </SheetContent>
      </Sheet>
    </>
  )
}
