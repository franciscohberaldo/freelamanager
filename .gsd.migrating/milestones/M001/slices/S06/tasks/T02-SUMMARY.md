---
id: T02
parent: S06
milestone: M001
key_files:
  - supabase/migrations/012_portal_confirmation.sql
  - src/app/api/portal/pdf/route.ts
  - src/app/api/portal/confirm-payment/route.ts
  - src/lib/supabase/types.ts
key_decisions:
  - Used `as unknown as T` for Supabase FK join casts (per MEM005 gotcha)
  - Portal PDF uses lang 'pt' as default since this is a PT-BR focused app
  - Confirm-payment route sets client_confirmed_at to ISO timestamp via JS Date rather than DB now() for consistency with return value
duration: 
verification_result: passed
completed_at: 2026-05-16T19:54:49.388Z
blocker_discovered: false
---

# T02: Created portal PDF download and payment confirmation API routes with migration adding client_confirmed_at column

**Created portal PDF download and payment confirmation API routes with migration adding client_confirmed_at column**

## What Happened

Implemented the two portal API routes and supporting migration:

1. **Migration** (`supabase/migrations/012_portal_confirmation.sql`): Adds `client_confirmed_at timestamptz DEFAULT NULL` to the `invoices` table.

2. **PDF download route** (`src/app/api/portal/pdf/route.ts`): GET handler that accepts `token` and `invoice_id` query params, validates the portal token, verifies the invoice belongs to the authenticated client via the job's `client_id`, fetches invoice items and user settings, generates PDF using the shared `generateInvoicePDF()`, and returns it with proper Content-Type/Disposition headers.

3. **Payment confirmation route** (`src/app/api/portal/confirm-payment/route.ts`): POST handler accepting `{ token, invoice_id }` in body, validates token, verifies invoice ownership through the job→client chain, updates `client_confirmed_at` to current timestamp, returns `{ success: true, confirmed_at }`.

4. **Types update** (`src/lib/supabase/types.ts`): Added `client_confirmed_at: string | null` to `InvoiceRow` and `client_confirmed_at?: string | null` to `InvoiceInsert`.

Both routes use the admin client (service-role) and follow the same token→invoice→job→client_id authorization pattern. The Supabase FK join `jobs(*, clients(*))` is cast via `as unknown as T` per the project gotcha (MEM005).

## Verification

Ran `npx tsc --noEmit` twice (once after initial implementation, once after removing unnecessary type cast). Both passed with zero errors, confirming all new routes and type changes compile correctly.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | pass | 15000ms |

## Deviations

None

## Known Issues

None

## Files Created/Modified

- `supabase/migrations/012_portal_confirmation.sql`
- `src/app/api/portal/pdf/route.ts`
- `src/app/api/portal/confirm-payment/route.ts`
- `src/lib/supabase/types.ts`
