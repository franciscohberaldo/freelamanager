import { ImageResponse } from "next/og"

export const runtime = "edge"

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
          borderRadius: 102,
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 240,
            fontWeight: 700,
            fontFamily: "sans-serif",
            lineHeight: 1,
          }}
        >
          F
        </span>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
