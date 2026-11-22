import { AppSidebar } from "@/components/app-sidebar"
import { Logo } from "@/components/logo"
import { MobileNav } from "@/components/mobile-nav"
import { ThemeToggle } from "@/components/theme-toggle"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { UserMenu } from "@/components/user-menu"
import { get } from "@/lib/db"
import { requireUser } from "@/lib/queries"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const person = user.person_id ? get<{ name: string }>("SELECT name FROM people WHERE id = ?", user.person_id) : undefined
  const name = person?.name ?? user.username
  const open = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={open}>
      <AppSidebar name={name} username={user.username} />
      <SidebarInset className="min-w-0">
        {/* Desktop: sidebar trigger. Phone: logo + theme + account (navigation lives in the bottom bar). */}
        <header className="sticky top-0 z-30 flex h-[calc(3rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b bg-background/95 px-3 pt-safe backdrop-blur supports-backdrop-filter:bg-background/80 md:px-4">
          <SidebarTrigger className="hidden md:inline-flex" />
          <Logo className="md:hidden" />
          <div className="ml-auto flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <UserMenu name={name} username={user.username} />
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:py-6 md:pb-10">
          {children}
        </div>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  )
}
