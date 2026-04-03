"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import type { Job } from "@/lib/supabase/types"

const jobSchema = z.object({
  client_id:      z.string().min(1, "Selecione um cliente"),
  name:           z.string().min(1, "Nome obrigatório"),
  description:    z.string().optional(),
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

type JobForm = z.infer<typeof jobSchema>

interface Props {
  children: React.ReactNode
  clients: { id: string; name: string }[]
  job?: Job
  mode: "create" | "edit"
}

export function JobDialog({ children, clients, job, mode }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<JobForm>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      client_id:      job?.client_id ?? "",
      name:           job?.name ?? "",
      description:    job?.description ?? "",
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

  async function onSubmit(data: JobForm) {
    setLoading(true)
    const payload = {
      ...data,
      contract_value: data.contract_value || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
    }

    if (mode === "create") {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from("jobs").insert({ ...payload, user_id: user!.id })
      if (error) { toast.error("Erro ao criar job"); setLoading(false); return }
      toast.success("Job criado!")
    } else {
      const { error } = await supabase.from("jobs").update(payload).eq("id", job!.id)
      if (error) { toast.error("Erro ao atualizar job"); setLoading(false); return }
      toast.success("Job atualizado!")
    }

    setOpen(false)
    router.refresh()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo Job" : "Editar Job"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Cliente *</Label>
              <Select defaultValue={job?.client_id} onValueChange={(v) => setValue("client_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.client_id && <p className="text-xs text-destructive">{errors.client_id.message}</p>}
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Nome do job *</Label>
              <Input {...register("name")} placeholder="ex: Desenvolvimento Web" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Valor/hora</Label>
              <Input {...register("hourly_rate")} type="number" step="0.01" placeholder="0.00" />
            </div>

            <div className="space-y-2">
              <Label>Valor/dia</Label>
              <Input {...register("daily_rate")} type="number" step="0.01" placeholder="0.00" />
            </div>

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

            <div className="space-y-2">
              <Label>Data início</Label>
              <Input {...register("start_date")} type="date" />
            </div>

            <div className="space-y-2">
              <Label>Data fim</Label>
              <Input {...register("end_date")} type="date" />
            </div>

            <div className="space-y-2">
              <Label>Valor do contrato</Label>
              <Input {...register("contract_value")} type="number" step="0.01" placeholder="Total do contrato" />
            </div>

            <div className="space-y-2">
              <Label>Taxa de imposto (%)</Label>
              <Input {...register("tax_rate")} type="number" step="0.01" placeholder="0" />
            </div>

            <div className="flex items-center gap-3 col-span-2 py-2">
              <Switch
                id="recurring"
                defaultChecked={job?.is_recurring}
                onCheckedChange={(v) => setValue("is_recurring", v)}
              />
              <Label htmlFor="recurring">Job recorrente (renovação automática)</Label>
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Notas</Label>
              <Textarea {...register("notes")} placeholder="Observações sobre o job..." rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "create" ? "Criar Job" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
