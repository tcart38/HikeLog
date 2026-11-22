"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { SETTINGS_NAV, isSettingsActive } from "@/components/nav-items"
import { cn } from "@/lib/utils"

/** Settings sub-page switcher for phones (on desktop they drop down in the sidebar). */
export function SettingsTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Settings" className="-mx-4 overflow-x-auto px-4 scroll-quiet md:hidden">
      <ul className="flex w-max gap-2">
        {SETTINGS_NAV.map((i) => {
          const active = isSettingsActive(pathname, i.href)
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                  active ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground active:bg-muted"
                )}
              >
                <i.icon className="size-4" />
                {i.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
