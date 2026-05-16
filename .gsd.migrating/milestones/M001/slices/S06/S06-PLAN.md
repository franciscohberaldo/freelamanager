# S06: Client Portal Melhorado

**Goal:** Cliente acessa portal via token, faz download do PDF da invoice, e marca pagamento como feito. Portal API routes autenticam via token (service-role client) sem expor RLS policies públicas em tabelas financeiras.
**Demo:** Cliente acessa portal via token, faz download do PDF, marca pagamento como feito.

## Must-Haves

- 1. GET /api/portal/pdf?token=xxx&invoice_id=yyy returns valid PDF matching admin PDF output. 2. POST /api/portal/confirm-payment with token+invoice_id sets client_confirmed_at on the invoice. 3. Portal page shows download and confirm buttons per invoice. 4. Invalid token returns 404, invoice not belonging to client returns 403. 5. Admin PDF route still works identically after refactor. 6. npx tsc --noEmit passes with zero errors.

## Proof Level

- This slice proves: integration — real API routes exercised via curl/fetch, PDF generation verified, DB mutation confirmed

## Integration Closure

Upstream: S01 types (complete), existing portal page, existing PDF route. New wiring: service-role Supabase client helper, shared PDF utility, portal API routes, portal client component. Remaining after this slice: nothing — milestone S06 is the last slice.

## Verification

- Console errors on failed token validation or PDF generation. client_confirmed_at column queryable for admin dashboard. No new structured logging needed for single-user app.

## Tasks

- [x] **T01: Extract shared PDF utility and create service-role Supabase client** `est:45m`
  **Why:** The existing PDF generation logic in src/app/api/invoices/pdf/route.ts is auth-gated and tightly coupled. Portal API routes need a service-role Supabase client (since anon key can't bypass RLS on financial tables) and a reusable PDF generator.
  - Files: `src/lib/supabase/admin.ts`, `src/lib/invoice-pdf.ts`, `src/lib/portal-auth.ts`, `src/app/api/invoices/pdf/route.ts`
  - Verify: npx tsc --noEmit

- [x] **T02: Create portal PDF download and payment confirmation API routes with migration** `est:45m`
  **Why:** The portal needs two API routes: one for PDF download (token-authenticated) and one for payment confirmation. A new migration adds the `client_confirmed_at` column to invoices.
  - Files: `supabase/migrations/012_portal_confirmation.sql`, `src/app/api/portal/pdf/route.ts`, `src/app/api/portal/confirm-payment/route.ts`, `src/lib/supabase/types.ts`
  - Verify: npx tsc --noEmit

- [x] **T03: Build portal client component with download and confirm buttons** `est:45m`
  **Why:** The portal page is a pure server component. Adding interactive download/confirm buttons requires a client component. The server component must also be updated to include invoice `id` in the select and pass data + token to the client component.
  - Files: `src/app/portal/[token]/portal-client.tsx`, `src/app/portal/[token]/page.tsx`
  - Verify: npx tsc --noEmit

## Files Likely Touched

- src/lib/supabase/admin.ts
- src/lib/invoice-pdf.ts
- src/lib/portal-auth.ts
- src/app/api/invoices/pdf/route.ts
- supabase/migrations/012_portal_confirmation.sql
- src/app/api/portal/pdf/route.ts
- src/app/api/portal/confirm-payment/route.ts
- src/lib/supabase/types.ts
- src/app/portal/[token]/portal-client.tsx
- src/app/portal/[token]/page.tsx
