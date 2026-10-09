import { addDays } from "date-fns"

/** A continuous range; the caller keeps full weeks aligned in the seven-column grid. */
export function continuousCalendarDays(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, index) => addDays(start, index))
}
