/**
 * GET|POST /api/cron/billing-reminders
 *
 * Called daily by Vercel Cron (see vercel.json).
 * Finds invoices past their due_date by N days (per user settings)
 * and sends a reminder email to the client.
 *
 * Protected by CRON_SECRET env var.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { isCronAuthorized } from "@/lib/cron-auth"
import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { format, parseISO, differenceInDays } from "date-fns"
import { ptBR } from "date-fns/locale"

function fmt(v: number, c = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: c }).format(v)
}

async function run(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today    = new Date()
  const todayStr = format(today, "yyyy-MM-dd")

  // Load all users that have billing reminders enabled
  const { data: settings } = await supabase
    .from("automation_settings")
    .select("user_id, billing_reminder_days")
    .eq("billing_reminder_enabled", true)

  if (!settings?.length) return NextResponse.json({ sent: 0 })

  const resend = new Resend(process.env.RESEND_API_KEY)
  let sent = 0

  for (const setting of settings) {
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() - setting.billing_reminder_days)
    const cutoffStr = format(cutoff, "yyyy-MM-dd")

    // Invoices that are sent/overdue and past due_date by the configured days
    const { data: invoices } = await supabase
      .from("invoices")
      .select("*, jobs(name, clients(name, email))")
      .eq("user_id", setting.user_id)
      .in("status", ["sent", "overdue"])
      .not("due_date", "is", null)
      .lte("due_date", cutoffStr)

    for (const inv of invoices ?? []) {
      const job         = inv.jobs as unknown as { name: string; clients: { name: string; email: string | null } | null } | null
      const clientEmail = job?.clients?.email
      if (!clientEmail) continue

      const daysPast = differenceInDays(today, parseISO(inv.due_date!))
      const subject  = `Lembrete: Invoice #${inv.invoice_number} venceu há ${daysPast} dia${daysPast !== 1 ? "s" : ""}`

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;color:#333">
          <div style="background:#dc2626;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">Lembrete de pagamento</h2>
          </div>
          <div style="padding:24px;border:1px solid #eee;border-top:none">
            <p>Olá, <strong>${job?.clients?.name}</strong>,</p>
            <p>O invoice <strong>#${inv.invoice_number}</strong> no valor de <strong>${fmt(inv.total, inv.currency)}</strong>
              venceu em <strong>${format(parseISO(inv.due_date!), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</strong>
              (há ${daysPast} dia${daysPast !== 1 ? "s" : ""}).
            </p>
            <p>Por favor, regularize o pagamento o quanto antes.</p>
            <p style="color:#666;font-size:12px;margin-top:20px">Serviço: ${job?.name}</p>
          </div>
        </div>
      `

      const { error: emailError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "noreply@freelamanager.com",
        to:   [clientEmail],
        subject,
        html,
      })

      // Log the action
      await supabase.from("automation_log").insert({
        user_id: setting.user_id,
        type:    "billing_reminder",
        payload: { invoice_id: inv.id, invoice_number: inv.invoice_number, client_email: clientEmail, days_past: daysPast },
        status:  emailError ? "error" : "ok",
        error_msg: emailError?.message ?? null,
      })

      if (!emailError) {
        sent++
        // Mark as overdue
        await supabase.from("invoices").update({ status: "overdue" }).eq("id", inv.id).eq("status", "sent")
      }
    }
  }

  return NextResponse.json({ sent, timestamp: todayStr })
}

export const GET  = run
export const POST = run
