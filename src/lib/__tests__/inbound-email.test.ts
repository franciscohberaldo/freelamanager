import { describe, it, expect } from "vitest"
import { createHmac } from "crypto"
import { replyAddress, requestIdFrom, isNfAttachment, verifySignature } from "@/lib/inbound-email"

const id = "6f9619ff-8b86-d011-b42d-00c04fc964ff"

describe("replyAddress", () => {
  it("tags the reply with the request it answers", () => {
    expect(replyAddress(id, "nf.chico.cx")).toBe(`nf+${id}@nf.chico.cx`)
  })
  it("is nothing while no inbound domain is configured", () => {
    expect(replyAddress(id, undefined)).toBeNull()
  })
})

describe("requestIdFrom", () => {
  it("finds the tag wherever the address ended up", () => {
    expect(requestIdFrom([null, "Contador <NF+6F9619FF-8B86-D011-B42D-00C04FC964FF@nf.chico.cx>"])).toBe(id)
  })
  it("is nothing for a plain address", () => {
    expect(requestIdFrom(["hello@chico.cx", undefined])).toBeNull()
  })
})

describe("isNfAttachment", () => {
  it("takes a PDF by type or by name", () => {
    expect(isNfAttachment({ content_type: "application/pdf", filename: null })).toBe(true)
    expect(isNfAttachment({ content_type: "application/octet-stream", filename: "NF 0102.PDF" })).toBe(true)
  })
  it("leaves a signature image alone", () => {
    expect(isNfAttachment({ content_type: "image/png", filename: "assinatura.png" })).toBe(false)
  })
})

describe("verifySignature", () => {
  const secret = "whsec_" + Buffer.from("um segredo qualquer").toString("base64")
  const body = JSON.stringify({ type: "email.received" })
  const sign = (id: string, ts: string) =>
    createHmac("sha256", Buffer.from(secret.replace(/^whsec_/, ""), "base64"))
      .update(`${id}.${ts}.${body}`).digest("base64")

  it("accepts the signature Resend sent", () => {
    const header = `v1,${sign("msg_1", "1700000000")}`
    expect(verifySignature({ secret, id: "msg_1", timestamp: "1700000000", body, header })).toBe(true)
  })

  it("accepts one good signature among several", () => {
    const header = `v1,${Buffer.from("outra coisa").toString("base64")} v1,${sign("msg_1", "1700000000")}`
    expect(verifySignature({ secret, id: "msg_1", timestamp: "1700000000", body, header })).toBe(true)
  })

  it("refuses a body that was changed on the way", () => {
    const header = `v1,${sign("msg_1", "1700000000")}`
    expect(verifySignature({ secret, id: "msg_1", timestamp: "1700000000", body: body + " ", header })).toBe(false)
  })

  it("refuses what is not signed at all", () => {
    expect(verifySignature({ secret, id: null, timestamp: null, body, header: null })).toBe(false)
  })
})
