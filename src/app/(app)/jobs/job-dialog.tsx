"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { JobForm } from "./job-form"
import type { Job } from "@/lib/supabase/types"

interface Props {
  children: React.ReactNode
  clients: { id: string; name: string }[]
  job?: Job
  mode: "create" | "edit"
}

/**
 * The quick path for creating a job. Editing lives on /jobs/[id], where the same
 * JobForm gets the full width it needs.
 */
export function JobDialog({ children, clients, job, mode }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo Job" : "Editar Job"}</DialogTitle>
        </DialogHeader>
        <JobForm
          clients={clients}
          job={job}
          mode={mode}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
