/**
 * São Paulo's city hall does not attach the NFS-e to its notification e-mail; it sends a
 * link (nfe.aspx?ccm=…&nf=…&cod=…) whose page embeds the PDF at notaprintpdf.aspx with
 * the same query. Both endpoints are public, so the PDF is one plain GET away.
 */

export type NfseRef = {
  /** Host the link points to, e.g. nfe.sf.prefeitura.sp.gov.br */
  host: string
  ccm: string
  numero: string
  codigo: string
}

const LINK_RE = /https:\/\/nfe(?:\.sf)?\.prefeitura\.sp\.gov\.br\/nfe\.aspx\?[^\s"'<>)\]]+/i

/** The nota reference hidden in the e-mail, from the plain text or the HTML part. */
export function nfseLinkFrom(text: string | null, html: string | null): NfseRef | null {
  for (const source of [text, html]) {
    if (!source) continue
    const found = source.match(LINK_RE)
    if (!found) continue
    let url: URL
    try {
      url = new URL(found[0].replace(/&amp;/gi, "&"))
    } catch {
      continue
    }
    const ccm = url.searchParams.get("ccm")
    const numero = url.searchParams.get("nf")
    const codigo = url.searchParams.get("cod")
    if (ccm && numero && codigo) return { host: url.host, ccm, numero, codigo }
  }
  return null
}

/** The URL that serves the nota itself as a PDF (no cookies or session needed). */
export function nfsePdfUrl(ref: NfseRef): string {
  return `https://${ref.host}/contribuinte/notaprintpdf.aspx?ccm=${ref.ccm}&nf=${ref.numero}&cod=${ref.codigo}`
}

/** Downloads the nota; null when the city hall answers anything but a PDF. */
export async function downloadNfsePdf(ref: NfseRef): Promise<Buffer | null> {
  const res = await fetch(nfsePdfUrl(ref), { redirect: "follow" }).catch(() => null)
  if (!res?.ok) return null
  if (!(res.headers.get("content-type") ?? "").includes("application/pdf")) return null
  return Buffer.from(await res.arrayBuffer())
}

export type NotaInfo = {
  /** False when the city hall answered an "Acesso Negado" page instead of the nota. */
  valid: boolean
  tomadorName: string | null
  /** Only the digits, e.g. "30488380000116". */
  tomadorCnpj: string | null
}

/**
 * The e-mail says who the prestador is; the nota itself says who the tomador is — and the
 * tomador is what ties the nota to a client and its job. The PDF's text carries a
 * "TOMADOR DE SERVIÇOS" section with the razão social and the CNPJ.
 */
export async function notaInfoFromPdf(bytes: Buffer): Promise<NotaInfo> {
  const none: NotaInfo = { valid: false, tomadorName: null, tomadorCnpj: null }
  try {
    const { extractText } = await import("unpdf")
    const { text } = await extractText(new Uint8Array(bytes), { mergePages: true })
    if (!/TOMADOR DE SERVI[ÇC]OS/i.test(text)) return none

    const section = text.match(/TOMADOR DE SERVI[ÇC]OS([\s\S]*?)(?:INTERMEDI[ÁA]RIO|DISCRIMINA)/i)?.[1] ?? ""
    const cnpj = section.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/)
    // Label lines carry a colon; the first value line with letters is the razão social.
    const name = section.split("\n")
      .map(l => l.trim())
      .find(l => l.length > 5 && !l.includes(":") && /[A-Za-z]{3}/.test(l) && !/^\d[\d./ -]*$/.test(l))

    return {
      valid: true,
      tomadorName: name ?? null,
      tomadorCnpj: cnpj ? cnpj[0].replace(/\D/g, "") : null,
    }
  } catch {
    return none
  }
}
