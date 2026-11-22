"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PlusIcon } from "lucide-react"

import { NAV_MAIN, isActive } from "@/components/nav-items"
import { cn } from "@/lib/utils"

/** Bottom tab bar for phones: four destinations and a prominent "log a hike" action in the middle. */
export function MobileNav() {
  const pathname = usePathname()
  const [home, hikes, lists, compare] = NAV_MAIN
  const tab = (item: (typeof NAV_MAIN)[number]) => {
    const active = isActive(pathname, item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground"
        )}
      >
        <item.icon className="size-5" strokeWidth={active ? 2.4 : 2} />
        {item.short}
      </Link>
    )
  }
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t bg-background/95 pb-safe backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
    >
      {tab(home)}
      {tab(hikes)}
      <div className="flex flex-1 items-center justify-center">
        <Link
          href="/hikes/new"
          aria-label="Log a hike"
          className="flex size-12 -translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-background transition-transform active:scale-95"
        >
          <PlusIcon className="size-6" />
        </Link>
      </div>
      {tab(lists)}
      {tab(compare)}
    </nav>
  )
}
