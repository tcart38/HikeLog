/** A titled block on a settings page. */
export function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex flex-col gap-4 border-t pt-6 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-h`} className="text-base font-medium">
          {title}
        </h2>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}
