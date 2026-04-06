import { NextResponse } from "next/server"

// API v1 root — docs
export async function GET() {
  return NextResponse.json({
    version: "v1",
    endpoints: {
      "GET /api/v1/clients":       "List all clients",
      "GET /api/v1/jobs":          "List all jobs",
      "GET /api/v1/invoices":      "List all invoices",
      "GET /api/v1/logs":          "List daily logs (query: ?from=YYYY-MM-DD&to=YYYY-MM-DD)",
      "GET /api/v1/expenses":      "List expenses (query: ?from=YYYY-MM-DD&to=YYYY-MM-DD)",
    },
    auth: "Bearer <API_KEY> in Authorization header",
  })
}
