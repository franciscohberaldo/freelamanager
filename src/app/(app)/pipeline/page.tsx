import { createClient } from "@/lib/supabase/server"
import { PipelineClient } from "./pipeline-client"

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: deals }, { data: clients }] = await Promise.all([
    supabase
      .from("sales_pipeline")
      .select("*, clients(id, name, company)")
      .eq("user_id", user!.id)
      .order("position")
      .range(0, 49),
    supabase
      .from("clients")
      .select("id, name, company")
      .eq("user_id", user!.id)
      .order("name"),
  ])

  return <PipelineClient deals={deals ?? []} clients={clients ?? []} />
}
