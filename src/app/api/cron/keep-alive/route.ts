import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from("user_settings").select("id").limit(1)

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 })
  }

  return NextResponse.json({ status: "alive", timestamp: new Date().toISOString() })
}
