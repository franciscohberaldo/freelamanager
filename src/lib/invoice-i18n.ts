export type InvoiceLang = "pt" | "en"
export type BillingUnit = "hour" | "day" | "project"

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
    tableBilledProject: "Quantidade",
    tableRateProject: "Valor",
    emailProject:  "Qtd",
    emailRateProject: "Valor",
    projectUnit:   "projeto",
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
    purchaseOrder: "Ordem de compra",
    billTo:        "Cobrar de",
    cnpj:          "CNPJ",
    paymentInstructions: "Instruções de pagamento",
    intermediaryBank: "Banco intermediário (Field 56)",
    destinationBank:  "Banco de destino (Field 57)",
    beneficiaryField: "Beneficiário (Field 59)",
    recipientInfo: "Dados do prestador",
    serviceOrdered: "SERVIÇO PRESTADO",
    streetAddress:  "Endereço",
    tel:            "Tel",
    wireOnly:       "Somente transferência internacional",
    pixOnly:        "Pagamento por PIX ou transferência",
    beneficiaryBank: "Banco do beneficiário",
    beneficiaryInBrazil: "Beneficiário no Brasil",
    account:         "Conta",
    additionalInfo:  "Informações adicionais",
    tableDescription: "Descrição",
    tableQty:      "Qtd",
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
    tableBilledProject: "Quantity",
    tableRateProject: "Amount",
    emailProject:  "Qty",
    emailRateProject: "Amount",
    projectUnit:   "project",
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
    purchaseOrder: "Purchase order",
    billTo:        "Billed to",
    cnpj:          "Tax ID (CNPJ)",
    paymentInstructions: "Payment instructions",
    intermediaryBank: "Intermediary bank (Field 56)",
    destinationBank:  "Destination bank (Field 57)",
    beneficiaryField: "Beneficiary (Field 59)",
    recipientInfo: "Recipient info",
    serviceOrdered: "SERVICE ORDERED",
    streetAddress:  "Street address",
    tel:            "Tel",
    wireOnly:       "Wire transfer only",
    pixOnly:        "Payment by PIX or transfer",
    beneficiaryBank: "Beneficiary bank",
    beneficiaryInBrazil: "Beneficiary in Brazil",
    account:         "Account",
    additionalInfo:  "Additional information",
    tableDescription: "Description",
    tableQty:      "Qty",
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
  // A closed price prints as the thing bought, not as a measure of time.
  if (unit === "project") {
    const one = quantity === 1
    return `${quantity} ${lang === "en" ? (one ? "project" : "projects") : (one ? "projeto" : "projetos")}`
  }
  if (unit === "day") {
    const n = new Intl.NumberFormat(invoiceLocale[lang].intl, { maximumFractionDigits: 2 }).format(quantity)
    return `${n} ${lang === "en" ? (quantity === 1 ? "day" : "days") : (quantity === 1 ? "dia" : "dias")}`
  }
  return `${quantity}h`
}

/** Hours ↔ days conversion used when a job bills by the day */
export const HOURS_PER_DAY = 8
