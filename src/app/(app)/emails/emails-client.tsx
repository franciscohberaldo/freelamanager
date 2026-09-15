"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, formatDate } from "@/lib/utils"
import { AlertCircle, CheckCircle2, Inbox, Paperclip, Search } from "lucide-react"

export type EmailAttachment = {
  id: string
  filename: string | null
  content_type: string | null
  size: number | null
}

export type InboundEmail = {
  id: string
  nf_request_id: string | null
  invoice_id: string | null
  job_id: string | null
  from_email: string
  to_email: string | null
  subject: string | null
  body: string | null
  attachments: EmailAttachment[]
  filed: boolean
  note: string | null
  created_at: string
  jobs: { name: string } | null
  invoices: { seq_number: string | null; invoice_number: number } | null
}

type Filter = "all" | "filed" | "unmatched" | "attachments"

const FILTER_LABELS: Record<Filter, string> = {
  all: "Todos",
  filed: "NF arquivada",
  unmatched: "Sem vínculo",
  attachments: "Com anexo",
}

function formatSize(bytes: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return sameDay
    ? format(date, "HH:mm")
    : format(date, "dd/MM/yy 'às' HH:mm", { locale: ptBR })
}

export function EmailsClient({ emails }: { emails: InboundEmail[] }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(emails[0]?.id ?? null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return emails
      .filter(e => {
        if (filter === "filed") return e.filed
        if (filter === "unmatched") return !e.nf_request_id
        if (filter === "attachments") return e.attachments.length > 0
        return true
      })
      .filter(e =>
        !q ||
        e.subject?.toLowerCase().includes(q) ||
        e.from_email.toLowerCase().includes(q) ||
        e.body?.toLowerCase().includes(q)
      )
  }, [emails, filter, query])

  const selected = visible.find(e => e.id === selectedId) ?? visible[0] ?? null
  const filedCount = emails.filter(e => e.filed).length
  const unmatchedCount = emails.filter(e => !e.nf_request_id).length

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por assunto, remetente ou conteúdo..."
            className="pl-8"
          />
        </div>
        <Select value={filter} onValueChange={v => setFilter(v as Filter)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(FILTER_LABELS) as Filter[]).map(f => (
              <SelectItem key={f} value={f}>{FILTER_LABELS[f]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filedCount} com NF arquivada · {unmatchedCount} sem vínculo
        </span>
      </div>

      {emails.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 border rounded-md py-24 text-muted-foreground">
          <Inbox className="w-10 h-10" />
          <p className="text-sm">Nenhum e-mail recebido ainda.</p>
          <p className="text-xs max-w-sm text-center">
            Quando um e-mail chegar em nf@nf.chico.cx, ele aparece aqui — com ou sem vínculo a um pedido de NF.
          </p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 min-h-0">
          {/* List */}
          <div className="border rounded-md overflow-y-auto divide-y max-h-[70vh]">
            {visible.map(e => (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className={cn(
                  "w-full text-left p-3 space-y-1 hover:bg-accent/50 transition-colors",
                  selected?.id === e.id && "bg-accent"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate flex-1">{e.from_email}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatWhen(e.created_at)}</span>
                </div>
                <p className="text-sm truncate">{e.subject ?? "(sem assunto)"}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {e.filed && (
                    <Badge variant="success" className="text-[10px]">NF arquivada</Badge>
                  )}
                  {!e.nf_request_id && (
                    <Badge variant="outline" className="text-[10px]">Sem vínculo</Badge>
                  )}
                  {e.attachments.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Paperclip className="w-3 h-3" />
                      {e.attachments.length}
                    </span>
                  )}
                </div>
              </button>
            ))}
            {visible.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground text-center">
                Nenhum e-mail corresponde ao filtro.
              </p>
            )}
          </div>

          {/* Detail */}
          <div className="border rounded-md p-5 overflow-y-auto max-h-[70vh]">
            {!selected ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Selecione um e-mail para ler.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-light tracking-tight">
                    {selected.subject ?? "(sem assunto)"}
                  </h2>
                  <p className="text-sm">
                    <span className="text-muted-foreground">De:</span> {selected.from_email}
                  </p>
                  {selected.to_email && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Para:</span> {selected.to_email}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {formatDate(selected.created_at, "dd/MM/yyyy 'às' HH:mm")}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {selected.filed && (
                    <Badge variant="success">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      NF arquivada no job
                    </Badge>
                  )}
                  {selected.jobs && selected.job_id && (
                    <Link href={`/jobs/${selected.job_id}`}>
                      <Badge variant="default" className="cursor-pointer">
                        Job: {selected.jobs.name}
                      </Badge>
                    </Link>
                  )}
                  {selected.invoices && (
                    <Badge variant="outline">
                      Invoice {selected.invoices.seq_number ?? `#${selected.invoices.invoice_number}`}
                    </Badge>
                  )}
                </div>

                {selected.note && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                    <span>{selected.note}</span>
                  </div>
                )}

                {selected.attachments.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Anexos</p>
                    <ul className="text-sm space-y-1">
                      {selected.attachments.map((a, i) => (
                        <li key={a.id ?? i} className="flex items-center gap-2">
                          <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{a.filename ?? "anexo"}</span>
                          {a.size != null && (
                            <span className="text-xs text-muted-foreground">({formatSize(a.size)})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mensagem</p>
                  {selected.body ? (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{selected.body}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Sem conteúdo de texto.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
