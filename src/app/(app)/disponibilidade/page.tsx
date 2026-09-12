import { createClient } from "@/lib/supabase/server"
import { AvailabilityClient } from "./availability-client"
import { HoldsPanel, type HoldWithRefs } from "./holds-panel"

export default async function DisponibilidadePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data }, { data: holds }, { data: clients }, { data: jobs }] = await Promise.all([
    supabase
      .from("user_availability")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("availability_holds")
      .select("*, clients(name), jobs(name)")
      .eq("user_id", user!.id)
      .order("start_date"),
    supabase
      .from("clients")
      .select("id, name")
      .eq("user_id", user!.id)
      .order("name"),
    supabase
      .from("jobs")
      .select("id, name, client_id")
      .eq("user_id", user!.id)
      .in("status", ["proposal", "active", "paused"])
      .order("name"),
  ])

  return (
    <>
      <AvailabilityClient availability={data} />
      <div className="px-6 pb-8 max-w-3xl">
        <HoldsPanel
          holds={(holds ?? []) as unknown as HoldWithRefs[]}
          clients={clients ?? []}
          jobs={jobs ?? []}
        />
      </div>
    </>
  )
}
