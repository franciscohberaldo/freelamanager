"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, Trash2 } from "lucide-react"
import {
  validateThumbnail, thumbnailPath, pathFromPublicUrl, THUMBNAIL_BUCKET,
} from "@/lib/job-thumbnail"

export interface CompanySettings {
  company_name: string | null
  cnpj_cpf: string | null
  logo_url: string | null
  invoice_color: string
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
  br_bank_name: string | null
  br_bank_agency: string | null
  br_bank_account: string | null
  fx_bank_name: string | null
  fx_bank_agency: string | null
  fx_bank_account: string | null
  fx_bank_swift: string | null
}

type Field = { key: keyof CompanySettings; label: string; placeholder: string; wide?: boolean }

/** The account a tomador in Brazil pays into — what a national NF prints. */
const BR_FIELDS: Field[] = [
  { key: "br_bank_name",    label: "Banco",     placeholder: "Banco Inter" },
  { key: "br_bank_agency",  label: "Agência",   placeholder: "0001" },
  { key: "br_bank_account", label: "Conta",     placeholder: "24188764-0" },
  { key: "pix_key",         label: "Chave PIX", placeholder: "CPF, e-mail, telefone ou aleatória" },
]

/** The account abroad that receives the wire. */
const WIRE_FIELDS: Field[] = [
  { key: "bank_beneficiary",    label: "Beneficiário (nome na conta)", placeholder: "Francisco H. Beraldo" },
  { key: "bank_name",           label: "Banco",                        placeholder: "Banco Inter / Wise / Nomad" },
  { key: "bank_account_type",   label: "Tipo de conta",                placeholder: "Checking" },
  { key: "bank_account_number", label: "Número da conta",              placeholder: "Account #" },
  { key: "bank_routing",        label: "Routing / ABA",                placeholder: "Routing #" },
  { key: "bank_swift",          label: "SWIFT / BIC",                  placeholder: "Opcional" },
  { key: "bank_iban",           label: "IBAN",                         placeholder: "Opcional" },
  { key: "bank_address",        label: "Endereço do banco",            placeholder: "Opcional", wide: true },
]

/** The bank the wire passes through on its way there. */
const INTERMEDIARY_FIELDS: Field[] = [
  { key: "intermediary_bank_name",    label: "Banco intermediário",       placeholder: "JP Morgan Chase N.A." },
  { key: "intermediary_bank_swift",   label: "SWIFT do intermediário",    placeholder: "CHASUS33" },
  { key: "intermediary_bank_aba",     label: "ABA / routing",             placeholder: "021000021" },
  { key: "intermediary_bank_account", label: "Conta no intermediário",    placeholder: "360556937" },
  { key: "intermediary_bank_address", label: "Endereço do intermediário", placeholder: "270 Park Avenue, New York", wide: true },
]

/** The bank that closes the exchange and credits the reais. */
const FX_FIELDS: Field[] = [
  { key: "fx_bank_name",    label: "Banco de câmbio", placeholder: "Banco Inter" },
  { key: "fx_bank_agency",  label: "Agência",         placeholder: "0001" },
  { key: "fx_bank_account", label: "Conta",           placeholder: "24188764-0" },
  { key: "fx_bank_swift",   label: "SWIFT",           placeholder: "BINTBRSP" },
]

const FISCAL_FIELDS: Field[] = [
  { key: "legal_name",             label: "Razão social",              placeholder: "Estúdio Judite Ltda" },
  { key: "municipal_registration", label: "Inscrição municipal (CCM)", placeholder: "64377270" },
  { key: "fiscal_address",         label: "Endereço fiscal",           placeholder: "Rua, número, bairro, cidade, UF, CEP", wide: true },
  { key: "accountant_name",        label: "Contador (nome)",           placeholder: "Nome do contador" },
  { key: "accountant_email",       label: "Contador (e-mail)",         placeholder: "contador@escritorio.com.br" },
]

const TEXT_FIELDS = [...BR_FIELDS, ...WIRE_FIELDS, ...INTERMEDIARY_FIELDS, ...FX_FIELDS, ...FISCAL_FIELDS]

const PRESET_COLORS = [
  { label: "Azul",     value: "#1e40af" },
  { label: "Violeta",  value: "#7c3aed" },
  { label: "Verde",    value: "#16a34a" },
  { label: "Vermelho", value: "#dc2626" },
  { label: "Laranja",  value: "#ea580c" },
  { label: "Cinza",    value: "#374151" },
]

const asForm = (initial: CompanySettings | null): CompanySettings => ({
  company_name:  initial?.company_name  ?? "",
  cnpj_cpf:      initial?.cnpj_cpf      ?? "",
  logo_url:      initial?.logo_url      ?? "",
  invoice_color: initial?.invoice_color ?? "#1e40af",
  next_invoice_seq: initial?.next_invoice_seq ?? 102,
  ...Object.fromEntries(TEXT_FIELDS.map(f => [f.key, (initial?.[f.key] as string | null) ?? ""])),
} as CompanySettings)

