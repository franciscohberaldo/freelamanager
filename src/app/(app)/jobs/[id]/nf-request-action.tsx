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
 * The button in the job's "Email pro contador" slot. The request is normally about an
 * invoice, which carries the amount and the due date; when no invoice of this job is
 * waiting on its NF, it is made from the job — its closed price and its end date.
 */
export function NfRequestAction({
  jobId, candidates,
}: {
  jobId: string
  candidates: NfCandidate[]
}) {
  const [openFor, setOpenFor] = useState<string | null>(null)
  const [fromJob, setFromJob] = useState(false)

  const dialog = (openFor || fromJob) && (
    <NfRequestDialog
      invoiceId={openFor ?? undefined}
      jobId={fromJob ? jobId : undefined}
      open
      onClose={() => { setOpenFor(null); setFromJob(false) }}
    />
  )

  // With no invoice waiting on its NF, the job answers for the amount and the date itself.
  if (candidates.length <= 1) {
    const single = candidates[0]
    return (
      <>
        <Button
          variant="outline" size="sm"
          onClick={() => single ? setOpenFor(single.id) : setFromJob(true)}
        >
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
