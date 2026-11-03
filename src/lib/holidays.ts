/**
 * Brazilian holidays used to price daily logs. Fixed national dates plus the movable
 * ones that follow Easter (Carnival, Good Friday, Corpus Christi). State and municipal
 * holidays are not listed: a day with a different local rate can still be edited by hand.
 * All functions work on plain dates, with no timezone involved.
 */
import { addDays, format, parseISO } from "date-fns"

/** Easter Sunday of a year (Gregorian computus, Meeus/Jones/Butcher). */
export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 1-based
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/** Every holiday of a year, as yyyy-MM-dd strings. */
export function holidaysOfYear(year: number): string[] {
  const fmt = (d: Date) => format(d, "yyyy-MM-dd")
  const easter = easterSunday(year)
  return [
    `${year}-01-01`, // Confraternização Universal
    fmt(addDays(easter, -48)), // Carnaval (segunda)
    fmt(addDays(easter, -47)), // Carnaval (terça)
    fmt(addDays(easter, -2)),  // Sexta-feira Santa
    `${year}-04-21`, // Tiradentes
    `${year}-05-01`, // Dia do Trabalho
    fmt(addDays(easter, 60)),  // Corpus Christi
    `${year}-09-07`, // Independência
    `${year}-10-12`, // Nossa Senhora Aparecida
    `${year}-11-02`, // Finados
    `${year}-11-15`, // Proclamação da República
    `${year}-11-20`, // Consciência Negra (feriado nacional desde 2024)
    `${year}-12-25`, // Natal
  ]
}

/** Whether a yyyy-MM-dd date is a holiday. */
export function isHoliday(date: string): boolean {
  const year = parseISO(date).getFullYear()
  return holidaysOfYear(year).includes(date)
}
