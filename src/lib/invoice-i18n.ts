export type InvoiceLang = "pt" | "en"
export type BillingUnit = "hour" | "day"

/** Intl locale and date-fns pattern per invoice language */
export const invoiceLocale: Record<InvoiceLang, { intl: string; dateFormat: string }> = {
  pt: { intl: "pt-BR", dateFormat: "dd/MM/yyyy" },
  en: { intl: "en-US", dateFormat: "MM/dd/yyyy" },
}

export const invoiceT = {
  pt: {
    invoice:       "INVOICE",
    date:          "Data",
    period:        "Período",
    dueDate:       "Vencimento",
    to:            "Para",
    service:       "Serviço",
    project:       "Projeto",
    rate:          "Taxa",
    hour:          "hora",
    day:           "dia",
    tableDate:     "Data",
    tableBilled:   "Horas faturadas",
    tableBilledDays: "Dias faturados",
    tableRate:     "Taxa/h",
    tableRateDay:  "Taxa/dia",
    tableSubtotal: "Subtotal",
    subtotal:      "Subtotal",
    taxes:         "Impostos",
    total:         "TOTAL",
    notes:         "Notas",
    paymentDetails: "Dados para pagamento",
    beneficiary:   "Beneficiário",
    bankName:      "Banco",
    accountType:   "Tipo de conta",
    accountNumber: "Conta",
    routing:       "Routing / ABA",
    swift:         "SWIFT / BIC",
    iban:          "IBAN",
    bankAddress:   "Endereço do banco",
    pixKey:        "Chave PIX",
    greeting:      (name: string) => `Olá, ${name},`,
    body:          (start: string, end: string, job: string) =>
      `Segue o invoice referente ao período de ${start} a ${end} pelo serviço <strong>${job}</strong>.`,
    subject:       (num: string, job: string) => `Invoice #${num} — ${job}`,
    emailDate:     "Data",
    emailHours:    "Horas",
    emailDays:     "Dias",
    emailRate:     "Taxa/h",
    emailRateDay:  "Taxa/dia",
  },
  en: {
    invoice:       "INVOICE",
    date:          "Date",
    period:        "Period",
    dueDate:       "Due Date",
    to:            "Bill To",
    service:       "Service",
    project:       "Project",
    rate:          "Rate",
    hour:          "hour",
    day:           "day",
    tableDate:     "Date",
    tableBilled:   "Billed Hours",
    tableBilledDays: "Billed Days",
    tableRate:     "Rate/h",
    tableRateDay:  "Rate/day",
    tableSubtotal: "Subtotal",
    subtotal:      "Subtotal",
    taxes:         "Taxes",
    total:         "TOTAL",
    notes:         "Notes",
    paymentDetails: "Payment details",
    beneficiary:   "Beneficiary Name",
    bankName:      "Bank Name",
    accountType:   "Account Type",
    accountNumber: "Account #",
    routing:       "Routing #",
    swift:         "SWIFT / BIC",
    iban:          "IBAN",
    bankAddress:   "Bank Address",
    pixKey:        "PIX Key",
    greeting:      (name: string) => `Hi ${name},`,
    body:          (start: string, end: string, job: string) =>
      `Please find the invoice for the period from ${start} to ${end} for service <strong>${job}</strong>.`,
    subject:       (num: string, job: string) => `Invoice #${num} — ${job}`,
    emailDate:     "Date",
    emailHours:    "Hours",
    emailDays:     "Days",
    emailRate:     "Rate/h",
    emailRateDay:  "Rate/day",
  },
} as const

export function formatInvoiceCurrency(value: number, currency: string, lang: InvoiceLang): string {
  return new Intl.NumberFormat(invoiceLocale[lang]?.intl ?? "pt-BR", { style: "currency", currency }).format(value)
}

/** Quantity label for a line item: "8h" or "1 day" / "1,5 dia" */
export function formatQuantity(quantity: number, unit: BillingUnit, lang: InvoiceLang): string {
  if (unit === "day") {
    const n = new Intl.NumberFormat(invoiceLocale[lang].intl, { maximumFractionDigits: 2 }).format(quantity)
    return `${n} ${lang === "en" ? (quantity === 1 ? "day" : "days") : (quantity === 1 ? "dia" : "dias")}`
  }
  return `${quantity}h`
}

/** Hours ↔ days conversion used when a job bills by the day */
export const HOURS_PER_DAY = 8
