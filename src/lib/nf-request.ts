export type NfRequestInput = {
  seqNumber: string
  clientName: string
  legalName: string | null
  cnpj: string | null
  address: string | null
  nfDescription: string | null
  amountBrl: number
  dueDate: string | null
  nfRules: string | null
  accountantName: string | null
  provider: {
    legalName: string | null
    cnpj: string | null
    bankName: string | null
    bankAgency?: string | null
    bankAccount: string | null
    pixKey: string | null
  }
  invoicePdfUrl: string | null
}

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v).replace(/\u00a0/g, " ")
const dmy = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}` }

/** Plain-text e-mail asking the accountant to issue the NF for one invoice. */
export function buildNfRequest(i: NfRequestInput): { subject: string; body: string } {
  const subject = `Pedido de NF — Invoice ${i.seqNumber} — ${i.clientName}`
  const lines: string[] = []
  lines.push(i.accountantName ? `Olá ${i.accountantName},` : "Olá,")
  lines.push("", `Por favor, emitir a nota fiscal referente à invoice ${i.seqNumber}.`, "")
  lines.push("TOMADOR")
  lines.push(`Tomador: ${i.legalName ?? i.clientName}`)
  if (i.cnpj) lines.push(`CNPJ: ${i.cnpj}`)
  if (i.address) lines.push(`Endereço: ${i.address}`)
  lines.push("", "SERVIÇO")
  lines.push(`Descrição: ${i.nfDescription ?? "(preencher)"}`)
  lines.push(`Valor: ${brl(i.amountBrl)}`)
  if (i.dueDate) lines.push(`Vencimento: ${dmy(i.dueDate)}`)
  lines.push("", "DADOS BANCÁRIOS DO PRESTADOR (para constar na NF)")
  if (i.provider.legalName) lines.push(`Empresa: ${i.provider.legalName}`)
  if (i.provider.cnpj) lines.push(`CNPJ: ${i.provider.cnpj}`)
  if (i.provider.bankName) lines.push(`Banco: ${i.provider.bankName}`)
  if (i.provider.bankAgency) lines.push(`Agência: ${i.provider.bankAgency}`)
  if (i.provider.bankAccount) lines.push(`Conta: ${i.provider.bankAccount}`)
  if (i.provider.pixKey) lines.push(`PIX: ${i.provider.pixKey}`)
  if (i.nfRules) lines.push("", "REGRAS DO CLIENTE", i.nfRules)
  if (i.invoicePdfUrl) lines.push("", `Invoice (PDF): ${i.invoicePdfUrl}`)
  lines.push("", "Obrigado!")
  return { subject, body: lines.join("\n") }
}
