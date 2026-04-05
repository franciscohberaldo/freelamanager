import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ProjectClient } from "./project-client"

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: project }, { data: tasks }] = await Promise.all([
    supabase
      .from("projects")
      .select("*, clients(name)")
      .eq("id", params.id)
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("project_tasks")
      .select("*")
      .eq("project_id", params.id)
      .order("position")
      .order("created_at"),
  ])

  if (!project) notFound()

  return <ProjectClient project={project as any} tasks={tasks ?? []} />
}
