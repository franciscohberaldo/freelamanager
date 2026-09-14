/**
 * GET|POST /api/cron/recurring-invoices
 *
 * Called daily by Vercel Cron.
 * For each user with recurring invoices enabled:
 *  - monthly: on `recurring_invoice_day`, generates a draft invoice for the previous month
 *  - weekly:  on `recurring_invoice_weekday`, generates a draft invoice for the current
 *             week (starting on `recurring_invoice_week_start`, e.g. Sunday → Saturday)
 *
 * The draft honours the job's billing mode (hourly or daily), sets the due date from
 * `recurring_invoice_due_days` (net terms) and creates an agenda reminder to send it.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { isCronAuthorized } from "@/lib/cron-auth"
import { HOURS_PER_DAY } from "@/lib/invoice-i18n"
import { NextRequest, NextResponse } from "next/server"
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, addDays } from "date-fns"

type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6

async function run(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today    = new Date()
  const todayStr = format(today, "yyyy-MM-dd")

  const { data: settings } = await supabase
    .from("automation_settings")
    .select("user_id, recurring_invoice_job_id, recurring_invoice_day, recurring_invoice_frequency, recurring_invoice_weekday, recurring_invoice_week_start, recurring_invoice_due_days")
    .eq("recurring_invoice_enabled", true)
    .not("recurring_invoice_job_id", "is", null)

  if (!settings?.length) return NextResponse.json({ created: 0, date: todayStr })

  let created = 0
  const skipped: string[] = []

  for (const setting of settings) {
    const weekly = setting.recurring_invoice_frequency === "weekly"
    const due    = weekly ? today.getDay() === setting.recurring_invoice_weekday : today.getDate() === setting.recurring_invoice_day
    if (!due) continue

    const uid   = setting.user_id
    const jobId = setting.recurring_invoice_job_id!

    let periodStart: string, periodEnd: string
    if (weekly) {
      const ws = (setting.recurring_invoice_week_start ?? 0) as Day
      periodStart = format(startOfWeek(today, { weekStartsOn: ws }), "yyyy-MM-dd")
      periodEnd   = format(endOfWeek(today,   { weekStartsOn: ws }), "yyyy-MM-dd")
    } else {
      const prevMonth = subMonths(today, 1)
      periodStart = format(startOfMonth(prevMonth), "yyyy-MM-dd")
      periodEnd   = format(endOfMonth(prevMonth),   "yyyy-MM-dd")
    }

    // Skip if an invoice already exists for this job + period
    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("user_id", uid)
      .eq("job_id", jobId)
      .eq("period_start", periodStart)
      .maybeSingle()
    if (existing) { skipped.push(`${jobId}:exists`); continue }

    const { data: logs } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", uid)
      .eq("job_id", jobId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .order("date")
    if (!logs?.length) { skipped.push(`${jobId}:no-logs`); continue }

    const { data: job } = await supabase
      .from("jobs")
      .select("name, hourly_rate, daily_rate, contract_value, billing_mode, currency, tax_rate, clients(name)")
      .eq("id", jobId)
      .single()
    if (!job) continue

    const isDaily   = job.billing_mode === "daily"
    const isProject = job.billing_mode === "fixed"
    // A project renews at its closed price; its logs carry time, not money.
    const subtotal  = isProject
      ? (job.contract_value ?? 0)
      : logs.reduce((s, l) => s + l.total_value, 0)
    const taxAmount = subtotal * ((job.tax_rate ?? 0) / 100)
    const total     = subtotal + taxAmount
    const totalHrs  = logs.reduce((s, l) => s + l.hours_billed, 0)
    const dueDate   = format(addDays(today, setting.recurring_invoice_due_days ?? 30), "yyyy-MM-dd")

    const { data: invNum } = await supabase
      .rpc("get_next_invoice_number", { p_user_id: uid, p_year: today.getFullYear() })
    if (!invNum) { skipped.push(`${jobId}:no-number`); continue }

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .insert({
        user_id:            uid,
        job_id:             jobId,
        invoice_number:     invNum,
        period_start:       periodStart,
        period_end:         periodEnd,
        total_hours_billed: totalHrs,
        subtotal,
        tax_rate:           job.tax_rate ?? 0,
        tax_amount:         taxAmount,
        total,
        currency:           job.currency,
        status:             "draft",
        due_date:           dueDate,
        notes:              weekly ? "Gerado automaticamente (invoice semanal)" : "Gerado automaticamente por invoice recorrente",
      })
      .select()
      .single()

    if (invErr || !invoice) {
      await supabase.from("automation_log").insert({
        user_id: uid, type: "recurring_invoice", payload: { job_id: jobId, period: `${periodStart} – ${periodEnd}` },
        status: "error", error_msg: invErr?.message ?? "insert failed",
      })
      continue
    }

    await supabase.from("invoice_items").insert(logs.map((l) => ({
      invoice_id:   invoice.id,
      log_id:       l.id,
      date:         l.date,
      hours_billed: l.hours_billed,
      quantity:     isProject ? 1 : isDaily ? Number((l.hours_billed / HOURS_PER_DAY).toFixed(2)) : l.hours_billed,
      unit:         (isProject ? "project" : isDaily ? "day" : "hour") as "day" | "hour" | "project",
      rate:         isProject ? (job.contract_value ?? 0) : isDaily ? job.daily_rate : job.hourly_rate,
      subtotal:     l.total_value,
    })))

    // Reminder on the agenda to review and send the draft
    const clientName = (job.clients as unknown as { name: string } | null)?.name
    await supabase.from("agenda_events").insert({
      user_id:     uid,
      job_id:      jobId,
      title:       `Enviar invoice #${invNum}${clientName ? ` para ${clientName}` : ""} (${job.name})`,
      type:        "deadline",
      event_date:  todayStr,
      task_status: "todo",
      priority:    "high",
    })

    await supabase.from("automation_log").insert({
      user_id: uid,
      type:    "recurring_invoice",
      payload: { invoice_id: invoice.id, invoice_number: invNum, period: `${periodStart} – ${periodEnd}`, frequency: weekly ? "weekly" : "monthly" },
      status:  "ok",
    })

    created++
  }

  return NextResponse.json({ created, skipped, date: todayStr })
}

export const GET  = run
export const POST = run
