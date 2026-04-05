import { createClient } from "@/lib/supabase/server"
import { ProjectsClient } from "./projects-client"

export default async function ProjetosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: projects }, { data: clients }] = await Promise.all([
    supabase
      .from("projects")
      .select("*, clients(name), project_tasks(id, status)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("clients")
      .select("id, name")
      .eq("user_id", user!.id)
      .order("name"),
  ])

  return <ProjectsClient projects={(projects ?? []) as any} clients={clients ?? []} />
}
