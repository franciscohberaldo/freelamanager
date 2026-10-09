import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mock = vi.hoisted(() => ({ send: vi.fn(), currency: "USD", invoiceStatus: "sent", updates: [] as unknown[] }))
vi.mock("resend", () => ({ Resend: class { emails = { send: mock.send } } }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        insert: () => query,
        update: (value: unknown) => { mock.updates.push(value); return query },
        single: async () => ({ data: table === "user_settings"
          ? { accountant_email: "accountant@example.com", company_name: "Studio" }
          : table === "jobs"
            ? { id: "job", name: "Animation", currency: mock.currency, contract_value: null, clients: { name: "Client" } }
            : table === "invoices"
              ? { id: "invoice", status: mock.invoiceStatus, nf_status: "not_required", currency: mock.currency, nf_amount_brl: null, total: 1000, jobs: { name: "Animation", clients: { name: "Client" } } }
              : { id: "request" }, error: null }),
      }
      return query
    },
  }),
}))

import { POST } from "@/app/api/invoices/nf-request/route"
const request = (body: unknown) => new NextRequest("http://localhost/api/invoices/nf-request", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
})

beforeEach(() => {
  mock.currency = "USD"
  mock.invoiceStatus = "sent"
  mock.updates = []
  mock.send.mockReset().mockResolvedValue({ data: { id: "email" }, error: null })
})

describe("accountant request in BRL", () => {
  it("accepts the known BRL receipt of a foreign job without requiring an invoice", async () => {
    const response = await POST(request({ jobId: "job", amountBrl: 4439.84 }))
    expect(response.status).toBe(200)
    expect(mock.send).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("Valor: R$ 4.439,84"),
    }))
    expect(mock.send.mock.calls[0][0].text).toContain("guia de arrecadação de imposto em reais")
  })

  it("stores the BRL amount when a foreign invoice enters the NF workflow", async () => {
    const response = await POST(request({ invoiceId: "invoice", amountBrl: 4439.84 }))
    expect(response.status).toBe(200)
    expect(mock.updates).toContainEqual(expect.objectContaining({ nf_status: "requested", nf_amount_brl: 4439.84 }))
  })

  it.each([undefined, 0, -1, "4439.84", 10000000000])("rejects an invalid or missing BRL receipt (%s) before sending", async amountBrl => {
    const response = await POST(request({ jobId: "job", amountBrl }))
    expect(response.status).toBe(400)
    expect(mock.send).not.toHaveBeenCalled()
  })

  it("keeps cancelled invoices blocked even with a valid BRL amount", async () => {
    mock.invoiceStatus = "cancelled"
    const response = await POST(request({ invoiceId: "invoice", amountBrl: 4439.84 }))
    expect(response.status).toBe(409)
    expect(mock.send).not.toHaveBeenCalled()
  })
})
