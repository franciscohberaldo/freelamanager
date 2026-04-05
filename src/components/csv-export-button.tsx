"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { downloadCsv } from "@/lib/csv"

interface Column { key: string; label: string }

interface Props {
  data: Record<string, unknown>[]
  filename: string
  columns?: Column[]
  label?: string
  size?: "sm" | "default"
}

export function CsvExportButton({ data, filename, columns, label = "CSV", size = "sm" }: Props) {
  return (
    <Button
      variant="outline"
      size={size}
      className="gap-2"
      onClick={() => downloadCsv(data, filename, columns)}
      disabled={!data.length}
    >
      <Download className="w-4 h-4" />
      {label}
    </Button>
  )
}
