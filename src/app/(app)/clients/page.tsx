import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ClientDialog } from "./client-dialog"
import { CsvExportButton } from "@/components/csv-export-button"
import { Plus, Users, Star, ChevronRight } from "lucide-react"
import Link from "next/link"

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
        <div className="flex items-center gap-2">
          <CsvExportButton
            filename="clientes.csv"
            data={(clients ?? []).map(c => ({
              nome:     c.name,
              empresa:  c.company ?? "",
              email:    c.email ?? "",
              telefone: c.phone ?? "",
            }))}
            columns={[
              { key: "nome",     label: "Nome" },
              { key: "empresa",  label: "Empresa" },
              { key: "email",    label: "E-mail" },
              { key: "telefone", label: "Telefone" },
            ]}
          />
          <ClientDialog mode="create">
            <Button><Plus className="w-4 h-4" />Novo Cliente</Button>
          </ClientDialog>
        </div>
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
        {clients?.map((client) => {
          const score = client.score as number | null
          return (
            <Card key={client.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                <Link href={`/clients/${client.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{client.name}</p>
                    {score && score > 0 && (
                      <span className="flex items-center gap-0.5">
                        {Array.from({ length: score }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                        ))}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {client.company && `${client.company} · `}
                    {client.email}
                  </p>
                  {(client.client_contacts as { name: string; role: string | null }[])?.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {(client.client_contacts as { name: string; role: string | null }[]).map(c => c.name).join(", ")}
                    </p>
                  )}
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  {client.phone && <span className="text-sm text-muted-foreground">{client.phone}</span>}
                  <ClientDialog mode="edit" client={client}>
                    <Button variant="ghost" size="sm">Editar</Button>
                  </ClientDialog>
                  <Link href={`/clients/${client.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
