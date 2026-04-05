/**
 * Downloads an array of objects as a CSV file.
 * Adds UTF-8 BOM so Excel opens accented characters correctly.
 */
export function downloadCsv(
  data: Record<string, unknown>[],
  filename: string,
  columns?: { key: string; label: string }[]
) {
  if (!data.length) return

  const keys   = columns ? columns.map(c => c.key)   : Object.keys(data[0])
  const labels = columns ? columns.map(c => c.label) : keys

  const escape = (v: unknown): string => {
    const s = v == null ? "" : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  const rows = data.map(row => keys.map(k => escape(row[k])).join(","))
  const csv  = [labels.join(","), ...rows].join("\r\n")

  const BOM  = "\uFEFF"
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Round hours to nearest step (0.25, 0.5, 1) or no-op if "none" */
export function roundHours(hours: number, rounding: string): number {
  if (rounding === "none" || !rounding) return hours
  const step = parseFloat(rounding)
  if (!step) return hours
  return Math.round(hours / step) * step
}
