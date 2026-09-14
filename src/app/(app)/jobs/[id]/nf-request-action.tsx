"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NfRequestDialog } from "../../invoices/nf-request-dialog"
import { Send } from "lucide-react"

/** An invoice of this job that the accountant can still be asked about. */
export type NfCandidate = { id: string; label: string }

/**
 * The NF is asked for one invoice — it needs the amount and the due date — so this sits in
 * the job's "Email pro contador" slot and points at the invoices waiting for one.
 */
export function NfRequestAction({
  candidates, hasInvoices,
}: {
  candidates: NfCandidate[]
  hasInvoices: boolean
}) {
  const [openFor, setOpenFor] = useState<string | null>(null)

  if (candidates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {hasInvoices
          ? "A NF destas invoices já foi pedida ou emitida."
          : "O pedido sai de uma invoice — crie uma para pedir a NF."}
      </p>
    )
  }

  const dialog = openFor && (
    <NfRequestDialog invoiceId={openFor} open onClose={() => setOpenFor(null)} />
  )

  if (candidates.length === 1) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setOpenFor(candidates[0].id)}>
          <Send className="w-3 h-3" />
          Pedir NF ao contador
        </Button>
        {dialog}
      </>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Send className="w-3 h-3" />
            Pedir NF ao contador
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
      {dialog}
    </>
  )
}
