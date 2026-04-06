import { createClient } from "@/lib/supabase/server"
import { AutomacoesClient } from "./automacoes-client"

export default async function AutomacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: settings }, { data: jobs }, { data: logs }] = await Promise.all([
    supabase
      .from("automation_settings")
      .select("*")
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("jobs")
      .select("id, name, clients(name)")
      .eq("user_id", user!.id)
      .in("status", ["active", "paused"])
      .order("name"),
    supabase
      .from("automation_log")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  return (
    <AutomacoesClient
      initialSettings={settings ?? null}
      jobs={(jobs ?? []) as any}
      logs={logs ?? []}
    />
  )
}
