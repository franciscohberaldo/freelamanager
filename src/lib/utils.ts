import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency: string = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value)
}

export function formatDate(date: string | Date, fmt: string = "dd/MM/yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return format(d, fmt, { locale: ptBR })
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return `${h}h`
  return `${h}h${m.toString().padStart(2, "0")}`
}

export function generateInvoiceNumber(sequence: number, year?: number): string {
  const y = year ?? new Date().getFullYear()
  return `${y}-${sequence.toString().padStart(3, "0")}`
}

export function calculateTotal(hoursBilled: number, hourlyRate: number): number {
  return Number((hoursBilled * hourlyRate).toFixed(2))
}

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
  }
}

export const CURRENCIES = ["BRL", "USD", "EUR"] as const
export const JOB_STATUSES = ["proposal", "active", "paused", "completed"] as const
export const EVENT_TYPES = ["payment", "delivery", "meeting", "milestone", "deadline"] as const

export const JOB_STATUS_LABELS: Record<string, string> = {
  proposal: "Proposta",
  active: "Ativo",
  paused: "Pausado",
  completed: "Encerrado",
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  payment: "Pagamento",
  delivery: "Entrega",
  meeting: "Reunião",
  milestone: "Marco",
  deadline: "Prazo",
}

export const EVENT_TYPE_COLORS: Record<string, string> = {
  payment: "#22c55e",
  delivery: "#3b82f6",
  meeting: "#a855f7",
  milestone: "#f59e0b",
  deadline: "#ef4444",
}
