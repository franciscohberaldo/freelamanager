import { createAdminClient } from "@/lib/supabase/admin"

export async function validatePortalToken(
  token: string
): Promise<{ client_id: string; user_id: string } | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("client_portal_tokens")
    .select("client_id, user_id")
    .eq("token", token)
    .single()

  if (error || !data) return null
  return { client_id: data.client_id, user_id: data.user_id }
}
