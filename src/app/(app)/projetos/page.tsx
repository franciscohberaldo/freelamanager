import { createClient } from "@/lib/supabase/server"
import { ProjectsClient } from "./projects-client"

export default async function ProjetosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: projects }, { data: clients }, { data: templates }] = await Promise.all([
    supabase
      .from("projects")
      .select("*, clients(name), project_tasks(id, status, title, description, progress)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("clients")
      .select("id, name")
      .eq("user_id", user!.id)
      .order("name"),
    supabase
      .from("project_templates")
      .select("id, name, tasks")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
  ])

  return (
    <ProjectsClient
      projects={(projects ?? []) as any}
      clients={clients ?? []}
      templates={(templates ?? []) as any}
    />
  )
}
