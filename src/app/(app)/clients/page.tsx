import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ClientDialog } from "./client-dialog"
import { Plus, Users } from "lucide-react"

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: clients } = await supabase
    .from("clients")
    .select("*, client_contacts(*)")
    .eq("user_id", user!.id)
    .order("name")

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground text-sm">{clients?.length ?? 0} clientes cadastrados</p>
        </div>
        <ClientDialog mode="create">
          <Button><Plus className="w-4 h-4" />Novo Cliente</Button>
        </ClientDialog>
      </div>

      <div className="grid gap-4">
        {clients?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum cliente cadastrado ainda.</p>
            </CardContent>
          </Card>
        )}
        {clients?.map((client) => (
          <Card key={client.id} className="hover:shadow-md transition-shadow">
            <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{client.name}</p>
                <p className="text-sm text-muted-foreground">
                  {client.company && `${client.company} · `}
                  {client.email}
                </p>
                {(client.client_contacts as { name: string; role: string | null }[])?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {(client.client_contacts as { name: string; role: string | null }[]).map(c => c.name).join(", ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {client.phone && <span className="text-sm text-muted-foreground">{client.phone}</span>}
                <ClientDialog mode="edit" client={client}>
                  <Button variant="ghost" size="sm">Editar</Button>
                </ClientDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
