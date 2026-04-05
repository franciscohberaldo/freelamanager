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
}

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

      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Salvar configurações
      </Button>
    </form>
  )
}
