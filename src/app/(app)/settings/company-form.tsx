"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

interface UserSettings {
  company_name: string | null
  cnpj_cpf: string | null
  logo_url: string | null
  invoice_color: string
  hour_rounding: string
  bank_beneficiary: string | null
  bank_name: string | null
  bank_account_type: string | null
  bank_account_number: string | null
  bank_routing: string | null
  bank_swift: string | null
  bank_iban: string | null
  bank_address: string | null
  pix_key: string | null
  legal_name: string | null
  municipal_registration: string | null
  fiscal_address: string | null
  accountant_name: string | null
  accountant_email: string | null
  next_invoice_seq: number
  intermediary_bank_name: string | null
  intermediary_bank_swift: string | null
  intermediary_bank_aba: string | null
  intermediary_bank_account: string | null
  intermediary_bank_address: string | null
}

const BANK_FIELDS: Array<{ key: keyof UserSettings; label: string; placeholder: string; group: "wire" | "pix" }> = [
  { key: "bank_beneficiary",    label: "Beneficiário (nome na conta)", placeholder: "Francisco H. Beraldo",      group: "wire" },
  { key: "bank_name",           label: "Banco",                        placeholder: "Banco Inter / Wise / Nomad", group: "wire" },
  { key: "bank_account_type",   label: "Tipo de conta",                placeholder: "Checking",                   group: "wire" },
  { key: "bank_account_number", label: "Número da conta",              placeholder: "Account #",                  group: "wire" },
  { key: "bank_routing",        label: "Routing / ABA",                placeholder: "Routing #",                  group: "wire" },
  { key: "bank_swift",          label: "SWIFT / BIC",                  placeholder: "Opcional",                   group: "wire" },
  { key: "bank_iban",           label: "IBAN",                         placeholder: "Opcional",                   group: "wire" },
  { key: "bank_address",        label: "Endereço do banco",            placeholder: "Opcional",                   group: "wire" },
  { key: "pix_key",             label: "Chave PIX",                    placeholder: "CPF, e-mail, telefone ou aleatória", group: "pix" },
]

const FISCAL_FIELDS: Array<{ key: keyof UserSettings; label: string; placeholder: string }> = [
  { key: "legal_name",             label: "Razão social",           placeholder: "Estúdio Judite Ltda" },
  { key: "municipal_registration", label: "Inscrição municipal (CCM)", placeholder: "64377270" },
  { key: "fiscal_address",         label: "Endereço fiscal",        placeholder: "Rua, número, complemento, bairro, cidade, UF, CEP" },
  { key: "accountant_name",        label: "Contador (nome)",        placeholder: "Nome do contador" },
  { key: "accountant_email",       label: "Contador (e-mail)",      placeholder: "contador@escritorio.com.br" },
]
const INTERMEDIARY_FIELDS: Array<{ key: keyof UserSettings; label: string; placeholder: string }> = [
  { key: "intermediary_bank_name",    label: "Banco intermediário",      placeholder: "JP Morgan Chase N.A." },
  { key: "intermediary_bank_swift",   label: "SWIFT do intermediário",   placeholder: "CHASUS33" },
  { key: "intermediary_bank_aba",     label: "ABA / routing",            placeholder: "021000021" },
  { key: "intermediary_bank_account", label: "Conta no intermediário",   placeholder: "360556937" },
  { key: "intermediary_bank_address", label: "Endereço do intermediário", placeholder: "270 Park Avenue, New York, NY 10017, US" },
]

const PRESET_COLORS = [
  { label: "Azul",    value: "#1e40af" },
  { label: "Violeta", value: "#7c3aed" },
  { label: "Verde",   value: "#16a34a" },
  { label: "Vermelho",value: "#dc2626" },
  { label: "Laranja", value: "#ea580c" },
  { label: "Cinza",   value: "#374151" },
]

