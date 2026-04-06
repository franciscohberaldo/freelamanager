export const WEBHOOK_EVENTS = [
  "invoice.created",
  "invoice.paid",
  "invoice.overdue",
  "client.created",
  "job.created",
  "log.created",
  "expense.created",
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]
