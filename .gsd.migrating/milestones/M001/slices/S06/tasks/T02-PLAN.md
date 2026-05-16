---
estimated_steps: 16
estimated_files: 4
skills_used: []
---

# T02: Create portal PDF download and payment confirmation API routes with migration

**Why:** The portal needs two API routes: one for PDF download (token-authenticated) and one for payment confirmation. A new migration adds the `client_confirmed_at` column to invoices.

**Do:**
1. Create migration `supabase/migrations/012_portal_confirmation.sql` adding `client_confirmed_at timestamptz` column to `invoices` table (nullable, default null).
2. Create `src/app/api/portal/pdf/route.ts`:
   - GET handler accepts `token` and `invoice_id` query params.
   - Calls `validatePortalToken(token)` — returns 404 if invalid.
   - Uses admin client to fetch invoice (with jobs, clients joins) verifying `invoice.user_id = user_id` and the invoice's job belongs to `client_id` — returns 403 if mismatch.
   - Fetches `invoice_items` and `user_settings` via admin client.
   - Calls `generateInvoicePDF()` and returns the PDF response.
3. Create `src/app/api/portal/confirm-payment/route.ts`:
   - POST handler accepts `{ token, invoice_id }` in body.
   - Validates token, verifies invoice belongs to client (same as PDF route).
   - Updates invoice `client_confirmed_at = now()` via admin client.
   - Returns `{ success: true, confirmed_at }` or error.
4. Add `ClientConfirmedAt` field to InvoiceRow in types.ts (client_confirmed_at: string | null).

**Done when:** Both routes respond correctly. `npx tsc --noEmit` passes. Migration file exists.

## Inputs

- `src/lib/invoice-pdf.ts`
- `src/lib/portal-auth.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/supabase/types.ts`
- `src/lib/invoice-i18n.ts`

## Expected Output

- `supabase/migrations/012_portal_confirmation.sql`
- `src/app/api/portal/pdf/route.ts`
- `src/app/api/portal/confirm-payment/route.ts`
- `src/lib/supabase/types.ts`

## Verification

npx tsc --noEmit
