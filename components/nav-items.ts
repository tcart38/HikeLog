import { BarChart3Icon, GitCompareArrowsIcon, HomeIcon, ListChecksIcon, MapIcon, MapPinnedIcon, SettingsIcon, UsersIcon } from "lucide-react"

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
