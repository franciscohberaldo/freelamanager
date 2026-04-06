import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { invoiceId } = await req.json()
  if (!invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 })

  // Fetch invoice + items
  const [{ data: invoice }, { data: items }] = await Promise.all([
    supabase
      .from("invoices")
      .select("invoice_number, period_start, period_end, total_hours_billed, total, currency, jobs(name, clients(name))")
      .eq("id", invoiceId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("invoice_items")
      .select("date, description, hours_billed, rate, subtotal")
      .eq("invoice_id", invoiceId)
      .order("date"),
  ])

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

  const job    = invoice.jobs as unknown as { name: string; clients: { name: string } | null } | null
  const jobName    = job?.name ?? "Projeto"
  const clientName = (job?.clients as unknown as { name: string } | null)?.name ?? ""

  const itemsSummary = items?.map(i =>
    `- ${i.date}: ${i.description ?? "Serviço"} | ${i.hours_billed}h × R$${i.rate}/h = R$${i.subtotal}`
  ).join("\n") ?? ""

  const prompt = `Você é um assistente especializado em redação profissional para freelancers.

Gere uma descrição profissional e concisa (3-5 frases) para o seguinte invoice:

**Job:** ${jobName}
**Cliente:** ${clientName}
**Período:** ${invoice.period_start} a ${invoice.period_end}
**Total de horas:** ${invoice.total_hours_billed}h
**Valor total:** ${invoice.total} ${invoice.currency}

**Itens:**
${itemsSummary}

A descrição deve:
- Ser formal e profissional
- Resumir o trabalho realizado no período
- Mencionar as entregas principais (inferidas pelas descrições)
- Estar em português do Brasil
- NÃO mencionar valores monetários (isso já está no invoice)
- Ser adequada para constar no campo "Observações" do invoice

Retorne APENAS o texto da descrição, sem formatação extra.`

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 })

    const client  = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 512,
      messages:   [{ role: "user", content: prompt }],
    })

    const text = message.content[0]?.type === "text" ? message.content[0].text : ""
    return NextResponse.json({ description: text.trim() })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao chamar IA"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
