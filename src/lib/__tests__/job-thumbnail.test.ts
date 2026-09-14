import { describe, it, expect } from "vitest"
import { validateThumbnail, thumbnailPath, pathFromPublicUrl, THUMBNAIL_BUCKET, MAX_THUMBNAIL_BYTES } from "@/lib/job-thumbnail"

describe("validateThumbnail", () => {
  it("accepts an image within the size limit", () => {
    expect(validateThumbnail({ type: "image/png", size: 1024 })).toEqual({ ok: true })
  })

  it("rejects a file that is not an image", () => {
    const r = validateThumbnail({ type: "application/pdf", size: 1024 })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toMatch(/imagem/i)
  })

  it("rejects an image past the size limit", () => {
    const r = validateThumbnail({ type: "image/jpeg", size: MAX_THUMBNAIL_BYTES + 1 })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toMatch(/5 MB/)
  })

  it("accepts a file exactly at the limit", () => {
    expect(validateThumbnail({ type: "image/webp", size: MAX_THUMBNAIL_BYTES })).toEqual({ ok: true })
  })
})

describe("thumbnailPath", () => {
  it("puts the file under the user's own folder", () => {
    expect(thumbnailPath("user-1", "frame.png", "abc")).toBe("user-1/abc.png")
  })

  it("keeps the extension lowercase", () => {
    expect(thumbnailPath("user-1", "FRAME.JPG", "abc")).toBe("user-1/abc.jpg")
  })

  it("falls back to jpg when the name carries no extension", () => {
    expect(thumbnailPath("user-1", "frame", "abc")).toBe("user-1/abc.jpg")
  })

  it("ignores dots in the name that are not the extension", () => {
    expect(thumbnailPath("user-1", "my.project.v2.png", "abc")).toBe("user-1/abc.png")
  })
})

describe("pathFromPublicUrl", () => {
  it("recovers the storage path so the old file can be removed", () => {
    const url = `https://x.supabase.co/storage/v1/object/public/${THUMBNAIL_BUCKET}/user-1/abc.png`
    expect(pathFromPublicUrl(url)).toBe("user-1/abc.png")
  })

  it("returns null for a URL from somewhere else", () => {
    expect(pathFromPublicUrl("https://example.com/frame.png")).toBeNull()
    expect(pathFromPublicUrl(null)).toBeNull()
    expect(pathFromPublicUrl("")).toBeNull()
  })
})
