import { describe, it, expect } from "vitest"
import { parseEmails, isValidEmail, validateEmailList, primaryEmail, extraEmails } from "@/lib/emails"

describe("isValidEmail", () => {
  it("accepts an ordinary address", () => {
    expect(isValidEmail("krista.flinn@omc.co")).toBe(true)
    expect(isValidEmail("nicolas.bustillo@omc.com")).toBe(true)
    expect(isValidEmail("a+tag@sub.domain.com.br")).toBe(true)
  })

  it("rejects what is not one", () => {
    expect(isValidEmail("krista.flinn")).toBe(false)
    expect(isValidEmail("@omc.co")).toBe(false)
    expect(isValidEmail("a@b")).toBe(false)
    expect(isValidEmail("a b@c.com")).toBe(false)
    expect(isValidEmail("")).toBe(false)
  })
})

describe("parseEmails", () => {
  it("reads a single address", () => {
    expect(parseEmails("krista.flinn@omc.co")).toEqual(["krista.flinn@omc.co"])
  })

  // What the user typed when the browser refused it.
  it("reads a comma-separated list", () => {
    expect(parseEmails("nicolas.bustillo@omc.com, krista.flinn@omc.co"))
      .toEqual(["nicolas.bustillo@omc.com", "krista.flinn@omc.co"])
  })

  it("also accepts semicolons and line breaks, which is how people paste", () => {
    expect(parseEmails("a@x.com; b@x.com\nc@x.com")).toEqual(["a@x.com", "b@x.com", "c@x.com"])
  })

  it("lowercases and trims", () => {
    expect(parseEmails("  Krista.Flinn@OMC.co  ")).toEqual(["krista.flinn@omc.co"])
  })

  it("drops repeats, keeping the first position", () => {
    expect(parseEmails("a@x.com, b@x.com, A@X.com")).toEqual(["a@x.com", "b@x.com"])
  })

  it("ignores empty pieces from a trailing separator", () => {
    expect(parseEmails("a@x.com, ")).toEqual(["a@x.com"])
    expect(parseEmails("")).toEqual([])
    expect(parseEmails(null)).toEqual([])
  })
})

describe("primaryEmail and extraEmails", () => {
  const list = "nicolas.bustillo@omc.com, krista.flinn@omc.co, finance@omc.co"

  it("takes the first as the recipient", () => {
    expect(primaryEmail(list)).toBe("nicolas.bustillo@omc.com")
  })

  it("leaves the rest to be copied", () => {
    expect(extraEmails(list)).toEqual(["krista.flinn@omc.co", "finance@omc.co"])
  })

  it("has no recipient when there is nothing", () => {
    expect(primaryEmail("")).toBe(null)
    expect(extraEmails("a@x.com")).toEqual([])
  })
})

describe("validateEmailList", () => {
  it("passes a good list", () => {
    expect(validateEmailList("a@x.com, b@y.com")).toEqual({ ok: true })
  })

  it("passes an empty value, since the field is optional", () => {
    expect(validateEmailList("")).toEqual({ ok: true })
  })

  // Naming the offender is the point: a list of five is hard to scan.
  it("names the address that is wrong", () => {
    const result = validateEmailList("a@x.com, nao-e-email, b@y.com")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("nao-e-email")
  })
})
