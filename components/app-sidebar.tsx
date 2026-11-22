"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"
import { ChevronRightIcon, PlusIcon } from "lucide-react"

import { Logo } from "@/components/logo"
import { NAV_MAIN, NAV_MANAGE, SETTINGS_NAV, isActive, isSettingsActive, type NavListItem } from "@/components/nav-items"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/user-menu"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"

type Child = { href: string; label: string; active: boolean; icon?: React.ElementType }

/** A nav item that drops down its sub-pages. Open while you are inside it, and toggleable. */
function NavGroupItem({ href, label, icon: Icon, active, items }: { href: string; label: string; icon: React.ElementType; active: boolean; items: Child[] }) {
  const [open, setOpen] = React.useState(active)
  // Open when you navigate into the section (keeps your manual toggle otherwise).
  const [wasActive, setWasActive] = React.useState(active)
  if (wasActive !== active) {
    setWasActive(active)
    if (active) setOpen(true)
  }
  return (
    <SidebarMenuItem>
      <SidebarMenuButton render={<Link href={href} />} isActive={active && !items.some((i) => i.active)} tooltip={label}>
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
      {items.length > 0 && (
        <SidebarMenuAction onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${label}`}>
          <ChevronRightIcon className={open ? "rotate-90 transition-transform" : "transition-transform"} />
        </SidebarMenuAction>
      )}
      {open && items.length > 0 && (
        <SidebarMenuSub>
          {items.map((c) => (
            <SidebarMenuSubItem key={c.href}>
              <SidebarMenuSubButton render={<Link href={c.href} />} isActive={c.active}>
                {c.icon && <c.icon />}
                <span>{c.label}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  )
}

export function AppSidebar({ name, username, lists }: { name: string; username: string; lists: NavListItem[] }) {
  const pathname = usePathname()
  return (
    <Sidebar collapsible="icon" className="hidden md:flex">
      <SidebarHeader className="gap-3 p-3">
        <Link href="/" aria-label="HikeLog home" className="flex h-8 items-center px-1">
          <Logo />
        </Link>
        <Button nativeButton={false} render={<Link href="/hikes/new" />} className="w-full justify-start group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center">
          <PlusIcon />
          <span className="group-data-[collapsible=icon]:hidden">Log a hike</span>
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Track</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_MAIN.map((item) =>
                item.href === "/lists" ? (
                  <NavGroupItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={isActive(pathname, item.href)}
                    items={lists.map((l) => ({ href: `/lists/${l.slug}`, label: l.label, active: pathname === `/lists/${l.slug}` }))}
                  />
                ) : (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton render={<Link href={item.href} />} isActive={isActive(pathname, item.href)} tooltip={item.label}>
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_MANAGE.map((item) =>
                item.href === "/settings" ? (
                  <NavGroupItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={isActive(pathname, item.href)}
                    items={SETTINGS_NAV.map((c) => ({ href: c.href, label: c.label, icon: c.icon, active: isSettingsActive(pathname, c.href) }))}
                  />
                ) : (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton render={<Link href={item.href} />} isActive={isActive(pathname, item.href)} tooltip={item.label}>
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="flex-row items-center justify-between gap-2 p-3 group-data-[collapsible=icon]:flex-col">
        <UserMenu name={name} username={username} />
        <ThemeToggle />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
