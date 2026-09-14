import { describe, it, expect } from "vitest"
import {
  ACCOUNTING_KINDS, ACCOUNTING_LABELS, ACCOUNTING_SHORT_LABELS, ACCOUNTING_HINTS,
  isAccountingKind, kindFromName, competenciaFromName, formatCompetencia,
  accountingPath, previousMonth,
} from "@/lib/accounting-documents"

describe("ACCOUNTING_KINDS", () => {
  it("lists the eight kinds", () => {
    expect(ACCOUNTING_KINDS).toEqual([
      "das_guide", "das_payment", "fee_receipt", "fee_payment",
      "tfe", "dasn_guide", "dasn_payment", "statement",
    ])
  })

  it("describes every kind", () => {
    for (const kind of ACCOUNTING_KINDS) {
      expect(ACCOUNTING_LABELS[kind]).toBeTruthy()
      expect(ACCOUNTING_SHORT_LABELS[kind].length).toBeLessThanOrEqual(10)
      expect(ACCOUNTING_HINTS[kind]).toBeTruthy()
    }
  })

  it("accepts its own kinds and nothing else", () => {
    expect(isAccountingKind("das_guide")).toBe(true)
    expect(isAccountingKind("nf")).toBe(false)
  })
})

describe("previousMonth", () => {
  it("steps back one month", () => {
    expect(previousMonth("2022-09")).toBe("2022-08")
  })

  it("crosses the year boundary", () => {
    expect(previousMonth("2023-01")).toBe("2022-12")
  })
})

describe("kindFromName", () => {
  it("reads a DAS guide", () => {
    expect(kindFromName("DAS 11.2025.pdf")).toBe("das_guide")
    expect(kindFromName("DAS 12.2022 - RECALCULADO.pdf")).toBe("das_guide")
  })

  it("reads a DAS payment", () => {
    expect(kindFromName("2207_DAS_Pagamento.jpg")).toBe("das_payment")
    expect(kindFromName("Pagamento DAS.jpg")).toBe("das_payment")
    expect(kindFromName("1610_161212_Pagamento Das.pdf")).toBe("das_payment")
    expect(kindFromName("191216_Simples_Pagamento_Nov2019.pdf")).toBe("das_payment")
  })

  it("tells a DAS payment from a DAS guide", () => {
    expect(kindFromName("250430_DAS_Pagamento.pdf")).toBe("das_payment")
    expect(kindFromName("DAS 03.2024 - RECALCULADO 1.pdf")).toBe("das_guide")
  })

  it("reads the accountant's receipt and its payment", () => {
    expect(kindFromName("RECIBO HONORARIO REF. MES 11.2025.pdf")).toBe("fee_receipt")
    expect(kindFromName("220221_Honorarios_ref_2201_Guia.pdf")).toBe("fee_receipt")
    expect(kindFromName("210305_RPS_2101_HonorarioGuia.pdf")).toBe("fee_receipt")
    expect(kindFromName("2207_Honorarios_Pagamento.jpg")).toBe("fee_payment")
    expect(kindFromName("pagamento honorario.jpg")).toBe("fee_payment")
    expect(kindFromName("210305_RPS_2101_HonorarioPagto.pdf")).toBe("fee_payment")
    expect(kindFromName("2024_06_Contador_Pagamento.pdf")).toBe("fee_payment")
    expect(kindFromName("260120_GuiaPagamento_Contador_2025_12.pdf")).toBe("fee_payment")
  })

  it("reads TFE, DASN and statements", () => {
    expect(kindFromName("20200120_TFE_Judite_176,93.pdf")).toBe("tfe")
    expect(kindFromName("210325_DASN_202101_Guia.pdf")).toBe("dasn_guide")
    expect(kindFromName("210325_DASN_202101_Pagto.pdf")).toBe("dasn_payment")
    expect(kindFromName("Extrato-01-11-2025-a-01-12-2025-PDF.pdf")).toBe("statement")
    expect(kindFromName("NU_628160500_01JAN2022_31JAN2022.pdf")).toBe("statement")
    expect(kindFromName("EstudioJudite-Extrato-2026-01-Janeiro.pdf")).toBe("statement")
    expect(kindFromName("extrato-202204011351.pdf")).toBe("statement")
  })

  it("says nothing about a file it does not recognise", () => {
    expect(kindFromName("Assinatura.png")).toBe(null)
    expect(kindFromName("1666034905811.jpg")).toBe(null)
    expect(kindFromName("NF073_170213_Cinemalink_Vivo.pdf")).toBe(null)
  })
})

