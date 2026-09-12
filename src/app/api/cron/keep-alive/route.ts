import { createAdminClient } from "@/lib/supabase/admin"
import { isCronAuthorized } from "@/lib/cron-auth"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from("user_settings").select("user_id").limit(1)

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 })
  }

  return NextResponse.json({ status: "alive", timestamp: new Date().toISOString() })
}
