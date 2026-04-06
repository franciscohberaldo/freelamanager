"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function ExportButton() {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch("/api/export")
      if (!res.ok) { toast.error("Erro ao exportar dados"); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      const date = new Date().toISOString().slice(0, 10)
      a.href     = url
      a.download = `freela-manager-backup-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Backup exportado com sucesso!")
    } catch {
      toast.error("Erro ao exportar dados")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        O arquivo JSON conterá: clientes, jobs, logs diários, invoices, despesas, metas, projetos, eventos e diário.
      </p>
      <Button variant="outline" onClick={handleExport} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Exportar backup completo
      </Button>
    </div>
  )
}