describe("competenciaFromName", () => {
  const at = (file: string, folder = "") => competenciaFromName(file, folder)

  it("reads MM.AAAA, the way the accountant names a guide", () => {
    expect(at("DAS 11.2025.pdf")).toEqual({ competencia: "2025-11", scope: "month", from: "nome" })
    expect(at("RECIBO HONORARIO REF. MES 02.2022.pdf")!.competencia).toBe("2022-02")
    expect(at("DAS 12.2022 - RECALCULADO.pdf")!.competencia).toBe("2022-12")
  })

  it("reads an AAMM prefix", () => {
    expect(at("2207_DAS_Pagamento.jpg")!.competencia).toBe("2022-07")
  })

  it("prefers an explicit ref over the date the file was made", () => {
    expect(at("220221_Honorarios_ref_2201_Guia.pdf")!.competencia).toBe("2022-01")
    expect(at("210305_RPS_2101_HonorarioGuia.pdf")!.competencia).toBe("2021-01")
  })

  it("reads a month written out", () => {
    expect(at("191216_Simples_Pagamento_Nov2019.pdf")!.competencia).toBe("2019-11")
    expect(at("191226_Simples_Pagamento_Set2019.pdf")!.competencia).toBe("2019-09")
    expect(at("EstudioJudite-Extrato-2026-01-Janeiro.pdf")!.competencia).toBe("2026-01")
  })

  it("reads AAAA_MM and AAAA-MM", () => {
    expect(at("260120_GuiaPagamento_Contador_2025_12.pdf")!.competencia).toBe("2025-12")
    expect(at("2024_06_DAS_Pagamento.pdf")!.competencia).toBe("2024-06")
  })

  it("reads the period a statement covers", () => {
    expect(at("NU_628160500_01JAN2022_31JAN2022.pdf")!.competencia).toBe("2022-01")
    expect(at("Extrato-01-11-2025-a-01-12-2025-PDF.pdf")!.competencia).toBe("2025-11")
  })

  it("treats DASN as a year", () => {
    expect(at("210325_DASN_202101_Guia.pdf")).toEqual({ competencia: "2021-01", scope: "year", from: "nome" })
  })

  // The user's rule: the folder is the month it was paid, so the work is the month before.
  it("falls back to the folder, minus one month", () => {
    expect(at("Pagamento DAS.jpg", "MaterialCliente/2022/09_Setembro"))
      .toEqual({ competencia: "2022-08", scope: "month", from: "pasta" })
    expect(at("pagamento honorario.jpg", "MaterialCliente/2022/09_Setembro")!.competencia).toBe("2022-08")
  })

  it("crosses the year when falling back from January", () => {
    expect(at("Pagamento DAS.jpg", "MaterialCliente/2023/01_Janeiro")!.competencia).toBe("2022-12")
  })

  it("lets the name win over the folder", () => {
    expect(at("DAS 02.2022.pdf", "MaterialCliente/2022/03_Marco"))
      .toEqual({ competencia: "2022-02", scope: "month", from: "nome" })
  })

  it("reads the folder's own AAAA_MM shape", () => {
    expect(at("qualquer.pdf", "MaterialCliente/2025/2025_12")!.competencia).toBe("2025-11")
  })

  // Files that sit loose in a year folder carry only the date they were handled. Same
  // rule as the folder: the work is the month before.
  it("falls back to the date the file carries, minus one month", () => {
    expect(at("201019_contador pagamento.pdf", "MaterialCliente/2020"))
      .toEqual({ competencia: "2020-09", scope: "month", from: "data do arquivo" })
    expect(at("20191121_contador_guia.pdf", "MaterialCliente/2020")!.competencia).toBe("2019-10")
    expect(at("200331 guia DAS pagamento.pdf", "MaterialCliente/2020")!.competencia).toBe("2020-02")
    expect(at("extrato-202003311119.pdf", "MaterialCliente/2020")!.competencia).toBe("2020-02")
  })

  // "_0520" can only be May 2020: read as AAMM it would be month 20, which does not exist.
  it("reads a MMAA suffix when AAMM would be an impossible month", () => {
    expect(at("20200706_pagamento_RPSHonorario_0520.pdf")!.competencia).toBe("2020-05")
  })

  it("gives up when neither name nor folder says anything", () => {
    expect(at("download.pdf", "MaterialCliente")).toBe(null)
    expect(at("Extrato Original todos os periodos.pdf", "MaterialCliente/2020")).toBe(null)
  })

  it("rejects an impossible month", () => {
    expect(at("DAS 13.2025.pdf")).toBe(null)
  })
})

describe("formatCompetencia", () => {
  it("shows a month as MM/AAAA", () => {
    expect(formatCompetencia("2025-11", "month")).toBe("11/2025")
  })

  it("shows a year as the year alone", () => {
    expect(formatCompetencia("2021-01", "year")).toBe("2021")
  })
})

describe("accountingPath", () => {
  it("nests by owner and competência, named by kind", () => {
    expect(accountingPath("user-1", "2025-11", "das_guide", "abc", "DAS 11.2025.pdf"))
      .toBe("user-1/2025-11/das_guide-abc.pdf")
  })

  it("falls back to pdf when the name has no extension", () => {
    expect(accountingPath("u", "2025-11", "tfe", "id", "comprovante")).toBe("u/2025-11/tfe-id.pdf")
  })
})
