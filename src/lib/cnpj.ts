import { normalizeName } from "@/lib/text-case"

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "")
}

export function formatCnpj(value: string): string {
  const d = onlyDigits(value)
  if (d.length !== 14) return value
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function formatCep(value: string): string {
  const d = onlyDigits(value)
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : value
}

/**
 * The two check digits, so a mistyped number is caught here instead of costing a request.
 * Repeated digits pass the arithmetic but are not issued, so they are refused outright.
 */
export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false

  const digit = (upTo: number) => {
    let weight = upTo - 7
    let sum = 0
    for (let i = 0; i < upTo; i++) {
      sum += Number(d[i]) * weight--
      if (weight < 2) weight = 9
    }
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  return digit(12) === Number(d[12]) && digit(13) === Number(d[13])
}

export type ReceitaAddress = {
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  municipio?: string | null
  uf?: string | null
  cep?: string | null
}

/**
 * One line, in the shape the clients table already holds, and quiet: the Receita writes
 * every field in capitals.
 */
export function addressFrom(a: ReceitaAddress): string {
  const street = normalizeName((a.logradouro ?? "").trim())
  if (!street) return ""

  const head = [street, a.numero?.trim(), normalizeName((a.complemento ?? "").trim())]
    .filter(Boolean).join(", ")

  const parts = [head]
  const bairro = normalizeName((a.bairro ?? "").trim())
  if (bairro) parts.push(bairro)
  if (a.cep?.trim()) parts.push(`CEP: ${formatCep(a.cep)}`)

  const city = normalizeName((a.municipio ?? "").trim())
  if (city) parts.push(a.uf ? `${city}/${a.uf}` : city)

  return parts.join(" - ")
}
