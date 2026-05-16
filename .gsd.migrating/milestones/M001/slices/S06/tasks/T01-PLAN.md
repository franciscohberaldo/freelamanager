---
estimated_steps: 7
estimated_files: 4
skills_used: []
---

# T01: Extract shared PDF utility and create service-role Supabase client

**Why:** The existing PDF generation logic in src/app/api/invoices/pdf/route.ts is auth-gated and tightly coupled. Portal API routes need a service-role Supabase client (since anon key can't bypass RLS on financial tables) and a reusable PDF generator.

**Do:**
1. Create `src/lib/supabase/admin.ts` exporting a `createAdminClient()` function that uses `SUPABASE_SERVICE_ROLE_KEY` (no cookies needed — stateless).
2. Create `src/lib/invoice-pdf.ts` by extracting the PDF generation logic from `src/app/api/invoices/pdf/route.ts`. The function `generateInvoicePDF(params)` should accept invoice data, items, job, client, settings, and lang — return `ArrayBuffer`. Move `formatCurrencyPDF`, `hexToRgb`, `fetchImageBase64` into this file.
3. Refactor `src/app/api/invoices/pdf/route.ts` to import and call `generateInvoicePDF` from the shared utility. The route keeps auth logic and data fetching, but delegates PDF creation.
4. Create `src/lib/portal-auth.ts` with `validatePortalToken(token: string)` that uses the admin client to query `client_portal_tokens` and returns `{ client_id, user_id } | null`.

**Done when:** Admin PDF download works identically. `npx tsc --noEmit` passes. The shared utility is importable with a clean interface.

## Inputs

- `src/app/api/invoices/pdf/route.ts`
- `src/lib/supabase/server.ts`
- `src/lib/invoice-i18n.ts`
- `src/lib/supabase/types.ts`

## Expected Output

- `src/lib/supabase/admin.ts`
- `src/lib/invoice-pdf.ts`
- `src/lib/portal-auth.ts`
- `src/app/api/invoices/pdf/route.ts`

## Verification

npx tsc --noEmit
