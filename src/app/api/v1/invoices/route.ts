import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { authenticateApiKey } from "@/lib/api-auth"

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to   = searchParams.get("to")

  const supabase = await createClient()
  let query = supabase
    .from("invoices")
    .select("id, invoice_number, total, currency, status, period_start, period_end, due_date, paid_at, jobs(name)")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })

  if (from) query = query.gte("period_start", from)
  if (to)   query = query.lte("period_start", to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count: data?.length ?? 0 })
}
