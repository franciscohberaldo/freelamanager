export const THUMBNAIL_BUCKET = "job-thumbnails"
export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024

export type ThumbnailCheck = { ok: true } | { ok: false; error: string }

export function validateThumbnail(file: { type: string; size: number }): ThumbnailCheck {
  if (!file.type.startsWith("image/")) return { ok: false, error: "Escolha um arquivo de imagem." }
  if (file.size > MAX_THUMBNAIL_BYTES) return { ok: false, error: "A imagem passa de 5 MB." }
  return { ok: true }
}

/** Files live under the owner's id, with a random name so the public URL cannot be guessed. */
export function thumbnailPath(userId: string, fileName: string, id: string): string {
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "jpg"
  return `${userId}/${id}.${ext}`
}

/** The storage path inside a public URL, used to delete the file being replaced. */
export function pathFromPublicUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${THUMBNAIL_BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : url.slice(i + marker.length)
}
