/**
 * GET /api/reports/timesheet?job_id=<uuid>&week=<yyyy-MM-dd>&week_start=<0-6>
 *
 * Downloads a weekly timesheet (CSV) for one job, covering the week that
 * contains `week` (defaults to today). `week_start` defaults to 0 (Sunday),
 * matching Sunday–Saturday timesheets used by US studios (e.g. Deltek).
 */
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns"
import { HOURS_PER_DAY } from "@/lib/invoice-i18n"

type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(request: NextRequest) {
  const jobId     = request.nextUrl.searchParams.get("job_id")
  const weekParam = request.nextUrl.searchParams.get("week")
  const wsParam   = Number(request.nextUrl.searchParams.get("week_start") ?? 0)
  const weekStart = (Number.isInteger(wsParam) && wsParam >= 0 && wsParam <= 6 ? wsParam : 0) as Day

  if (!jobId) return NextResponse.json({ error: "job_id obrigatório" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const anchor = weekParam ? parseISO(weekParam) : new Date()
  if (Number.isNaN(anchor.getTime())) return NextResponse.json({ error: "week inválida" }, { status: 400 })

  const start = startOfWeek(anchor, { weekStartsOn: weekStart })
  const end   = endOfWeek(anchor,   { weekStartsOn: weekStart })
  const startStr = format(start, "yyyy-MM-dd")
  const endStr   = format(end,   "yyyy-MM-dd")

  const [{ data: job }, { data: logs }] = await Promise.all([
    supabase
      .from("jobs")
      .select("name, project_code, billing_mode, clients(name)")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("daily_logs")
      .select("date, hours_worked, hours_billed, meetings, requests")
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .gte("date", startStr)
      .lte("date", endStr)
      .order("date"),
  ])

  if (!job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 })

  const byDate = new Map<string, { hours_worked: number; hours_billed: number; notes: string[] }>()
  for (const l of logs ?? []) {
    const cur = byDate.get(l.date) ?? { hours_worked: 0, hours_billed: 0, notes: [] }
    cur.hours_worked += l.hours_worked
    cur.hours_billed += l.hours_billed
    for (const n of [l.requests, l.meetings]) if (n) cur.notes.push(n)
    byDate.set(l.date, cur)
  }

  const clientName = (job.clients as unknown as { name: string } | null)?.name ?? ""
  const isDaily = job.billing_mode === "daily"

  const header = ["Date", "Weekday", "Hours worked", "Hours billed", ...(isDaily ? ["Days billed"] : []), "Notes"]
  const rows = eachDayOfInterval({ start, end }).map((d) => {
    const key = format(d, "yyyy-MM-dd")
    const e = byDate.get(key)
    return [
      key,
      format(d, "EEEE"),
      e ? e.hours_worked : 0,
      e ? e.hours_billed : 0,
      ...(isDaily ? [e ? Number((e.hours_billed / HOURS_PER_DAY).toFixed(2)) : 0] : []),
      e ? e.notes.join(" | ") : "",
    ]
  })
  const totalWorked = rows.reduce((s, r) => s + Number(r[2]), 0)
  const totalBilled = rows.reduce((s, r) => s + Number(r[3]), 0)
  const totalRow = ["TOTAL", "", totalWorked, totalBilled, ...(isDaily ? [Number((totalBilled / HOURS_PER_DAY).toFixed(2))] : []), ""]

  const meta = [
    ["Project", job.project_code ? `${job.name} (${job.project_code})` : job.name],
    ["Client", clientName],
    ["Week", `${startStr} to ${endStr}`],
    [],
  ]

  const csv = [...meta, header, ...rows, totalRow]
    .map((r) => r.map(csvEscape).join(","))
    .join("\r\n")

  const safeName = job.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="timesheet-${safeName}-${startStr}.csv"`,
    },
  })
}
