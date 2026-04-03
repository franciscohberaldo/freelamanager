import { createClient } from "@/lib/supabase/server"
import { AvailabilityClient } from "./availability-client"

export default async function DisponibilidadePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from("user_availability")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle()

  return <AvailabilityClient availability={data} />
}
