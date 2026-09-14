import { describe, it, expect } from "vitest"
import { buildNfRequest } from "@/lib/nf-request"

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
      "Data de vencimento: 30/05/2026",
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
