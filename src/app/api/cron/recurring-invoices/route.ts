/**
 * POST /api/cron/recurring-invoices
 *
 * Called daily by Vercel Cron.
 * For each user with recurring invoices enabled, if today == recurring_invoice_day,
 * auto-generates an invoice for the previous month's logs.
 */
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns"

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase   = await createClient()
  const today      = new Date()
  const todayDay   = today.getDate()
  const todayStr   = format(today, "yyyy-MM-dd")

  const { data: settings } = await supabase
    .from("automation_settings")
    .select("user_id, recurring_invoice_job_id, recurring_invoice_day")
    .eq("recurring_invoice_enabled", true)
    .not("recurring_invoice_job_id", "is", null)

  if (!settings?.length) return NextResponse.json({ created: 0 })

  let created = 0

  for (const setting of settings) {
    if (setting.recurring_invoice_day !== todayDay) continue

    const uid    = setting.user_id
    const jobId  = setting.recurring_invoice_job_id

    // Previous month's period
    const prevMonth = subMonths(today, 1)
    const periodStart = format(startOfMonth(prevMonth), "yyyy-MM-dd")
    const periodEnd   = format(endOfMonth(prevMonth),   "yyyy-MM-dd")

    // Check no invoice was already generated for this period + job
    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("user_id", uid)
      .eq("job_id", jobId!)
      .eq("period_start", periodStart)
      .single()

    if (existing) continue

    // Fetch logs
    const { data: logs } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", uid)
      .eq("job_id", jobId!)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .order("date")

    if (!logs?.length) continue

    // Fetch job for rate/currency
    const { data: job } = await supabase
      .from("jobs")
      .select("hourly_rate, currency, tax_rate")
      .eq("id", jobId!)
      .single()

    if (!job) continue

    const subtotal  = logs.reduce((s, l) => s + l.total_value, 0)
    const taxAmount = subtotal * ((job.tax_rate ?? 0) / 100)
    const total     = subtotal + taxAmount
    const totalHrs  = logs.reduce((s, l) => s + l.hours_billed, 0)
    const year      = today.getFullYear()

    const { data: invNum } = await supabase
      .rpc("get_next_invoice_number", { p_user_id: uid, p_year: year })

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .insert({
        user_id:            uid,
        job_id:             jobId!,
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
        notes:              "Gerado automaticamente por invoice recorrente",
      })
      .select()
      .single()

    if (invErr || !invoice) continue

    const items = logs.map(l => ({
      invoice_id:   invoice.id,
      log_id:       l.id,
      date:         l.date,
      hours_billed: l.hours_billed,
      rate:         job.hourly_rate,
      subtotal:     l.total_value,
    }))
    await supabase.from("invoice_items").insert(items)

    await supabase.from("automation_log").insert({
      user_id: uid,
      type:    "recurring_invoice",
      payload: { invoice_id: invoice.id, invoice_number: invNum, period: `${periodStart} – ${periodEnd}` },
      status:  "ok",
    })

    created++
  }

  return NextResponse.json({ created, date: todayStr })
}
