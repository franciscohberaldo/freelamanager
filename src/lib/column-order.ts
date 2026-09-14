/** Moves one item to another position, leaving the input untouched. */
export function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to) return [...list]
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list]
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * A saved order reconciled with the columns that exist today: unknown keys are dropped and
 * columns added since are appended, so an old saved order never breaks a newer table.
 */
export function mergeColumnOrder(saved: string[] | null, defaults: string[]): string[] {
  if (!Array.isArray(saved) || saved.length === 0) return defaults
  if (!saved.every(k => typeof k === "string")) return defaults
  const known = saved.filter((k, i) => defaults.includes(k) && saved.indexOf(k) === i)
  if (known.length === 0) return defaults
  return [...known, ...defaults.filter(k => !known.includes(k))]
}
