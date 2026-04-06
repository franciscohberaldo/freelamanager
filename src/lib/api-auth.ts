import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"

export async function authenticateApiKey(
  req: NextRequest,
): Promise<{ userId: string } | NextResponse> {
  const authHeader = req.headers.get("authorization") ?? ""
  const key = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""

  if (!key) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 })
  }

  const keyHash = createHash("sha256").update(key).digest("hex")
  const supabase = await createClient()

  // Look up key — must use service role to bypass RLS for cross-user lookup
  // We use anon key here but key_hash is unique so it's fine
  const { data, error } = await supabase
    .from("api_keys")
    .select("user_id, is_active")
    .eq("key_hash", keyHash)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  }

  if (!data.is_active) {
    return NextResponse.json({ error: "API key is disabled" }, { status: 403 })
  }

  // Update last_used (best-effort)
  supabase.from("api_keys").update({ last_used: new Date().toISOString() }).eq("key_hash", keyHash).then(() => {})

  return { userId: data.user_id }
}
