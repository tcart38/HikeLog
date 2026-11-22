import { SettingsTabs } from "@/components/settings/settings-tabs"
import { APP_VERSION } from "@/lib/version"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SettingsTabs />
      {children}
      <p className="mt-10 text-xs text-muted-foreground">HikeLog v{APP_VERSION} (pre-1.0, in development)</p>
    </>
  )
}
