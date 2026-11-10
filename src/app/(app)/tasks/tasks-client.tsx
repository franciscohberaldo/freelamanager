"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, CircleDollarSign, ListTodo, Plus } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { AgendaEvent } from "@/lib/supabase/types"
import { TableView } from "../agenda/table-view"
import { TaskDialog } from "../agenda/task-dialog"
import type { AgendaJob } from "../agenda/agenda-client"

export interface PendingReceipt {
  id: string
  invoice_number: string
  seq_number: string | null
  status: string
  total: number
  currency: string
  due_date: string
  jobs: { name: string; clients: { name: string } | null } | null
}

type Task = AgendaEvent & { jobs: { name: string } | null }

interface Props {
  events: Task[]
  jobs: AgendaJob[]
  receipts: PendingReceipt[]
}

export function TasksClient({ events, jobs, receipts }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="px-8 py-6 space-y-8">
      <PageHeader
        title="Tasks"
        description={`${events.length} ${events.length === 1 ? "tarefa em aberto" : "tarefas em aberto"}`}
        actions={
          <TaskDialog jobs={jobs} open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button size="lg">
              <Plus className="w-4 h-4" />
              Nova tarefa
            </Button>
          </TaskDialog>
        }
      />

      <section aria-labelledby="receipts-title" className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="receipts-title" className="text-lg font-semibold tracking-tight">Recebimentos em aberto</h2>
            <p className="text-sm text-muted-foreground">Invoices enviadas que ainda não foram pagas.</p>
          </div>
          <Badge variant={receipts.length > 0 ? "warning" : "secondary"}>{receipts.length}</Badge>
        </div>

        {receipts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <CircleDollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhum recebimento pendente.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {receipts.map(receipt => (
              <Link key={receipt.id} href="/invoices" className="block group">
                <Card className="transition-colors group-hover:border-primary/40 group-hover:bg-accent/30">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 shrink-0">
                      <CircleDollarSign className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">Receber invoice {receipt.seq_number ?? `#${receipt.invoice_number}`}</span>
                        <Badge variant={receipt.status === "overdue" ? "destructive" : "warning"}>
                          {receipt.status === "overdue" ? "Vencida" : "Enviada"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {receipt.jobs?.name ?? "Sem job"}{receipt.jobs?.clients?.name ? ` · ${receipt.jobs.clients.name}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Vencimento em {formatDate(receipt.due_date)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold tabular-nums">{formatCurrency(receipt.total, receipt.currency)}</p>
                      <span className="inline-flex items-center gap-1 text-xs text-primary mt-1">
                        Abrir invoice <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="open-tasks-title" className="space-y-3">
        <div className="flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-muted-foreground" />
          <h2 id="open-tasks-title" className="text-lg font-semibold tracking-tight">Tarefas em aberto</h2>
        </div>
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <TableView events={events} jobs={jobs} onNew={() => setDialogOpen(true)} showCompleted={false} />
        </div>
      </section>
    </div>
  )
}
