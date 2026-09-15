export type NfRequestInput = {
  /** Whose studio is asking — it heads the subject, so the accountant sorts by sender. */
  companyName: string | null
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

/**
 * The name as people say it, not as the contract writes it: a subject line does not need
 * "Ltda" or "EIRELI" to be recognised.
 */
export function shortCompany(name: string | null): string | null {
  const short = (name ?? "")
    .replace(/[\s,.-]+(ltda|eireli|epp|mei|me|s\/?\.?a\.?|sa)\.?$/i, "")
    .trim()
  return short || null
}

const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
  MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
  PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
}

/**
 * The address the way a note prints it: the street on one line, the bairro on the next,
 * then the CEP, and last the city with its state and country. Stored addresses come from
 * the CNPJ lookup as one line joined by " - ", which is what gets taken apart here; one
 * typed by hand with line breaks is already in the right shape and is left alone.
 */
export function addressLines(address: string | null): string[] {
  const written = address?.trim()
  if (!written) return []
  if (written.includes("\n")) return written.split("\n").map(l => l.trim()).filter(Boolean)

  const parts = written.split(" - ").map(p => p.trim()).filter(Boolean)
  const last = parts[parts.length - 1]
  const cityUf = last?.match(/^(.+?)[/-]([A-Za-z]{2})$/)
  if (cityUf) {
    const [, city, uf] = cityUf
    parts[parts.length - 1] = [city.trim(), UF_NAMES[uf.toUpperCase()], uf.toUpperCase(), "Brasil"]
      .filter(Boolean).join(", ")
  }
  return parts
}

const dmy = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}` }

/**
 * The e-mail asking the accountant to issue the NF, in the shape the accountant already
 * reads: who the tomador is, what to charge and when, then the text that goes into the
 * note itself — description, PO and due date, which the NF has to carry.
 */
export function buildNfRequest(i: NfRequestInput): { subject: string; body: string } {
  const lines: string[] = []

  lines.push(i.legalName ?? i.clientName)
  lines.push(...addressLines(i.address))
  if (i.cnpj) lines.push(`CNPJ nº ${i.cnpj}`)
  // most tomadores of a service are exempt, and that is what the note must say
  lines.push(`IE: ${i.stateRegistration?.trim() || "Isenta"}`)

  lines.push("", `Valor: ${brl(i.amountBrl)}`)
  if (i.dueDate) lines.push(`Vencimento: ${dmy(i.dueDate)}`)

  // the due date is stated once, above; repeating it under Descrição only read as a slip
  lines.push("", "Descrição:", i.nfDescription?.trim() || "(preencher)")
  if (i.poNumber) lines.push(`"Número de PO: ${i.poNumber}"`)

  if (i.nfRules?.trim()) lines.push("", "Observações:", i.nfRules.trim())

  const company = shortCompany(i.companyName)
  const subject = company ? `[${company}] Emissão de Nota Fiscal` : "Emissão de Nota Fiscal"

  return { subject, body: lines.join("\n") }
}

export type BankDetails = {
  /** The account a Brazilian tomador pays into. */
  domestic: { beneficiary: string | null; bankName: string | null; agency: string | null; account: string | null; pixKey: string | null }
  /** The account abroad that receives the wire. */
  wire: {
    beneficiary: string | null; bankName: string | null; accountType: string | null
    account: string | null; routing: string | null; swift: string | null
    iban: string | null; address: string | null
  }
  /** The bank the wire passes through on its way there. */
  intermediary: { bankName: string | null; swift: string | null; aba: string | null; account: string | null; address: string | null }
  /** The bank that closes the exchange and credits the reais. */
  fx: { bankName: string | null; agency: string | null; account: string | null; swift: string | null }
}

const section = (title: string, pairs: [string, string | null | undefined][]) => {
  const lines = pairs.filter(([, v]) => v?.trim()).map(([k, v]) => `${k}: ${v!.trim()}`)
  return lines.length ? [title, ...lines] : []
}

/**
 * The account the note should print. A tomador in Brazil pays here and needs one block; a
 * foreign one wires abroad, so the note carries the receiving account, the intermediary it
 * passes through, and the bank that closes the exchange. Blocks with nothing filled in are
 * left out, and a request with no account at all gets none.
 */
export function buildBankBlock(b: BankDetails, { abroad }: { abroad: boolean }): string | null {
  const blocks = abroad
    ? [
        section("Dados bancários (recebimento no exterior):", [
          ["Beneficiário", b.wire.beneficiary],
          ["Banco", b.wire.bankName],
          ["Tipo de conta", b.wire.accountType],
          ["Conta", b.wire.account],
          ["Routing / ABA", b.wire.routing],
          ["SWIFT / BIC", b.wire.swift],
          ["IBAN", b.wire.iban],
          ["Endereço do banco", b.wire.address],
        ]),
        section("Banco intermediário:", [
          ["Banco", b.intermediary.bankName],
          ["SWIFT", b.intermediary.swift],
          ["ABA / routing", b.intermediary.aba],
          ["Conta", b.intermediary.account],
          ["Endereço", b.intermediary.address],
        ]),
        section("Banco de recebimento de câmbio:", [
          ["Banco", b.fx.bankName],
          ["Agência", b.fx.agency],
          ["Conta", b.fx.account],
          ["SWIFT", b.fx.swift],
        ]),
      ]
    : [
        section("Dados bancários:", [
          ["Beneficiário", b.domestic.beneficiary],
          ["Banco", b.domestic.bankName],
          ["Agência", b.domestic.agency],
          ["Conta", b.domestic.account],
          ["PIX", b.domestic.pixKey],
        ]),
      ]

  const written = blocks.filter(lines => lines.length).map(lines => lines.join("\n"))
  return written.length ? written.join("\n\n") : null
}