export function CompanyForm({ initialSettings }: { initialSettings: UserSettings | null }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<UserSettings>({
    company_name:  initialSettings?.company_name  ?? "",
    cnpj_cpf:      initialSettings?.cnpj_cpf      ?? "",
    logo_url:      initialSettings?.logo_url      ?? "",
    invoice_color: initialSettings?.invoice_color ?? "#1e40af",
    hour_rounding: initialSettings?.hour_rounding ?? "none",
    bank_beneficiary:    initialSettings?.bank_beneficiary    ?? "",
    bank_name:           initialSettings?.bank_name           ?? "",
    bank_account_type:   initialSettings?.bank_account_type   ?? "",
    bank_account_number: initialSettings?.bank_account_number ?? "",
    bank_routing:        initialSettings?.bank_routing        ?? "",
    bank_swift:          initialSettings?.bank_swift          ?? "",
    bank_iban:           initialSettings?.bank_iban           ?? "",
    bank_address:        initialSettings?.bank_address        ?? "",
    pix_key:             initialSettings?.pix_key             ?? "",
    legal_name:                initialSettings?.legal_name                ?? "",
    municipal_registration:    initialSettings?.municipal_registration    ?? "",
    fiscal_address:             initialSettings?.fiscal_address            ?? "",
    accountant_name:            initialSettings?.accountant_name           ?? "",
    accountant_email:           initialSettings?.accountant_email          ?? "",
    next_invoice_seq:           initialSettings?.next_invoice_seq          ?? 102,
    intermediary_bank_name:     initialSettings?.intermediary_bank_name    ?? "",
    intermediary_bank_swift:    initialSettings?.intermediary_bank_swift   ?? "",
    intermediary_bank_aba:      initialSettings?.intermediary_bank_aba     ?? "",
    intermediary_bank_account:  initialSettings?.intermediary_bank_account ?? "",
    intermediary_bank_address:  initialSettings?.intermediary_bank_address ?? "",
  })

  function set<K extends keyof UserSettings>(k: K, v: UserSettings[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from("user_settings").upsert({
      user_id:       user!.id,
      company_name:  form.company_name  || null,
      cnpj_cpf:      form.cnpj_cpf      || null,
      logo_url:      form.logo_url      || null,
      invoice_color: form.invoice_color,
      hour_rounding: form.hour_rounding,
      ...Object.fromEntries(BANK_FIELDS.map(f => [f.key, (form[f.key] as string | null)?.trim() || null])),
      ...Object.fromEntries([...FISCAL_FIELDS, ...INTERMEDIARY_FIELDS].map(f => [f.key, (form[f.key] as string | null)?.trim() || null])),
      next_invoice_seq: Math.max(1, Number(form.next_invoice_seq) || 102),
    }, { onConflict: "user_id" })

    if (error) toast.error("Erro ao salvar configurações")
    else toast.success("Configurações salvas!")
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label>Nome da empresa / freelancer</Label>
        <Input
          value={form.company_name ?? ""}
          onChange={e => set("company_name", e.target.value)}
          placeholder="Ex: João Silva Dev"
        />
      </div>

      <div className="space-y-2">
        <Label>CNPJ / CPF</Label>
        <Input
          value={form.cnpj_cpf ?? ""}
          onChange={e => set("cnpj_cpf", e.target.value)}
          placeholder="00.000.000/0001-00 ou 000.000.000-00"
        />
      </div>

      <div className="space-y-2">
        <Label>URL do logo</Label>
        <Input
          value={form.logo_url ?? ""}
          onChange={e => set("logo_url", e.target.value)}
          placeholder="https://exemplo.com/logo.png"
          type="url"
        />
        {form.logo_url && (
          <div className="mt-2 p-2 border rounded-md inline-block bg-muted/30">
            <img
              src={form.logo_url}
              alt="Logo preview"
              className="h-10 max-w-[200px] object-contain"
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Aparece no topo dos invoices em PDF. Use um link público (imgur, GitHub, CDN).
        </p>
      </div>

      <div className="space-y-2">
        <Label>Cor do invoice</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => set("invoice_color", c.value)}
              className={[
                "w-8 h-8 rounded-full border-2 transition-all",
                form.invoice_color === c.value
                  ? "border-foreground scale-110 shadow-md"
                  : "border-transparent hover:scale-105",
              ].join(" ")}
              style={{ background: c.value }}
            />
          ))}
          <div className="relative">
            <input
              type="color"
              value={form.invoice_color}
              onChange={e => set("invoice_color", e.target.value)}
              className="w-8 h-8 rounded-full border cursor-pointer opacity-0 absolute inset-0"
              title="Cor personalizada"
            />
            <div
              className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center text-muted-foreground text-xs pointer-events-none"
              title="Cor personalizada"
            >+</div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-4 h-4 rounded border" style={{ background: form.invoice_color }} />
          <span className="text-xs text-muted-foreground font-mono">{form.invoice_color}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Arredondamento de horas</Label>
        <Select value={form.hour_rounding} onValueChange={v => set("hour_rounding", v)}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem arredondamento</SelectItem>
            <SelectItem value="0.25">Arredondar para 15 min</SelectItem>
            <SelectItem value="0.5">Arredondar para 30 min</SelectItem>
            <SelectItem value="1">Arredondar para 1 hora</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Aplicado automaticamente às horas trabalhadas ao salvar um registro.
        </p>
      </div>

      <div className="space-y-3 pt-2 border-t">
        <div>
          <p className="text-sm font-medium">Dados fiscais e contador</p>
          <p className="text-xs text-muted-foreground">Usados no PDF da invoice e no pedido de NF ao contador.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FISCAL_FIELDS.map(f => (
            <div key={f.key} className={`space-y-1 ${f.key === "fiscal_address" ? "sm:col-span-2" : ""}`}>
              <Label className="text-xs">{f.label}</Label>
              <Input value={(form[f.key] as string | null) ?? ""} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} autoComplete="off" />
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs">Próxima invoice (sequência própria)</Label>
            <Input type="number" min={1} value={form.next_invoice_seq} onChange={e => set("next_invoice_seq", parseInt(e.target.value) || 1)} />
            <p className="text-xs text-muted-foreground">Será usada na próxima invoice criada, com 4 dígitos (ex. 0102).</p>
          </div>
        </div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Banco intermediário (wire em moeda estrangeira)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INTERMEDIARY_FIELDS.map(f => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Input value={(form[f.key] as string | null) ?? ""} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} autoComplete="off" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t">
        <div>
          <p className="text-sm font-medium">Dados bancários para o invoice</p>
          <p className="text-xs text-muted-foreground">
            Impressos no bloco &quot;Payment details&quot; do PDF. Invoices em USD/EUR mostram os dados de wire; em BRL, a chave PIX. Campos vazios não aparecem.
          </p>
        </div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Internacional (wire)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BANK_FIELDS.filter(f => f.group === "wire").map(f => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Input
                value={(form[f.key] as string | null) ?? ""}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                autoComplete="off"
              />
            </div>
          ))}
        </div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Brasil (PIX)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BANK_FIELDS.filter(f => f.group === "pix").map(f => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Input
                value={(form[f.key] as string | null) ?? ""}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                autoComplete="off"
              />
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Salvar configurações
      </Button>
    </form>
  )
}
