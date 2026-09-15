"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn, formatDate } from "@/lib/utils"
import { AlertCircle, CheckCircle2, FileCheck, Inbox, Loader2, Paperclip, Search, Send, X } from "lucide-react"

export type EmailAttachment = {
  id: string
  filename: string | null
  content_type: string | null
  size: number | null
  url?: string | null
}

/** An attachment with bytes behind it opens in a new tab; one without stays a label. */
function AttachmentItem({ a, action }: { a: EmailAttachment; action?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      {a.url ? (
        <a href={a.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
          {a.filename ?? "anexo"}
        </a>
      ) : (
        <span className="truncate">{a.filename ?? "anexo"}</span>
      )}
      {a.size != null && (
        <span className="text-xs text-muted-foreground shrink-0">({formatSize(a.size)})</span>
      )}
      {action}
    </li>
  )
}

const isPdfAttachment = (a: EmailAttachment) =>
  a.content_type === "application/pdf" || !!a.filename?.toLowerCase().endsWith(".pdf")

/** Pick the job an unmatched PDF belongs to, and it becomes that job's filed NF. */
function FileAsNfDialog({ email, attachment, jobs, open, onClose, onFiled }: {
  email: InboundEmail
  attachment: EmailAttachment | null
  jobs: { id: string; name: string }[]
  open: boolean
  onClose: () => void
  onFiled: () => void
}) {
  const [jobId, setJobId] = useState("")
  const [filing, setFiling] = useState(false)

  async function fileNf() {
    if (!attachment || !jobId || filing) return
    setFiling(true)
    try {
      const res = await fetch("/api/inbound/nf/file-attachment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: email.id, attachmentId: attachment.id, jobId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? "Não consegui arquivar a NF")
        return
      }
      toast.success("NF arquivada no job")
      setJobId("")
      onClose()
      onFiled()
    } catch {
      toast.error("Falha de rede ao arquivar a NF")
    } finally {
      setFiling(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arquivar como NF</DialogTitle>
          <DialogDescription>
            {attachment?.filename ?? "O anexo"} será guardado como a NF emitida do job escolhido.
          </DialogDescription>
        </DialogHeader>
        <Select value={jobId} onValueChange={setJobId}>
          <SelectTrigger><SelectValue placeholder="Escolha o job" /></SelectTrigger>
          <SelectContent>
            {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={fileNf} disabled={!jobId || filing}>
            {filing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
            {filing ? "Arquivando..." : "Arquivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
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
  direction: "in" | "out"
  in_reply_to: string | null
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

function ReplyBox({ email, onSent }: { email: InboundEmail; onSent: () => void }) {
  const [body, setBody] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  function addFiles(list: FileList | null) {
    if (!list) return
    setFiles(prev => {
      const next = [...prev]
      for (const f of Array.from(list)) {
        if (!next.some(x => x.name === f.name && x.size === f.size)) next.push(f)
      }
      return next
    })
  }

  const canSend = (body.trim().length > 0 || files.length > 0) && !sending

  async function send() {
    if (!canSend) return
    setSending(true)
    try {
      const form = new FormData()
      form.set("id", email.id)
      form.set("body", body)
      for (const f of files) form.append("files", f)
      const res = await fetch("/api/inbound/nf/reply", { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? "Não consegui enviar a resposta")
        return
      }
      toast.success(`Resposta enviada para ${email.from_email}`)
      setBody("")
      setFiles([])
      onSent()
    } catch {
      toast.error("Falha de rede ao enviar a resposta")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-2 border-t pt-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Responder para {email.from_email}
      </p>
      <Textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Escreva sua resposta..."
        rows={4}
        disabled={sending}
      />
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm rounded-md border px-2.5 py-1.5">
              <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{f.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{formatSize(f.size)}</span>
              <button
                onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label={`Remover ${f.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2">
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = "" }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInput.current?.click()}
          disabled={sending}
        >
          <Paperclip className="w-4 h-4" />
          Anexar
        </Button>
        <Button onClick={send} disabled={!canSend} size="sm">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Enviando..." : "Enviar resposta"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Sai de nf@nf.chico.cx e a conversa continua nesta thread. Anexos até 25 MB no total.
      </p>
    </div>
  )
}

export function EmailsClient({ emails, jobs }: { emails: InboundEmail[]; jobs: { id: string; name: string }[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const received = useMemo(() => emails.filter(e => e.direction === "in"), [emails])
  const [selectedId, setSelectedId] = useState<string | null>(received[0]?.id ?? null)
  const [filing, setFiling] = useState<EmailAttachment | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return received
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
  }, [received, filter, query])

  const selected = visible.find(e => e.id === selectedId) ?? visible[0] ?? null
  const thread = useMemo(
    () => selected
      ? emails
          .filter(e => e.direction === "out" && e.in_reply_to === selected.id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
      : [],
    [emails, selected],
  )
  const filedCount = received.filter(e => e.filed).length
  const unmatchedCount = received.filter(e => !e.nf_request_id).length

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

      {received.length === 0 ? (
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
                        <AttachmentItem
                          key={a.id ?? i}
                          a={a}
                          action={!selected.filed && isPdfAttachment(a) && a.url ? (
                            <button
                              onClick={() => setFiling(a)}
                              className="shrink-0 text-xs font-medium text-primary hover:underline ml-1"
                            >
                              Arquivar como NF
                            </button>
                          ) : undefined}
                        />
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

                {thread.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Respostas enviadas
                    </p>
                    {thread.map(r => (
                      <div key={r.id} className="rounded-md border bg-muted/30 p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Você · {formatDate(r.created_at, "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                        {r.body && (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.body}</p>
                        )}
                        {r.attachments.length > 0 && (
                          <ul className="text-sm space-y-0.5">
                            {r.attachments.map((a, i) => <AttachmentItem key={a.id ?? i} a={a} />)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <ReplyBox email={selected} onSent={() => router.refresh()} />

                <FileAsNfDialog
                  email={selected}
                  attachment={filing}
                  jobs={jobs}
                  open={filing !== null}
                  onClose={() => setFiling(null)}
                  onFiled={() => router.refresh()}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
