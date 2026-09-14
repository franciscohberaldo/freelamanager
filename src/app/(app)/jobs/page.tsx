import { redirect } from "next/navigation"

/** The job list merged into /historico, which also creates jobs; old links land there. */
export default function JobsPage() {
  redirect("/historico")
}
