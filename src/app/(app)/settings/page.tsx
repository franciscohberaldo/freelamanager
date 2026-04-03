import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SettingsForm } from "./settings-form"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm">Preferências da conta e do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conta</CardTitle>
          <CardDescription>Informações da sua conta Supabase</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm"><span className="text-muted-foreground">E-mail:</span> {user?.email}</p>
          <p className="text-sm mt-1"><span className="text-muted-foreground">ID:</span> {user?.id}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alterar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrações</CardTitle>
          <CardDescription>Configure os serviços externos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span>Supabase (banco de dados)</span>
            <span className="text-green-500 font-medium">✓ Conectado</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span>Resend (envio de e-mail)</span>
            <span className="text-muted-foreground">Configure RESEND_API_KEY no .env</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
