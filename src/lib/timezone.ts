/**
 * Helpers to show a job's working hours (defined in the client's timezone)
 * in the freelancer's local timezone. Uses Intl only, no extra dependency.
 */

export const LOCAL_TZ = "America/Sao_Paulo"

export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/Sao_Paulo",    label: "Brasília (America/Sao_Paulo)" },
  { value: "America/Los_Angeles",  label: "Los Angeles · PST/PDT" },
  { value: "America/Denver",       label: "Denver · MST/MDT" },
  { value: "America/Chicago",      label: "Chicago · CST/CDT" },
  { value: "America/New_York",     label: "New York · EST/EDT" },
  { value: "America/Toronto",      label: "Toronto · EST/EDT" },
  { value: "America/Mexico_City",  label: "Mexico City" },
  { value: "America/Buenos_Aires", label: "Buenos Aires" },
  { value: "Europe/London",        label: "London · GMT/BST" },
  { value: "Europe/Lisbon",        label: "Lisbon" },
  { value: "Europe/Paris",         label: "Paris · CET/CEST" },
  { value: "Europe/Berlin",        label: "Berlin · CET/CEST" },
  { value: "Europe/Madrid",        label: "Madrid · CET/CEST" },
  { value: "Asia/Dubai",           label: "Dubai" },
  { value: "Asia/Singapore",       label: "Singapore" },
  { value: "Asia/Tokyo",           label: "Tokyo" },
  { value: "Australia/Sydney",     label: "Sydney" },
]

/** Parses "09:00-18:00" (also accepts "9:00–18:00", "9-18") into minutes since midnight */
export function parseWorkHours(s: string | null | undefined): { start: number; end: number } | null {
  if (!s) return null
  const m = s.replace(/\s/g, "").match(/^(\d{1,2})(?::(\d{2}))?[-–](\d{1,2})(?::(\d{2}))?$/)
  if (!m) return null
  const start = Number(m[1]) * 60 + Number(m[2] ?? 0)
  const end   = Number(m[3]) * 60 + Number(m[4] ?? 0)
  if (start > 24 * 60 || end > 24 * 60) return null
  return { start, end }
}

/** Offset of `tz` from UTC in minutes at the given instant (positive = east of UTC) */
export function tzOffsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return Math.round((asUTC - at.getTime()) / 60000)
}

/** Short zone name, e.g. "PDT", "EST", "BRT" */
export function tzAbbrev(tz: string, at: Date): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(at).find((p) => p.type === "timeZoneName")
    const v = part?.value ?? tz
    // Intl falls back to "GMT-3" for zones without a common English abbreviation
    if (/^GMT[+-]/.test(v) && tz === "America/Sao_Paulo") return "BRT"
    return v
  } catch {
    return tz
  }
}

function fmtMinutes(total: number): string {
  const t = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
}

export interface LocalHours {
  remoteLabel: string   // "09:00–18:00 PDT"
  localLabel: string    // "13:00–22:00 BRT"
  diffHours: number     // local minus remote, e.g. +4
  nextDay: boolean      // local end crosses midnight
}

/** Converts a job's work hours from its timezone to the local timezone for a given date */
export function workHoursInLocal(
  workHours: string | null | undefined,
  tz: string | null | undefined,
  at: Date = new Date(),
  localTz: string = LOCAL_TZ,
): LocalHours | null {
  const range = parseWorkHours(workHours)
  if (!range || !tz) return null
  let diff: number
  try {
    diff = tzOffsetMinutes(localTz, at) - tzOffsetMinutes(tz, at)
  } catch {
    return null
  }
  const ls = range.start + diff
  const le = range.end + diff
  return {
    remoteLabel: `${fmtMinutes(range.start)}–${fmtMinutes(range.end)} ${tzAbbrev(tz, at)}`,
    localLabel:  `${fmtMinutes(ls)}–${fmtMinutes(le)} ${tzAbbrev(localTz, at)}`,
    diffHours:   Math.round((diff / 60) * 10) / 10,
    nextDay:     le >= 1440,
  }
}
