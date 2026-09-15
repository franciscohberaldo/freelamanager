import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionNav } from "@/components/section-nav"
import { CompanyForm, type CompanySettings } from "./company-form"
import { PreferencesCard } from "./preferences-card"
import { AccountCard } from "./account-card"
import { ExportButton } from "./export-button"
import { ApiKeysPanel } from "./api-keys-panel"
import { WebhooksPanel } from "./webhooks-panel"

/**
 * Whether a service is actually wired up, read from the environment instead of told to the
 * reader as a fixed sentence — the page used to say "configure RESEND_API_KEY" to someone
 * who had configured it an hour earlier.
 */
function integrations(accountantEmail: string | null) {
  const inboundDomain = process.env.RESEND_INBOUND_DOMAIN
  return [
    {
      name: "Supabase",
      what: "Banco de dados e login",
      on: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      detail: null as string | null,
    },
    {
      name: "Resend",
      what: "Envio da invoice e do pedido de NF",
      on: !!process.env.RESEND_API_KEY,
      detail: process.env.RESEND_FROM_EMAIL
        ? `Enviando como ${process.env.RESEND_FROM_EMAIL}`
        : "Falta RESEND_FROM_EMAIL",
    },
    {
      name: "Resend Inbound",
      what: "Leitura da resposta do contador",
      on: !!inboundDomain && !!process.env.RESEND_WEBHOOK_SECRET,
      detail: inboundDomain
        ? `Recebendo em ${inboundDomain}${process.env.RESEND_WEBHOOK_SECRET ? "" : " · falta o segredo do webhook"}`
        : "Falta RESEND_INBOUND_DOMAIN",
    },
    {
      name: "Contador",
      what: "Para quem o pedido de NF vai",
      on: !!accountantEmail,
      detail: accountantEmail ?? "Preencha em Fiscal e contador",
    },
    {
      name: "Claude",
      what: "Descrição automática de invoices",
      on: !!process.env.ANTHROPIC_API_KEY,
      detail: null,
    },
    {
      name: "Stripe",
      what: "Link de pagamento",
      on: !!process.env.STRIPE_SECRET_KEY,
      detail: null,
    },
  ]
}

const SECTIONS = [
  { id: "empresa", label: "Empresa" },
  { id: "fiscal", label: "Fiscal" },
  { id: "bancos", label: "Bancos" },
  { id: "preferencias", label: "Preferências" },
  { id: "conta", label: "Conta" },
  { id: "dev", label: "Desenvolvedor" },
  { id: "dados", label: "Dados" },
]

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

  const services = integrations(settings?.accountant_email ?? null)

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm">Sua empresa, seus bancos e o que o sistema faz por você</p>
      </div>

      <SectionNav sections={SECTIONS} />

      <CompanyForm initialSettings={(settings ?? null) as CompanySettings | null} />

      <PreferencesCard hourRounding={settings?.hour_rounding ?? "none"} />

      <AccountCard email={user?.email ?? null} userId={user?.id ?? null} />

      <Card id="dev" className="scroll-mt-24">
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
          <CardDescription>O que está ligado de verdade neste ambiente.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {services.map(s => (
            <div key={s.name} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.what}
                  {s.detail && <> · {s.detail}</>}
                </p>
              </div>
              <Badge variant={s.on ? "success" : "outline"} className="shrink-0">
                {s.on ? "Conectado" : "Não configurado"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card id="dados" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-base">Backup de dados</CardTitle>
          <CardDescription>Exporte tudo como JSON, para backup ou migração.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExportButton />
        </CardContent>
      </Card>
    </div>
  )
}
