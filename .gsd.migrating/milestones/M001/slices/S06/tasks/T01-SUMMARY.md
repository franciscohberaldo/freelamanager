---
id: T01
parent: S06
milestone: M001
key_files:
  - src/lib/supabase/admin.ts
  - src/lib/invoice-pdf.ts
  - src/lib/portal-auth.ts
  - src/app/api/invoices/pdf/route.ts
key_decisions:
  - Used @supabase/supabase-js directly for admin client (no SSR cookie layer needed for stateless service-role access)
  - Exported helper functions (formatCurrencyPDF, hexToRgb, fetchImageBase64) for reuse by portal PDF route
  - InvoicePDFParams uses minimal typed interface rather than full DB row types for flexibility
duration: 
verification_result: passed
completed_at: 2026-05-16T19:53:02.576Z
blocker_discovered: false
---

# T01: Extracted shared PDF generator, created service-role admin client, and portal token validator

**Extracted shared PDF generator, created service-role admin client, and portal token validator**

## What Happened

Created three new utility modules and refactored the PDF route:

1. `src/lib/supabase/admin.ts` — exports `createAdminClient()` using `SUPABASE_SERVICE_ROLE_KEY` for stateless server-side queries that bypass RLS. Uses `@supabase/supabase-js` directly (no cookie handling needed).

2. `src/lib/invoice-pdf.ts` — extracted all PDF generation logic from the route into `generateInvoicePDF(params)` which accepts typed invoice data and returns `ArrayBuffer`. Also exports `formatCurrencyPDF`, `hexToRgb`, and `fetchImageBase64` for reuse by portal routes.

3. `src/lib/portal-auth.ts` — `validatePortalToken(token)` uses the admin client to query `client_portal_tokens` table and returns `{ client_id, user_id } | null`.

4. Refactored `src/app/api/invoices/pdf/route.ts` to import and delegate to `generateInvoicePDF`. The route retains auth and data-fetching responsibility only.

The existing portal page at `src/app/portal/[token]/page.tsx` already queries the same table by token — our utility mirrors that pattern but via service-role client for use in new API routes that can't rely on anon-key RLS access.

## Verification

Ran `npx tsc --noEmit` — zero errors. All imports resolve correctly. The `InvoicePDFParams` interface matches the shape of data the route already fetches, ensuring the refactored route remains functionally identical.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | pass | 8000ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/lib/supabase/admin.ts`
- `src/lib/invoice-pdf.ts`
- `src/lib/portal-auth.ts`
- `src/app/api/invoices/pdf/route.ts`
