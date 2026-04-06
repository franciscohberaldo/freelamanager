import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createHash, randomBytes } from "crypto"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 })

  // Generate key: fm_<random_48_hex>
  const rawKey   = `fm_${randomBytes(24).toString("hex")}`
  const keyHash  = createHash("sha256").update(rawKey).digest("hex")
  const keyPrefix = rawKey.slice(0, 8)

  const { error } = await supabase.from("api_keys").insert({
    user_id:    user.id,
    name:       name.trim(),
    key_hash:   keyHash,
    key_prefix: keyPrefix,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return the raw key only once
  return NextResponse.json({ key: rawKey })
}
