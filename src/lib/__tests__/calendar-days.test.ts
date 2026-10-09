import { describe, expect, it } from "vitest"
import { format, parseISO } from "date-fns"
import { continuousCalendarDays } from "@/lib/calendar-days"

describe("continuousCalendarDays", () => {
  it("continues across months without duplicating or skipping a day", () => {
    const days = continuousCalendarDays(parseISO("2026-10-25"), 14)
    expect(days.map(d => format(d, "dd/MM"))).toEqual([
      "25/10", "26/10", "27/10", "28/10", "29/10", "30/10", "31/10",
      "01/11", "02/11", "03/11", "04/11", "05/11", "06/11", "07/11",
    ])
  })
})
