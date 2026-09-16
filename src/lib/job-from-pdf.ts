/**
 * A PDF that is neither a job's NF nor the company's accounting paperwork may be new work
 * arriving: an order, a briefing, a contract. The text is read and Claude decides whether
 * it is really work and, if so, drafts the job's data from it.
 */
import Anthropic from "@anthropic-ai/sdk"
import { extractText } from "unpdf"

export type JobDraft = {
  isWork: boolean
  clientName: string | null
  jobName: string | null
  description: string | null
  amount: number | null
  currency: "BRL" | "USD" | "EUR" | null
  poNumber: string | null
  startDate: string | null
  endDate: string | null
}

const CURRENCIES = ["BRL", "USD", "EUR"] as const
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

export async function jobDraftFromPdf(
  bytes: Buffer, fileName: string, fromEmail: string | null,
): Promise<JobDraft | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  let text: string
  try {
    const extracted = await extractText(new Uint8Array(bytes), { mergePages: true })
    text = extracted.text
  } catch {
    return null
  }
  if (!text.trim()) return null

  const prompt = `Você organiza a caixa de entrada de um freelancer. Chegou um e-mail de "${fromEmail ?? "remetente desconhecido"}" com o PDF "${fileName}" anexado.

Texto extraído do PDF:
"""
${text.slice(0, 12000)}
"""

Decida se este PDF representa TRABALHO NOVO para o freelancer (ordem de serviço, proposta aprovada, contrato, briefing, pedido de job). NÃO é trabalho novo: recibos, guias de imposto, extratos, notificações automáticas, propagandas, cobranças de serviços que o freelancer CONTRATOU.

Responda APENAS com um JSON neste formato, sem markdown:
{
  "is_work": true ou false,
  "client_name": "nome da empresa/cliente que está contratando" ou null,
  "job_name": "nome curto para o job" ou null,
  "description": "resumo do trabalho em 1-2 frases, em português" ou null,
  "amount": número com o valor total do trabalho ou null,
  "currency": "BRL", "USD" ou "EUR", ou null,
  "po_number": "número de PO/ordem de compra" ou null,
  "start_date": "YYYY-MM-DD" ou null,
  "end_date": "YYYY-MM-DD" ou null
}`

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    })
    const raw = message.content[0]?.type === "text" ? message.content[0].text : ""
    const json = raw.match(/\{[\s\S]*\}/)
    if (!json) return null
    const p = JSON.parse(json[0]) as Record<string, unknown>
    return {
      isWork: p.is_work === true,
      clientName: str(p.client_name),
      jobName: str(p.job_name),
      description: str(p.description),
      amount: num(p.amount),
      currency: CURRENCIES.includes(p.currency as never) ? p.currency as JobDraft["currency"] : null,
      poNumber: str(p.po_number),
      startDate: date(p.start_date),
      endDate: date(p.end_date),
    }
  } catch {
    return null
  }
}
