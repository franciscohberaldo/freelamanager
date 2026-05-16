import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const uid = user.id

  const [
    { data: clients },
    { data: jobs },
    { data: logs },
    { data: invoices },
    { data: invoiceItems },
    { data: expenses },
    { data: goals },
    { data: projects },
    { data: agendaEvents },
    { data: settings },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("user_id", uid),
    supabase.from("jobs").select("*").eq("user_id", uid),
    supabase.from("daily_logs").select("*").eq("user_id", uid).order("date"),
    supabase.from("invoices").select("*").eq("user_id", uid).order("created_at"),
    supabase.from("invoice_items").select("*, invoices!inner(user_id)").eq("invoices.user_id", uid),
    supabase.from("expenses").select("*").eq("user_id", uid).order("date"),
    supabase.from("user_goals").select("*").eq("user_id", uid),
    supabase.from("projects").select("*").eq("user_id", uid),
    supabase.from("agenda_events").select("*").eq("user_id", uid).order("event_date"),
    supabase.from("user_settings").select("*").eq("user_id", uid).single(),
  ])

  const exportData = {
    exportedAt: new Date().toISOString(),
    userId:     uid,
    email:      user.email,
    data: {
      clients:      clients      ?? [],
      jobs:         jobs         ?? [],
      daily_logs:   logs         ?? [],
      invoices:     invoices     ?? [],
      invoice_items: (invoiceItems ?? []).map(({ invoices: _, ...item }) => item),
      expenses:     expenses     ?? [],
      user_goals:   goals        ?? [],
      projects:     projects     ?? [],
      agenda_events: agendaEvents ?? [],
      user_settings: settings    ?? null,
    },
  }

  const json = JSON.stringify(exportData, null, 2)
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(json, {
    headers: {
      "Content-Type":        "application/json",
      "Content-Disposition": `attachment; filename="freela-manager-backup-${date}.json"`,
    },
  })
}
