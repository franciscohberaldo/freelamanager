import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SettingsForm } from "./settings-form"
import { CompanyForm } from "./company-form"
import { ExportButton } from "./export-button"
import { ApiKeysPanel } from "./api-keys-panel"
import { WebhooksPanel } from "./webhooks-panel"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: settings }, { data: apiKeys }, { data: webhooks }] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", user!.id).single(),
    supabase.from("api_keys").select("id, name, key_prefix, is_active, last_used, created_at")
      .eq("user_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("webhooks").select("id, name, url, events, is_active, last_fired, secret")
      .eq("user_id", user!.id).order("created_at", { ascending: false }),
  ])

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm">Preferências da conta e do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil da empresa</CardTitle>
          <CardDescription>
            Dados exibidos nos invoices em PDF — logo, nome, CNPJ, cor e arredondamento de horas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyForm initialSettings={settings ?? null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conta</CardTitle>
          <CardDescription>Informações da sua conta Supabase</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm"><span className="text-muted-foreground">E-mail:</span> {user?.email}</p>
          <p className="text-sm mt-1"><span className="text-muted-foreground">ID:</span> <span className="font-mono text-xs">{user?.id}</span></p>
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
          <CardTitle className="text-base">API Keys</CardTitle>
          <CardDescription>
            Gere chaves para acessar seus dados via <code className="text-xs">GET /api/v1/*</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeysPanel apiKeys={apiKeys ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhooks</CardTitle>
          <CardDescription>Envie eventos para URLs externas (Zapier, Make, Slack, etc.)</CardDescription>
        </CardHeader>
        <CardContent>
          <WebhooksPanel webhooks={webhooks ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrações</CardTitle>
          <CardDescription>Serviços externos conectados ao sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span>Supabase (banco de dados)</span>
            <span className="text-green-500 font-medium">✓ Conectado</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span>Resend (envio de e-mail)</span>
            <span className="text-muted-foreground text-xs">Configure RESEND_API_KEY no .env</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span>Claude AI (descrição de invoices)</span>
            <span className="text-muted-foreground text-xs">Configure ANTHROPIC_API_KEY no .env</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span>Stripe (link de pagamento)</span>
            <span className="text-muted-foreground text-xs">Configure STRIPE_SECRET_KEY no .env</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backup de dados</CardTitle>
          <CardDescription>Exporte todos os seus dados como JSON para backup ou migração</CardDescription>
        </CardHeader>
        <CardContent>
          <ExportButton />
        </CardContent>
      </Card>
    </div>
  )
}
