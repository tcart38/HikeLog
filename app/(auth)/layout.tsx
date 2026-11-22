import { Logo } from "@/components/logo"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-5 py-10 pt-safe pb-safe">
      <Logo className="text-xl" />
      <div className="w-full max-w-sm">{children}</div>
    </main>
  )
}
