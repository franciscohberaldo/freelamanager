/**
 * POST /api/automations/run  { endpoint: "keep-alive" | "recurring-invoices" | "billing-reminders" | "weekly-summary" }
 *
 * Lets a logged-in user trigger a cron job manually (the "Testar" button in
 * /automacoes) without exposing CRON_SECRET to the browser.
 */
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const ALLOWED = new Set(["keep-alive", "recurring-invoices", "billing-reminders", "weekly-summary"])

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { endpoint } = await request.json().catch(() => ({}))
  if (typeof endpoint !== "string" || !ALLOWED.has(endpoint)) {
    return NextResponse.json({ error: "endpoint inválido" }, { status: 400 })
  }
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET não configurado no servidor" }, { status: 500 })
  }

  const target = new URL(`/api/cron/${endpoint}`, request.nextUrl.origin)
  const res = await fetch(target, {
    method: "GET",
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    cache: "no-store",
  })
  const body = await res.json().catch(() => ({}))
  return NextResponse.json(body, { status: res.status })
}
