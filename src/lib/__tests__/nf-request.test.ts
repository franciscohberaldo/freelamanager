import { describe, it, expect } from "vitest"
import { buildNfRequest } from "@/lib/nf-request"

const base = {
  seqNumber: "0102", clientName: "Lobo", legalName: "Videographica Serviços e Participações Ltda",
  cnpj: "61.372.843/0001-03", address: "Rua Joaquim Floriano, 913 8º andar - Itaim Bibi, 04534-013 São Paulo SP",
  nfDescription: "Serviços prestados de animação", amountBrl: 19200, dueDate: "2025-04-25",
  nfRules: "Não mencionar nomes de jobs.", accountantName: "Ronaldo",
  provider: { legalName: "Estúdio Judite Ltda", cnpj: "11.241.505/0001-64", bankName: "Banco Inter", bankAgency: "0001", bankAccount: "24188764-0", pixKey: null },
  invoicePdfUrl: "https://app/api/invoices/pdf?id=abc",
}

describe("buildNfRequest", () => {
  it("subject carries seq and client", () => {
    expect(buildNfRequest(base).subject).toBe("Pedido de NF — Invoice 0102 — Lobo")
  })
  it("body has tomador, description, value, due date, bank and rules", () => {
    const { body } = buildNfRequest(base)
    expect(body).toContain("Videographica Serviços e Participações Ltda")
    expect(body).toContain("CNPJ: 61.372.843/0001-03")
    expect(body).toContain("Descrição: Serviços prestados de animação")
    expect(body).toContain("Valor: R$ 19.200,00")
    expect(body).toContain("Vencimento: 25/04/2025")
    expect(body).toContain("Banco: Banco Inter")
    expect(body).toContain("Não mencionar nomes de jobs.")
    expect(body).toContain("https://app/api/invoices/pdf?id=abc")
    expect(body.startsWith("Olá Ronaldo,")).toBe(true)
  })
  it("falls back gracefully when optional fields are missing", () => {
    const { body } = buildNfRequest({ ...base, legalName: null, cnpj: null, address: null, dueDate: null, nfRules: null, accountantName: null, invoicePdfUrl: null, nfDescription: null })
    expect(body.startsWith("Olá,")).toBe(true)
    expect(body).toContain("Tomador: Lobo")
    expect(body).toContain("Descrição: (preencher)")
    expect(body).not.toContain("Vencimento:")
  })
})
