import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { renderInvoicePdf } from "@/lib/invoice-pdf-server"
import { isInvoiceLang } from "@/lib/invoice-i18n"

/**
 * The invoice as a PDF. `lang` may be forced; left out, the invoice speaks the language of
 * its currency. `inline=1` opens it in the browser tab instead of downloading.
 */
export async function GET(request: NextRequest) {
  const id        = request.nextUrl.searchParams.get("id")
  const langParam = request.nextUrl.searchParams.get("lang")
  const inline    = request.nextUrl.searchParams.get("inline") === "1"

  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const pdf = await renderInvoicePdf(supabase, user.id, id, isInvoiceLang(langParam) ? langParam : null)
  if (!pdf) return NextResponse.json({ error: "Invoice não encontrado" }, { status: 404 })

  return new NextResponse(pdf.bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${pdf.fileName}"`,
    },
  })
}
