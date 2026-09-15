import { describe, it, expect } from "vitest"
import { buildNfRequest, buildBankBlock } from "@/lib/nf-request"

const base = {
  clientName: "R/GA",
  legalName: "R/GA Media Group Publicidade Ltda",
  address: "Av. Manuel Bandeira, 360\nCEP: 05317-020 – Vila Leopoldina – São Paulo",
  cnpj: "39.937.180/0001-78",
  stateRegistration: null,
  nfDescription: "Serviços de Motion Design",
  poNumber: "3001630",
  amountBrl: 15000,
  dueDate: "2026-05-30",
  nfRules: null,
}

describe("buildNfRequest", () => {
  it("is the e-mail the accountant already reads", () => {
    const { subject, body } = buildNfRequest(base)
    expect(subject).toBe("Emissão de NF")
    expect(body).toBe([
      "R/GA Media Group Publicidade Ltda",
      "Av. Manuel Bandeira, 360",
      "CEP: 05317-020 – Vila Leopoldina – São Paulo",
      "CNPJ nº 39.937.180/0001-78",
      "IE: Isenta",
      "",
      "Valor: R$ 15.000,00",
      "Vencimento: 30/05/2026",
      "",
      "Descrição:",
      "Serviços de Motion Design",
      `"Número de PO: 3001630"`,
    ].join("\n"))
  })

  it("prints the state registration when the tomador has one", () => {
    expect(buildNfRequest({ ...base, stateRegistration: "123.456.789.000" }).body)
      .toContain("IE: 123.456.789.000")
  })

  it("adds the client's rules at the end", () => {
    expect(buildNfRequest({ ...base, nfRules: "Não mencionar nomes de jobs." }).body)
      .toContain("Observações:\nNão mencionar nomes de jobs.")
  })

  it("states the due date once", () => {
    expect(buildNfRequest(base).body.match(/encimento/g) ?? []).toHaveLength(1)
  })

  it("leaves out what the job has not filled in", () => {
    const { body } = buildNfRequest({
      ...base, legalName: null, address: null, cnpj: null, poNumber: null,
      dueDate: null, nfDescription: null,
    })
    expect(body.startsWith("R/GA\nIE: Isenta")).toBe(true)
    expect(body).toContain("Descrição:\n(preencher)")
    expect(body).not.toContain("Vencimento")
    expect(body).not.toContain("PO")
  })
})

const bank = {
  domestic: { beneficiary: "Estúdio Judite Ltda", bankName: "Banco Inter", agency: "0001", account: "24188764-0", pixKey: "11241505000164" },
  wire: {
    beneficiary: "Francisco H. Beraldo", bankName: "Nomad", accountType: "Checking",
    account: "8912345678", routing: "084009519", swift: "TRWIUS35", iban: null,
    address: "108 W 13th St, Wilmington, DE",
  },
  intermediary: { bankName: "JP Morgan Chase N.A.", swift: "CHASUS33", aba: "021000021", account: "360556937", address: "270 Park Avenue, New York" },
  fx: { bankName: "Banco Inter", agency: "0001", account: "24188764-0", swift: "BINTBRSP" },
}

describe("buildBankBlock", () => {
  it("gives a tomador in Brazil the account here, and nothing else", () => {
    const block = buildBankBlock(bank, { abroad: false })
    expect(block).toBe([
      "Dados bancários:",
      "Beneficiário: Estúdio Judite Ltda",
      "Banco: Banco Inter",
      "Agência: 0001",
      "Conta: 24188764-0",
      "PIX: 11241505000164",
    ].join("\n"))
    expect(block).not.toContain("intermediário")
  })

  it("gives a tomador abroad the wire, the intermediary and the exchange bank", () => {
    const block = buildBankBlock(bank, { abroad: true })!
    expect(block).toContain("Dados bancários (recebimento no exterior):")
    expect(block).toContain("SWIFT / BIC: TRWIUS35")
    expect(block).toContain("Banco intermediário:")
    expect(block).toContain("ABA / routing: 021000021")
    expect(block).toContain("Banco de recebimento de câmbio:")
    expect(block).toContain("SWIFT: BINTBRSP")
    expect(block).not.toContain("PIX")
  })

  it("leaves out a block nobody filled in", () => {
    const noIntermediary = {
      ...bank,
      intermediary: { bankName: null, swift: null, aba: null, account: null, address: null },
    }
    expect(buildBankBlock(noIntermediary, { abroad: true })).not.toContain("Banco intermediário")
  })

  it("is nothing at all when no account is registered", () => {
    const empty = {
      domestic: { beneficiary: null, bankName: null, agency: null, account: null, pixKey: null },
      wire: { beneficiary: null, bankName: null, accountType: null, account: null, routing: null, swift: null, iban: null, address: null },
      intermediary: { bankName: null, swift: null, aba: null, account: null, address: null },
      fx: { bankName: null, agency: null, account: null, swift: null },
    }
    expect(buildBankBlock(empty, { abroad: false })).toBeNull()
    expect(buildBankBlock(empty, { abroad: true })).toBeNull()
  })
})
