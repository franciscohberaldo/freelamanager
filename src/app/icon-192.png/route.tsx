import { ImageResponse } from "next/og"

export const runtime = "edge"

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
          borderRadius: 38,
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 88,
            fontWeight: 700,
            fontFamily: "sans-serif",
            lineHeight: 1,
          }}
        >
          F
        </span>
      </div>
    ),
    { width: 192, height: 192 }
  )
}
