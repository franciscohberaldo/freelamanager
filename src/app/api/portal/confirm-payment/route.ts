import { NextRequest, NextResponse } from "next/server"
import { validatePortalToken } from "@/lib/portal-auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  let body: { token?: string; invoice_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { token, invoice_id } = body

  if (!token || !invoice_id) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
  }

  const auth = await validatePortalToken(token)
  if (!auth) {
    return new NextResponse(null, { status: 404 })
  }

  const supabase = createAdminClient()

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("id, user_id, job_id, jobs(client_id)")
    .eq("id", invoice_id)
    .eq("user_id", auth.user_id)
    .single()

  if (invError || !invoice) {
    return new NextResponse(null, { status: 404 })
  }

  const job = invoice.jobs as unknown as { client_id: string }

  if (job.client_id !== auth.client_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const confirmedAt = new Date().toISOString()

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ client_confirmed_at: confirmedAt })
    .eq("id", invoice_id)

  if (updateError) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }

  return NextResponse.json({ success: true, confirmed_at: confirmedAt })
}
