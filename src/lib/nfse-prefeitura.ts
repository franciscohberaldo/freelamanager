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
