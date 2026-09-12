/**
 * GET|POST /api/cron/weekly-summary
 *
 * Called weekly (Monday 08:00 UTC) by Vercel Cron.
 * Sends a weekly summary email to each user that opted in.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { isCronAuthorized } from "@/lib/cron-auth"
import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns"
import { ptBR } from "date-fns/locale"

function fmt(v: number, c = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: c }).format(v)
}

function fmtH(h: number) {
  const hrs = Math.floor(h)
  const min = Math.round((h - hrs) * 60)
  return min > 0 ? `${hrs}h ${min}min` : `${hrs}h`
}

async function run(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Last week range
  const lastWeekEnd   = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 })
  const lastWeekStart = startOfWeek(lastWeekEnd, { weekStartsOn: 1 })
  const weekStartStr  = format(lastWeekStart, "yyyy-MM-dd")
  const weekEndStr    = format(lastWeekEnd,   "yyyy-MM-dd")
  const weekLabel     = `${format(lastWeekStart, "dd/MM", { locale: ptBR })} – ${format(lastWeekEnd, "dd/MM/yyyy", { locale: ptBR })}`

  const { data: settings } = await supabase
    .from("automation_settings")
    .select("user_id")
    .eq("weekly_summary_enabled", true)

  if (!settings?.length) return NextResponse.json({ sent: 0 })

  const resend = new Resend(process.env.RESEND_API_KEY)
  let sent = 0

  for (const setting of settings) {
    const uid = setting.user_id

    const [
      { data: user },
      { data: logs },
      { data: invoices },
      { data: expenses },
      { data: upcomingEvents },
    ] = await Promise.all([
      supabase.auth.admin.getUserById(uid),
      supabase.from("daily_logs").select("hours_worked, hours_billed, total_value")
        .eq("user_id", uid).gte("date", weekStartStr).lte("date", weekEndStr),
      supabase.from("invoices").select("invoice_number, total, currency, status")
        .eq("user_id", uid).eq("status", "sent"),
      supabase.from("expenses").select("amount").eq("user_id", uid)
        .gte("date", weekStartStr).lte("date", weekEndStr),
      supabase.from("agenda_events").select("title, event_date, task_status")
        .eq("user_id", uid).eq("is_done", false)
        .gte("event_date", format(new Date(), "yyyy-MM-dd"))
        .order("event_date").limit(5),
    ])

    const email = user?.user?.email
    if (!email) continue

    const totalHours    = logs?.reduce((s, l) => s + l.hours_worked, 0) ?? 0
    const totalBilled   = logs?.reduce((s, l) => s + l.total_value, 0) ?? 0
    const totalExpenses = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
    const pendingInvs   = invoices?.length ?? 0
    const pendingValue  = invoices?.reduce((s, i) => s + i.total, 0) ?? 0

    const eventsHtml = upcomingEvents?.map(ev => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${ev.title}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;color:#666">${format(new Date(ev.event_date), "dd/MM", { locale: ptBR })}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;color:#f59e0b;font-size:12px">${ev.task_status ?? ""}</td>
      </tr>
    `).join("") ?? "<tr><td colspan='3' style='padding:8px;color:#999'>Nenhum evento</td></tr>"

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#333">
        <div style="background:#7c3aed;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0">Resumo semanal 📊</h2>
          <p style="margin:4px 0 0;opacity:0.85;font-size:14px">${weekLabel}</p>
        </div>
        <div style="padding:24px;border:1px solid #eee;border-top:none">

          <h3 style="margin:0 0 12px;font-size:15px;color:#555">Na semana passada</h3>
          <div style="display:flex;gap:16px;margin-bottom:20px">
            <div style="flex:1;background:#f5f3ff;border-radius:8px;padding:12px">
              <p style="margin:0;font-size:12px;color:#7c3aed">Horas trabalhadas</p>
              <p style="margin:4px 0 0;font-size:22px;font-weight:bold">${fmtH(totalHours)}</p>
            </div>
            <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:12px">
              <p style="margin:0;font-size:12px;color:#16a34a">Valor faturado</p>
              <p style="margin:4px 0 0;font-size:22px;font-weight:bold">${fmt(totalBilled)}</p>
            </div>
            <div style="flex:1;background:#fef2f2;border-radius:8px;padding:12px">
              <p style="margin:0;font-size:12px;color:#dc2626">Despesas</p>
              <p style="margin:4px 0 0;font-size:22px;font-weight:bold">${fmt(totalExpenses)}</p>
            </div>
          </div>

          ${pendingInvs > 0 ? `
            <div style="background:#fff7ed;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px">
              <p style="margin:0;font-size:14px"><strong>${pendingInvs} invoice${pendingInvs !== 1 ? "s" : ""} pendente${pendingInvs !== 1 ? "s" : ""}</strong>
              totalizando <strong>${fmt(pendingValue)}</strong></p>
            </div>
          ` : ""}

          <h3 style="margin:0 0 8px;font-size:15px;color:#555">Próximos eventos</h3>
          <table style="width:100%;border-collapse:collapse">
            <tbody>${eventsHtml}</tbody>
          </table>

          <p style="margin-top:24px;font-size:12px;color:#aaa">
            Você recebe este resumo porque ativou os resumos semanais no Freela Manager.
          </p>
        </div>
      </div>
    `

    const { error } = await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? "noreply@freelamanager.com",
      to:      [email],
      subject: `📊 Resumo semanal — ${weekLabel}`,
      html,
    })

    await supabase.from("automation_log").insert({
      user_id:   uid,
      type:      "weekly_summary",
      payload:   { week: weekLabel, hours: totalHours, billed: totalBilled },
      status:    error ? "error" : "ok",
      error_msg: error?.message ?? null,
    })

    if (!error) sent++
  }

  return NextResponse.json({ sent })
}

export const GET  = run
export const POST = run
