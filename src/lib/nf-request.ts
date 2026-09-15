export type NfRequestInput = {
  clientName: string
  legalName: string | null
  /** Printed as it is stored, line breaks and all, so it reads like an address. */
  address: string | null
  cnpj: string | null
  stateRegistration: string | null
  nfDescription: string | null
  poNumber: string | null
  amountBrl: number
  dueDate: string | null
  nfRules: string | null
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v).replace(/\u00a0/g, " ")

const dmy = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}` }

/**
 * The e-mail asking the accountant to issue the NF, in the shape the accountant already
 * reads: who the tomador is, what to charge and when, then the text that goes into the
 * note itself — description, PO and due date, which the NF has to carry.
 */
export function buildNfRequest(i: NfRequestInput): { subject: string; body: string } {
  const lines: string[] = []

  lines.push(i.legalName ?? i.clientName)
  if (i.address) lines.push(i.address)
  if (i.cnpj) lines.push(`CNPJ nº ${i.cnpj}`)
  // most tomadores of a service are exempt, and that is what the note must say
  lines.push(`IE: ${i.stateRegistration?.trim() || "Isenta"}`)

  lines.push("", `Valor: ${brl(i.amountBrl)}`)
  if (i.dueDate) lines.push(`Vencimento: ${dmy(i.dueDate)}`)

  // the due date is stated once, above; repeating it under Descrição only read as a slip
  lines.push("", "Descrição:", i.nfDescription?.trim() || "(preencher)")
  if (i.poNumber) lines.push(`"Número de PO: ${i.poNumber}"`)

  if (i.nfRules?.trim()) lines.push("", "Observações:", i.nfRules.trim())

  return { subject: "Emissão de NF", body: lines.join("\n") }
}

export type BankDetails = {
  beneficiary: string | null
  bankName: string | null
  /** Agência, kept under the routing field the international invoice already uses. */
  agency: string | null
  account: string | null
  accountType: string | null
  pixKey: string | null
}

/**
 * The block that goes into the note when the client pays by transfer. Optional: many NFs
 * carry no account at all, so the sender decides per request.
 */
export function buildBankBlock(b: BankDetails): string | null {
  const lines: string[] = []
  if (b.beneficiary) lines.push(`Beneficiário: ${b.beneficiary}`)
  if (b.bankName) lines.push(`Banco: ${b.bankName}`)
  if (b.agency) lines.push(`Agência: ${b.agency}`)
  if (b.account) lines.push(`Conta${b.accountType ? ` (${b.accountType})` : ""}: ${b.account}`)
  if (b.pixKey) lines.push(`PIX: ${b.pixKey}`)
  if (!lines.length) return null
  return ["Dados bancários:", ...lines].join("\n")
}
