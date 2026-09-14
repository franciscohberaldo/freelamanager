import { describe, it, expect } from "vitest"
import { normalizeName, isShouty } from "@/lib/text-case"

describe("isShouty", () => {
  it("spots text with letters and no lowercase", () => {
    expect(isShouty("LTDA")).toBe(true)
    expect(isShouty("A00 PRODUÇÕES LTDA")).toBe(true)
  })

  it("ignores text that already has lowercase", () => {
    expect(isShouty("Bamboo | Jimmy Nardello")).toBe(false)
    expect(isShouty("Ltda")).toBe(false)
  })

  it("ignores text without letters", () => {
    expect(isShouty("0090")).toBe(false)
    expect(isShouty("---")).toBe(false)
    expect(isShouty("")).toBe(false)
  })
})

describe("normalizeName", () => {
  it("leaves text that is not shouting alone", () => {
    expect(normalizeName("Bamboo | Jimmy Nardello")).toBe("Bamboo | Jimmy Nardello")
    expect(normalizeName("Lobo Multimidia Serviços e Participações Ltda"))
      .toBe("Lobo Multimidia Serviços e Participações Ltda")
  })

  // The whole point: a lone shouty word is an acronym, not shouting.
  it("leaves a single word alone, however shouty", () => {
    expect(normalizeName("IPG")).toBe("IPG")
    expect(normalizeName("YSFL")).toBe("YSFL")
    expect(normalizeName("EAD")).toBe("EAD")
    expect(normalizeName("RGA")).toBe("RGA")
  })

  it("title-cases a shouting company name", () => {
    expect(normalizeName("ARVORE EXPERIENCIAS IMERSIVAS LTDA"))
      .toBe("Arvore Experiencias Imersivas Ltda")
  })

  it("lowercases Portuguese particles, except as the first word", () => {
    expect(normalizeName("CINEMALINK EDIÇÃO E CRIAÇÃO DE VIDEO LTDA"))
      .toBe("Cinemalink Edição e Criação de Video Ltda")
    expect(normalizeName("VIDEOGRAPHICA SERVICOS E PARTICIPACOES LTDA"))
      .toBe("Videographica Servicos e Participacoes Ltda")
    expect(normalizeName("DE PAULA FILMES LTDA")).toBe("De Paula Filmes Ltda")
  })

  it("keeps a token carrying a digit", () => {
    expect(normalizeName("A00 PRODUÇÕES LTDA")).toBe("A00 Produções Ltda")
  })

  it("keeps a token carrying a slash", () => {
    expect(normalizeName("R/GA MEDIA GROUP PUBLICIDADE LTDA."))
      .toBe("R/GA Media Group Publicidade Ltda.")
  })

  it("keeps short tokens, which are legal forms and initials", () => {
    expect(normalizeName("A CAPELA COMUNICAÇÃO LTDA - EPP."))
      .toBe("A Capela Comunicação Ltda - EPP.")
    expect(normalizeName("FRANCISCO JOFILSAN ME")).toBe("Francisco Jofilsan ME")
    expect(normalizeName("ESTUDIO JUDITE EIRELI")).toBe("Estudio Judite EIRELI")
  })

  it("does not invent missing accents", () => {
    expect(normalizeName("ARVORE EXPERIENCIAS IMERSIVAS LTDA")).not.toContain("Árvore")
  })

  it("keeps the spacing it was given", () => {
    expect(normalizeName("A00  PRODUÇÕES   LTDA")).toBe("A00  Produções   Ltda")
  })

  it("handles empty and whitespace input", () => {
    expect(normalizeName("")).toBe("")
    expect(normalizeName("   ")).toBe("   ")
  })

  it("is idempotent", () => {
    const once = normalizeName("R/GA MEDIA GROUP PUBLICIDADE LTDA.")
    expect(normalizeName(once)).toBe(once)
  })

  it("passes null and undefined straight through", () => {
    expect(normalizeName(null)).toBe(null)
    expect(normalizeName(undefined)).toBe(undefined)
  })
})
