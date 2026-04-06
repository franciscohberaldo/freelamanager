import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { authenticateApiKey } from "@/lib/api-auth"

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, company, email, phone, score, created_at")
    .eq("user_id", auth.userId)
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count: data?.length ?? 0 })
}
