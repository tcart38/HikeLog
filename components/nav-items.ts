import { BarChart3Icon, BookOpenIcon, DatabaseIcon, UserRoundIcon, WatchIcon, GitCompareArrowsIcon, HomeIcon, ListChecksIcon, MapIcon, MapPinnedIcon, SettingsIcon, UsersIcon } from "lucide-react"

export const NAV_MAIN = [
  { href: "/", label: "Dashboard", short: "Home", icon: HomeIcon },
  { href: "/hikes", label: "Hikes", short: "Hikes", icon: MapPinnedIcon },
  { href: "/lists", label: "Lists", short: "Lists", icon: ListChecksIcon },
  { href: "/map", label: "Map", short: "Map", icon: MapIcon },
  { href: "/stats", label: "Stats", short: "Stats", icon: BarChart3Icon },
  { href: "/compare", label: "Compare", short: "Compare", icon: GitCompareArrowsIcon },
] as const

export const NAV_MANAGE = [
  { href: "/people", label: "People", icon: UsersIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}

/** Settings pages; they drop down under Settings in the sidebar. */
export const SETTINGS_NAV = [
  { href: "/settings", label: "Account", icon: UserRoundIcon },
  { href: "/settings/lists", label: "Lists", icon: ListChecksIcon },
  { href: "/settings/people", label: "People", icon: UsersIcon },
  { href: "/settings/data", label: "Import & export", icon: DatabaseIcon },
  { href: "/settings/import", label: "Activity import", icon: WatchIcon },
  { href: "/settings/api", label: "API & tokens", icon: BookOpenIcon },
] as const

export type NavListItem = { slug: string; label: string }

/** Exact match for /settings (it is a prefix of its children); prefix match otherwise. */
export function isSettingsActive(pathname: string, href: string) {
  return href === "/settings" ? pathname === "/settings" : isActive(pathname, href)
}
