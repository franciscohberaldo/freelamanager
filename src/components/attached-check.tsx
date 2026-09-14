import { Check } from "lucide-react"

/**
 * Whether a document is on file, in the history and accounting tables.
 *
 * A bare tick got lost among the em-dashes at a glance, which is the one thing these
 * columns exist to do — so the tick sits in a filled badge and the absence stays quiet.
 */
export function AttachedCheck({ count = 1 }: { count?: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white shrink-0"
        aria-label="anexado"
      >
        <Check className="w-3 h-3" strokeWidth={3} />
      </span>
      {count > 1 && <span className="text-xs text-emerald-700 dark:text-emerald-400">{count}</span>}
    </span>
  )
}

export function NotAttached() {
  return <span className="text-muted-foreground/40" aria-label="não anexado">—</span>
}
