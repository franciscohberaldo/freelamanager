import { cn } from "@/lib/utils"

interface Props {
  /** The section the page belongs to: Operação, Financeiro, Planejamento… */
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  /** Primary actions, right-aligned; wrap under the title on narrow screens. */
  actions?: React.ReactNode
  className?: string
}

/**
 * The head of every page: where you are (eyebrow), what this is (title), what it is for
 * (description), and what you can do here (actions). Server-safe — no hooks.
 */
export function PageHeader({ eyebrow, title, description, actions, className }: Props) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4 mb-6", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1.5">{eyebrow}</p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight leading-tight">{title}</h1>
        {description && <div className="text-muted-foreground mt-1.5 text-[15px]">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
