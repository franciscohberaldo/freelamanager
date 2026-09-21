import { describe, it, expect } from "vitest"
import { quiet, cityOf, itemLabel } from "@/lib/invoice-pdf"

describe("quiet", () => {
  it("title-cases a shouting legal name but keeps the legal form in capitals", () => {
    expect(quiet("ESTUDIO JUDITE EIRELI")).toBe("Estudio Judite EIRELI")
  })

  it("quiets each piece of a shouting address, leaving abbreviations and numbers alone", () => {
    expect(quiet("R COLONIA DA GLORIA 00453, AP 192 - VILA MARIANA - CEP: 04113-001 - São Paulo/SP"))
      .toBe("R Colonia da Gloria 00453, AP 192 - Vila Mariana - CEP: 04113-001 - São Paulo/SP")
  })

  it("leaves text that is not shouting untouched", () => {
    expect(quiet("Omnicom Production 1285 Avenue of the Americas NY, NY 10019"))
      .toBe("Omnicom Production 1285 Avenue of the Americas NY, NY 10019")
  })
})

describe("cityOf", () => {
  it("reads the city from an inline City: field without shouting", () => {
    expect(cityOf("Rua X, 10, City: SAO PAULO, 04113-001")).toBe("Sao Paulo")
  })

  it("falls back to São Paulo when every piece of the address carries digits", () => {
    expect(cityOf("R COLONIA DA GLORIA 00453, AP 192 - CEP: 04113-001")).toBe("São Paulo")
  })
})

describe("itemLabel", () => {
  const day = { quantity: 1, unit: "day" as const }

  it("names the project on a billed day instead of \"1 day\"", () => {
    expect(itemLabel({ description: null }, day, "Phantom", "en")).toBe("Phantom")
  })

  it("keeps a line's own description", () => {
    expect(itemLabel({ description: "Storyboard" }, day, "Phantom", "en")).toBe("Storyboard")
  })

  it("falls back to the quantity when there is no project name", () => {
    expect(itemLabel({ description: null }, day, null, "en")).toBe("1 day")
  })

  it("leaves hourly lines showing their hours", () => {
    expect(itemLabel({ description: null }, { quantity: 8, unit: "hour" }, "Phantom", "en")).not.toBe("Phantom")
  })
})
