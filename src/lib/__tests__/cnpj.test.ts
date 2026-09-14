import { describe, it, expect } from "vitest"
import { onlyDigits, formatCnpj, formatCep, isValidCnpj, addressFrom } from "@/lib/cnpj"

describe("onlyDigits", () => {
  it("strips the punctuation people type", () => {
    expect(onlyDigits("11.241.505/0001-64")).toBe("11241505000164")
    expect(onlyDigits(" 11241505000164 ")).toBe("11241505000164")
  })
})

describe("formatCnpj", () => {
  it("punctuates fourteen digits", () => {
    expect(formatCnpj("11241505000164")).toBe("11.241.505/0001-64")
    expect(formatCnpj("11.241.505/0001-64")).toBe("11.241.505/0001-64")
  })

  it("returns anything else untouched", () => {
    expect(formatCnpj("123")).toBe("123")
    expect(formatCnpj("")).toBe("")
  })
})

describe("formatCep", () => {
  it("punctuates eight digits", () => {
    expect(formatCep("04113001")).toBe("04113-001")
  })

  it("leaves a malformed one alone", () => {
    expect(formatCep("123")).toBe("123")
  })
})

describe("isValidCnpj", () => {
  it("accepts a real one, punctuated or not", () => {
    expect(isValidCnpj("11241505000164")).toBe(true)
    expect(isValidCnpj("11.241.505/0001-64")).toBe(true)
    expect(isValidCnpj("39.937.180/0001-78")).toBe(true)
  })

  it("rejects a wrong check digit", () => {
    expect(isValidCnpj("11241505000165")).toBe(false)
  })

  it("rejects the wrong number of digits", () => {
    expect(isValidCnpj("1124150500016")).toBe(false)
    expect(isValidCnpj("")).toBe(false)
  })

  // These pass the arithmetic but are not real numbers.
  it("rejects a repeated digit", () => {
    expect(isValidCnpj("00000000000000")).toBe(false)
    expect(isValidCnpj("11111111111111")).toBe(false)
  })
})

describe("addressFrom", () => {
  const receita = {
    logradouro: "COLONIA DA GLORIA",
    numero: "453",
    complemento: "APT 192",
    bairro: "VILA MARIANA",
    municipio: "SAO PAULO",
    uf: "SP",
    cep: "04113001",
  }

  // The Receita writes everything in capitals; the address should not arrive shouting.
  it("assembles a quiet address", () => {
    expect(addressFrom(receita))
      .toBe("Colonia da Gloria, 453, APT 192 - Vila Mariana - CEP: 04113-001 - Sao Paulo/SP")
  })

  it("skips the parts that are missing", () => {
    expect(addressFrom({ ...receita, complemento: "", bairro: "" }))
      .toBe("Colonia da Gloria, 453 - CEP: 04113-001 - Sao Paulo/SP")
  })

  it("returns empty when there is no street", () => {
    expect(addressFrom({ ...receita, logradouro: "" })).toBe("")
  })
})
