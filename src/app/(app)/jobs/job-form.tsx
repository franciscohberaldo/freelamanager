"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { validateThumbnail, thumbnailPath, pathFromPublicUrl, THUMBNAIL_BUCKET } from "@/lib/job-thumbnail"
import { normalizeName } from "@/lib/text-case"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Combobox } from "@/components/ui/combobox"
import { FieldHint } from "@/components/field-hint"
import { Loader2, Image as ImageIcon, MoreHorizontal, Trash2, Upload } from "lucide-react"
import type { Job } from "@/lib/supabase/types"
import { COMMON_TIMEZONES, workHoursInLocal } from "@/lib/timezone"
import { BILLING_MODES, BILLING_MODE_LABELS, type BillingMode } from "@/lib/billing-mode"
import { missingDays, logForDay } from "@/lib/job-days"

const jobSchema = z.object({
  client_id:      z.string().min(1, "Selecione um cliente"),
  name:           z.string().min(1, "Nome obrigatório"),
  description:    z.string().optional(),
  billing_mode:   z.enum(BILLING_MODES),
  project_code:   z.string().optional(),
  end_client:     z.string().optional(),
  intermediary:   z.string().optional(),
  nf_description: z.string().optional(),
  po_number:      z.string().optional(),
  timezone:       z.string().optional(),
  work_hours:     z.string().optional(),
  is_confidential: z.boolean(),
  hourly_rate:    z.coerce.number().min(0),
  daily_rate:     z.coerce.number().min(0),
  currency:       z.enum(["BRL", "USD", "EUR"]),
  status:         z.enum(["proposal", "active", "paused", "completed"]),
  contract_value: z.coerce.number().optional(),
  start_date:     z.string().optional(),
  end_date:       z.string().optional(),
  is_recurring:   z.boolean(),
  tax_rate:       z.coerce.number().min(0).max(100),
  notes:          z.string().optional(),
})

type JobFormValues = z.infer<typeof jobSchema>

interface Props {
  clients: { id: string; name: string }[]
  job?: Job
  mode: "create" | "edit"
  /** Called with the saved job's id, so a dialog can close and a page can route. */
  onSaved?: (jobId: string) => void
  /** Renders a Cancelar button when given; the page edition leaves it out. */
  onCancel?: () => void
}