export function CompanyForm({ initialSettings }: { initialSettings: CompanySettings | null }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const saved = useMemo(() => asForm(initialSettings), [initialSettings])
  const [form, setForm] = useState<CompanySettings>(saved)

  // What the save bar watches: anything typed that the server has not been told about.
  const dirty = useMemo(
    () => (Object.keys(saved) as (keyof CompanySettings)[])
      .some(k => String(form[k] ?? "") !== String(saved[k] ?? "")),
    [form, saved],
  )

  function set<K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  /** The logo goes to the public bucket the job thumbnails already use, under your own id. */
  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""                       // let the same file be picked again after a failure
    if (!file) return
    const check = validateThumbnail(file)
    if (!check.ok) { toast.error(check.error); return }

    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const path = thumbnailPath(user!.id, file.name, `logo-${crypto.randomUUID()}`)
    const { error } = await supabase.storage.from(THUMBNAIL_BUCKET).upload(path, file, { upsert: false })
    if (error) { toast.error("Erro ao enviar o logo"); setUploading(false); return }

    const previous = pathFromPublicUrl(form.logo_url)
    const { data: pub } = supabase.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path)
    set("logo_url", pub.publicUrl)
    if (previous) await supabase.storage.from(THUMBNAIL_BUCKET).remove([previous])
    setUploading(false)
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
      next_invoice_seq: Math.max(1, Number(form.next_invoice_seq) || 102),
      ...Object.fromEntries(TEXT_FIELDS.map(f => [f.key, (form[f.key] as string | null)?.trim() || null])),
    }, { onConflict: "user_id" })

    setLoading(false)
    if (error) { toast.error("Erro ao salvar configurações"); return }
    toast.success("Configurações salvas!")
    // The saved copy this form compares against lives in the server component above it.
    window.location.reload()
  }

  const text = (f: Field) => (
    <div key={f.key} className={`space-y-1 ${f.wide ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={f.key} className="text-xs">{f.label}</Label>
      <Input
        id={f.key}
        value={(form[f.key] as string | null) ?? ""}
        onChange={e => set(f.key, e.target.value)}
        placeholder={f.placeholder}
        autoComplete="off"
      />
    </div>
  )

  const group = (title: string, hint: string, fields: Field[]) => (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{fields.map(text)}</div>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card id="empresa" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-base">Empresa</CardTitle>
          <CardDescription>Como você aparece no PDF da invoice.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="company_name" className="text-xs">Nome da empresa / freelancer</Label>
              <Input
                id="company_name"
                value={form.company_name ?? ""}
                onChange={e => set("company_name", e.target.value)}
                placeholder="Ex: Estudio Judite"
              />
              <p className="text-xs text-muted-foreground">Encabeça o assunto do pedido de NF.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cnpj_cpf" className="text-xs">CNPJ / CPF</Label>
              <Input
                id="cnpj_cpf"
                value={form.cnpj_cpf ?? ""}
                onChange={e => set("cnpj_cpf", e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Logo</Label>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-28 h-14 rounded border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                {form.logo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={form.logo_url} alt="" className="max-h-full max-w-full object-contain" />
                  : <span className="text-xs text-muted-foreground">sem logo</span>}
              </div>
              <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                <label className="cursor-pointer">
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {form.logo_url ? "Trocar" : "Enviar imagem"}
                  <input type="file" className="hidden" accept="image/*" disabled={uploading} onChange={onPickLogo} />
                </label>
              </Button>
              {form.logo_url && (
                <Button
                  type="button" variant="ghost" size="sm"
                  onClick={() => set("logo_url", "")}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                  Remover
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG ou JPG até 5 MB. Aparece no topo do PDF.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Cor do invoice</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  aria-label={`Cor ${c.label}`}
                  aria-pressed={form.invoice_color === c.value}
                  onClick={() => set("invoice_color", c.value)}
                  className={[
                    "w-8 h-8 rounded-full border-2 transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    form.invoice_color === c.value
                      ? "border-foreground scale-110 shadow-md"
                      : "border-transparent hover:scale-105",
                  ].join(" ")}
                  style={{ background: c.value }}
                />
              ))}
              {/* The native picker stays, invisible over a swatch that shows its focus ring. */}
              <div className="relative w-8 h-8">
                <input
                  type="color"
                  aria-label="Cor personalizada"
                  value={form.invoice_color}
                  onChange={e => set("invoice_color", e.target.value)}
                  className="peer absolute inset-0 w-8 h-8 rounded-full opacity-0 cursor-pointer"
                />
                <div
                  aria-hidden
                  className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center text-muted-foreground text-xs pointer-events-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
                >+</div>
              </div>
              <span className="text-xs text-muted-foreground font-mono ml-1">{form.invoice_color}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="fiscal" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-base">Fiscal e contador</CardTitle>
          <CardDescription>Usados no PDF da invoice e no pedido de NF ao contador.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FISCAL_FIELDS.map(text)}
            <div className="space-y-1">
              <Label htmlFor="next_invoice_seq" className="text-xs">Próxima invoice (sequência própria)</Label>
              <Input
                id="next_invoice_seq"
                type="number" min={1}
                value={form.next_invoice_seq}
                onChange={e => set("next_invoice_seq", parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">Usada na próxima invoice, com 4 dígitos (ex. 0102).</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="bancos" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-base">Bancos</CardTitle>
          <CardDescription>
            A NF de um tomador no Brasil imprime a conta daqui; a de um tomador no exterior imprime
            o recebimento lá fora, o intermediário e o câmbio. Campo vazio não aparece.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {group("Recebimento no Brasil", "A conta que um cliente brasileiro paga, e o PIX do PDF.", BR_FIELDS)}
          <div className="pt-5 border-t space-y-6">
            {group("Recebimento no exterior (wire)", "A conta que recebe a transferência em dólar ou euro.", WIRE_FIELDS)}
            {group("Banco intermediário", "Por onde o wire passa antes de chegar.", INTERMEDIARY_FIELDS)}
            {group("Recebimento de câmbio", "Onde o câmbio é fechado e os reais entram.", FX_FIELDS)}
          </div>
        </CardContent>
      </Card>

      {/* Follows you down the page: the bank fields sit a long way from any button. */}
      {dirty && (
        <div className="sticky bottom-4 z-20 px-4 py-3 rounded-md border bg-background/95 backdrop-blur shadow-lg flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">Alterações não salvas</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setForm(saved)}>
              Descartar
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </form>
  )
}
