import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { onlyDigits, formatCnpj, isValidCnpj, addressFrom } from "@/lib/cnpj"
import { normalizeName } from "@/lib/text-case"

/**
 * Company details from a CNPJ, read from BrasilAPI, which mirrors the Receita Federal and
 * needs no key. It sits behind our own route rather than being called from the browser so
 * the source can be swapped without touching the form, and so CORS never becomes the
 * client's problem.
 */
const UPSTREAM = "https://brasilapi.com.br/api/cnpj/v1"

type Receita = {
  cnpj: string
  razao_social?: string | null
  nome_fantasia?: string | null
  descricao_situacao_cadastral?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  municipio?: string | null
  uf?: string | null
  cep?: string | null
  email?: string | null
  ddd_telefone_1?: string | null
}

/** "1176947533" is a DDD glued to the number; split it so it reads like a phone. */
function formatPhone(raw?: string | null): string {
  const d = onlyDigits(raw ?? "")
  if (d.length < 10) return raw?.trim() ?? ""
  const ddd = d.slice(0, 2)
  const rest = d.slice(2)
  const half = rest.length > 8 ? 5 : 4
  return `+55 ${ddd} ${rest.slice(0, half)}-${rest.slice(half)}`
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const raw = new URL(request.url).searchParams.get("cnpj") ?? ""
  if (!isValidCnpj(raw)) {
    return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 })
  }

  let res: Response
  try {
    res = await fetch(`${UPSTREAM}/${onlyDigits(raw)}`, {
      // Without a User-Agent the upstream answers 403; Node's fetch sends none by default.
      headers: { accept: "application/json", "user-agent": "freela-manager" },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return NextResponse.json({ error: "A consulta não respondeu. Tente de novo." }, { status: 504 })
  }

  if (res.status === 404) {
    return NextResponse.json({ error: "CNPJ não encontrado na Receita" }, { status: 404 })
  }
  if (!res.ok) {
    return NextResponse.json({ error: "A consulta falhou. Tente de novo." }, { status: 502 })
  }

  const d = (await res.json()) as Receita
  const situacao = d.descricao_situacao_cadastral ?? ""

  return NextResponse.json({
    cnpj:       formatCnpj(d.cnpj ?? raw),
    legal_name: normalizeName((d.razao_social ?? "").trim()),
    company:    normalizeName((d.nome_fantasia ?? "").trim()),
    address:    addressFrom(d),
    email:      d.email?.trim().toLowerCase() ?? "",
    phone:      formatPhone(d.ddd_telefone_1),
    situacao,
    // Billing against a company that is no longer active is worth knowing before invoicing.
    active:     situacao.toUpperCase() === "ATIVA",
  })
}
