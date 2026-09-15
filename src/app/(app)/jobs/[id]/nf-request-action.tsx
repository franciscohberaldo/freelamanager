"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { NfRequestDialog } from "../../invoices/nf-request-dialog"
import { formatDate } from "@/lib/utils"
import { Check, Mail, Send, TriangleAlert } from "lucide-react"

/** An invoice of this job that the accountant can still be asked about. */
export type NfCandidate = { id: string; label: string }

/** A request that already went out, kept word for word as it was sent. */
export type SentRequest = {
  id: string
  created_at: string
  sent_to: string
  subject: string
  body: string
  status: string
  error: string | null
}

const sentAt = (iso: string) =>
  `${formatDate(iso)} às ${new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`

/**
 * The job's "Email pro contador" slot: what was asked and when, and the button to ask.
 * The request is normally about an invoice, which carries the amount and the due date;
 * when no invoice of this job is waiting on its NF, it is made from the job itself.
 */
export function NfRequestAction({
  jobId, candidates, sent,
}: {
  jobId: string
  candidates: NfCandidate[]
  sent: SentRequest[]
}) {
  const [openFor, setOpenFor] = useState<string | null>(null)
  const [fromJob, setFromJob] = useState(false)
  const [reading, setReading] = useState<SentRequest | null>(null)

  const composer = (openFor || fromJob) && (
    <NfRequestDialog
      invoiceId={openFor ?? undefined}
      jobId={fromJob ? jobId : undefined}
      open
      onClose={() => { setOpenFor(null); setFromJob(false) }}
    />
  )

  const reader = reading && (
    <Dialog open onOpenChange={v => !v && setReading(null)}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reading.subject}</DialogTitle>
          <DialogDescription>
            Para {reading.sent_to} · {sentAt(reading.created_at)}
            {reading.status === "failed" && " · falhou"}
          </DialogDescription>
        </DialogHeader>
        {reading.error && (
          <p className="text-xs text-destructive">{reading.error}</p>
        )}
        <pre className="text-xs font-mono whitespace-pre-wrap rounded-md border bg-muted/30 p-3">
          {reading.body}
        </pre>
      </DialogContent>
    </Dialog>
  )

  const history = sent.length > 0 && (
    <div className="space-y-1.5">
      {sent.map(r => (
        <div key={r.id} className="flex items-start gap-2 text-xs">
          {r.status === "failed"
            ? <TriangleAlert className="w-3.5 h-3.5 shrink-0 text-destructive mt-px" />
            : <Check className="w-3.5 h-3.5 shrink-0 text-green-600 dark:text-green-500 mt-px" />}
          <div className="min-w-0">
            <p className={r.status === "failed" ? "text-destructive" : ""}>
              {r.status === "failed" ? "Falhou em " : "Enviado em "}
              {sentAt(r.created_at)}
            </p>
            <p className="text-muted-foreground truncate">para {r.sent_to}</p>
          </div>
          <button
            type="button"
            onClick={() => setReading(r)}
            className="ml-auto shrink-0 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
          >
            <Mail className="w-3 h-3" />
            ver e-mail
          </button>
        </div>
      ))}
    </div>
  )

  // With no invoice waiting on its NF, the job answers for the amount and the date itself.
  const button = candidates.length <= 1 ? (
    <Button
      variant="outline" size="sm"
      onClick={() => candidates[0] ? setOpenFor(candidates[0].id) : setFromJob(true)}
    >
      <Send className="w-3 h-3" />
      {sent.length ? "Pedir de novo" : "Pedir NF ao contador"}
    </Button>
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Send className="w-3 h-3" />
          {sent.length ? "Pedir de novo" : "Pedir NF ao contador"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {candidates.map(c => (
          <DropdownMenuItem key={c.id} onClick={() => setOpenFor(c.id)}>
            Invoice {c.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="space-y-3">
      {history}
      {button}
      {composer}
      {reader}
    </div>
  )
}
