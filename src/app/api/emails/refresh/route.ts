/**
 * POST /api/emails/refresh
 *
 * The inbox's "Atualizar" button: the same poll the hourly cron runs, on demand for the
 * signed-in owner.
 */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { pollNewEmails } from "@/lib/process-received-email"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const result = await pollNewEmails()
  return NextResponse.json(result)
}