export function JobForm({ clients, job, mode, onSaved, onCancel }: Props) {
  const [loading, setLoading] = useState(false)
  const [thumbnail, setThumbnail] = useState<string | null>(job?.thumbnail_url ?? null)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      client_id:      job?.client_id ?? "",
      name:           job?.name ?? "",
      description:    job?.description ?? "",
      billing_mode:   job?.billing_mode ?? "hourly",
      project_code:   job?.project_code ?? "",
      end_client:     job?.end_client ?? "",
      intermediary:   job?.intermediary ?? "",
      nf_description: job?.nf_description ?? "",
      po_number:      job?.po_number ?? "",
      timezone:       job?.timezone ?? "",
      work_hours:     job?.work_hours ?? "",
      is_confidential: job?.is_confidential ?? false,
      hourly_rate:    job?.hourly_rate ?? 0,
      daily_rate:     job?.daily_rate ?? 0,
      currency:       (job?.currency as "BRL" | "USD" | "EUR") ?? "BRL",
      status:         (job?.status as "proposal" | "active" | "paused" | "completed") ?? "active",
      contract_value: job?.contract_value ?? undefined,
      start_date:     job?.start_date ?? "",
      end_date:       job?.end_date ?? "",
      is_recurring:   job?.is_recurring ?? false,
      tax_rate:       job?.tax_rate ?? 0,
      notes:          job?.notes ?? "",
    },
  })

  const billingMode = watch("billing_mode")
  const tzValue     = watch("timezone")
  const workHours   = watch("work_hours")
  const localHours  = workHoursInLocal(workHours, tzValue)

  async function onPickThumbnail(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""                       // let the same file be picked again after a failure
    if (!file) return
    const check = validateThumbnail(file)
    if (!check.ok) { toast.error(check.error); return }

    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const path = thumbnailPath(user!.id, file.name, crypto.randomUUID())
    const { error } = await supabase.storage.from(THUMBNAIL_BUCKET).upload(path, file, { upsert: false })
    if (error) { toast.error("Erro ao enviar a imagem"); setUploading(false); return }

    const previous = pathFromPublicUrl(thumbnail)
    const { data: pub } = supabase.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path)
    setThumbnail(pub.publicUrl)
    if (previous) await supabase.storage.from(THUMBNAIL_BUCKET).remove([previous])
    setUploading(false)
  }

  async function onRemoveThumbnail() {
    const previous = pathFromPublicUrl(thumbnail)
    setThumbnail(null)
    if (previous) await supabase.storage.from(THUMBNAIL_BUCKET).remove([previous])
  }

  async function onSubmit(data: JobFormValues) {
    setLoading(true)
    const payload = {
      ...data,
      name: normalizeName(data.name.trim()),
      project_code: data.project_code?.trim() || null,
      end_client:     data.end_client?.trim() || null,
      intermediary:   data.intermediary?.trim() || null,
      nf_description: data.nf_description?.trim() || null,
      po_number:      data.po_number?.trim() || null,
      timezone: data.timezone || null,
      work_hours: data.work_hours?.trim() || null,
      contract_value: data.contract_value || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      thumbnail_url: thumbnail,
    }

    let savedId = job?.id
    if (mode === "create") {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: created, error } = await supabase
        .from("jobs")
        .insert({ ...payload, user_id: user!.id })
        .select("id")
        .single()
      if (error || !created) { toast.error("Erro ao criar job"); setLoading(false); return }
      savedId = created.id
      toast.success("Job criado!")
    } else {
      const { error } = await supabase.from("jobs").update(payload).eq("id", job!.id)
      if (error) { toast.error("Erro ao atualizar job"); setLoading(false); return }
      toast.success("Job atualizado!")
    }

    // A job with a start and an end was worked on those days: give it one diária per
    // weekday, but only while it has none, so days removed by hand are not put back.
    if (savedId && payload.start_date && payload.end_date) {
      const { data: { user } } = await supabase.auth.getUser()
      const { count } = await supabase.from("daily_logs").select("*", { count: "exact", head: true }).eq("job_id", savedId)
      if ((count ?? 0) === 0) {
        const span = { id: savedId, billing_mode: payload.billing_mode, hourly_rate: payload.hourly_rate, daily_rate: payload.daily_rate, start_date: payload.start_date, end_date: payload.end_date }
        const dates = missingDays(span, [])
        if (dates.length > 0) {
          const { error } = await supabase.from("daily_logs").insert(dates.map(d => logForDay(span, d, user!.id)))
          if (error) toast.error(`Job salvo, mas as diárias do período não foram criadas: ${error.message}`)
          else toast.success(`${dates.length} ${dates.length === 1 ? "diária criada" : "diárias criadas"} para o período`)
        }
      }
    }

    router.refresh()
    setLoading(false)
    onSaved?.(savedId!)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* ── Identificação ─────────────────────────────────────────────────────── */}
      <Group title="Identificação" hint="Quem contratou e como o trabalho se chama.">
        <div className="space-y-2">
          <Label>Cliente *</Label>
          <Combobox
            options={clients.map(c => ({ value: c.id, label: c.name }))}
            value={watch("client_id")}
            onChange={(v) => setValue("client_id", v, { shouldValidate: true })}
            placeholder="Selecione um cliente"
            searchPlaceholder="Buscar cliente…"
          />
          {errors.client_id && <p className="text-xs text-destructive">{errors.client_id.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Nome do job *</Label>
          <Input {...register("name")} placeholder="ex: Desenvolvimento Web" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Marca (cliente final)</Label>
          <Input {...register("end_client")} placeholder="ex: Mastercard" />
        </div>

        <div className="space-y-2">
          <Label>Código do projeto</Label>
          <Input {...register("project_code")} placeholder="ex: Deltek, nº do projeto" />
        </div>

        <div className="space-y-2">
          <Label>Nº da PO (padrão)</Label>
          <Input {...register("po_number")} placeholder="ex: 4702134214" />
        </div>

        <div className="space-y-2">
          <Label>Thumbnail do projeto</Label>
          <div className="relative w-24 h-16 rounded-lg border bg-muted/40 overflow-hidden shrink-0 flex items-center justify-center">
            {thumbnail
              // storage URLs are user-supplied, so plain img keeps next/image config out of it
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={thumbnail} alt="" className="w-full h-full object-cover" />
              : <ImageIcon className="w-5 h-5 text-muted-foreground/50" />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={uploading}
                  title="Opções da thumbnail"
                  className="absolute top-1 right-1 rounded-full bg-background/80 border p-1 text-muted-foreground hover:text-foreground"
                >
                  {uploading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <MoreHorizontal className="w-3.5 h-3.5" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <label className="flex items-center gap-2 cursor-pointer w-full">
                    <Upload className="w-3.5 h-3.5" />
                    Enviar imagem
                    <input type="file" accept="image/*" className="hidden" onChange={onPickThumbnail} disabled={uploading} />
                  </label>
                </DropdownMenuItem>
                {thumbnail && (
                  <DropdownMenuItem onClick={onRemoveThumbnail} className="flex items-center gap-2 text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Group>

      {/* ── Cobrança ──────────────────────────────────────────────────────────── */}
      <Group title="Cobrança" hint="Como este job vira dinheiro.">
        <div className="space-y-2">
          <Label>Tipo de contratação</Label>
          <Select defaultValue={job?.billing_mode ?? "hourly"} onValueChange={(v) => setValue("billing_mode", v as BillingMode)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {BILLING_MODES.map(m => (
                <SelectItem key={m} value={m}>{BILLING_MODE_LABELS[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {billingMode === "hourly" && (
          <div className="space-y-2">
            <Label>Valor/hora *</Label>
            <Input {...register("hourly_rate")} type="number" step="0.01" placeholder="0.00" />
          </div>
        )}

        {billingMode === "daily" && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">Valor/dia * <FieldHint>Registros e invoices são calculados em dias (1 dia = 8h).</FieldHint></Label>
            <Input {...register("daily_rate")} type="number" step="0.01" placeholder="0.00" />
          </div>
        )}

        {billingMode === "fixed" && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">Valor do contrato * <FieldHint>Preço fechado. Os dias trabalhados saem listados na invoice; o valor fica na linha do projeto.</FieldHint></Label>
            <Input {...register("contract_value")} type="number" step="0.01" placeholder="Total do contrato" />
          </div>
        )}

        <div className="space-y-2">
          <Label>Moeda</Label>
          <Select defaultValue={job?.currency ?? "BRL"} onValueChange={(v) => setValue("currency", v as "BRL" | "USD" | "EUR")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="BRL">BRL (R$)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Taxa de imposto (%)</Label>
          <Input {...register("tax_rate")} type="number" step="0.01" placeholder="0" />
        </div>
      </Group>

      {/* ── Prazo e disponibilidade ───────────────────────────────────────────── */}
      <Group title="Prazo e disponibilidade" hint="Quando acontece e em que horário o cliente trabalha.">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select defaultValue={job?.status ?? "active"} onValueChange={(v) => setValue("status", v as "proposal" | "active" | "paused" | "completed")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="proposal">Proposta</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="paused">Pausado</SelectItem>
              <SelectItem value="completed">Encerrado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Data início</Label>
            <Input {...register("start_date")} type="date" />
          </div>
          <div className="space-y-2">
            <Label>Data fim</Label>
            <Input {...register("end_date")} type="date" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Fuso horário do cliente</Label>
          <Select defaultValue={job?.timezone ?? "none"} onValueChange={(v) => setValue("timezone", v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Não informado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não informado</SelectItem>
              {COMMON_TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Horário de trabalho (no fuso do cliente)</Label>
          <Input {...register("work_hours")} placeholder="ex: 09:00-18:00" />
          {localHours && (
            <p className="text-xs text-muted-foreground">
              Hoje em Brasília: <span className="font-medium text-foreground">{localHours.localLabel}</span>
              {localHours.nextDay ? " (vira o dia)" : ""} · diferença {localHours.diffHours > 0 ? "+" : ""}{localHours.diffHours}h
            </p>
          )}
        </div>
      </Group>

      {/* ── Nota fiscal e notas ───────────────────────────────────────────────── */}
      <Group title="Nota fiscal e notas" hint="O que vai para o contador e o que é só seu." single>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">Descrição fiscal (texto da NF) <FieldHint>Vai no pedido de NF ao contador. Sem inglês, sem nome de job.</FieldHint></Label>
          <Input {...register("nf_description")} placeholder="ex: Serviços prestados de animação" />
        </div>

        <div className="space-y-2">
          <Label>Notas</Label>
          <Textarea {...register("notes")} placeholder="Observações sobre o job..." rows={3} />
        </div>
      </Group>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === "create" ? "Criar Job" : "Salvar"}
        </Button>
      </div>
    </form>
  )
}

/** One card per subject, so a form of twenty fields reads as four short ones. */
function Group({ title, hint, single, children }: { title: string; hint?: string; single?: boolean; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border bg-card p-5">
      <legend className="sr-only">{title}</legend>
      <div className="mb-4">
        <p className="font-semibold">{title}</p>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div className={single ? "space-y-4" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>
        {children}
      </div>
    </fieldset>
  )
}
