---
id: S06
parent: M001
milestone: M001
provides:
  - Token-authenticated portal API routes (PDF download + payment confirmation)
  - Shared PDF generator utility reusable by any route
  - Service-role Supabase admin client for bypassing RLS
  - Portal token validation helper
  - client_confirmed_at column on invoices table
requires:
  - slice: S01
    provides: Types completos para portal queries e PaymentDialog corrigido
affects:
  []
key_files:
  - src/lib/supabase/admin.ts
  - src/lib/invoice-pdf.ts
  - src/lib/portal-auth.ts
  - src/app/api/portal/pdf/route.ts
  - src/app/api/portal/confirm-payment/route.ts
  - src/app/portal/[token]/portal-client.tsx
  - src/app/portal/[token]/page.tsx
  - supabase/migrations/012_portal_confirmation.sql
key_decisions:
  - Service-role Supabase client for portal (no RLS bypass needed on anon)
  - Shared generateInvoicePDF extracted for reuse across admin and portal routes
  - Blob URL + programmatic anchor for PDF download (avoids popup blockers)
  - Local useState for confirmation state (avoids refetch, keeps portal stateless)
  - as unknown as T for Supabase FK join casts (per MEM005)
patterns_established:
  - Service-role admin client pattern for server-side routes needing RLS bypass
  - Shared utility extraction pattern: route-specific logic → lib module → multiple consumers
  - Portal token auth pattern: validate → fetch data → verify ownership → respond
observability_surfaces:
  - Console errors on failed token validation or PDF generation
  - client_confirmed_at column queryable for admin dashboard confirmation status
drill_down_paths:
  - .gsd/milestones/M001/slices/S06/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S06/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S06/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-16T19:58:24.905Z
blocker_discovered: false
---

# S06: Client Portal Melhorado

**Token-authenticated client portal with PDF download and payment confirmation via service-role API routes**

## What Happened

The slice delivered a complete client portal enhancement in three tasks:

**T01** extracted the PDF generation logic from the admin route into a shared `generateInvoicePDF` utility (`src/lib/invoice-pdf.ts`), created a service-role Supabase client (`src/lib/supabase/admin.ts`) that bypasses RLS for portal access to financial tables, and built a portal token validator (`src/lib/portal-auth.ts`). The admin PDF route was refactored to use the shared generator without functional changes.

**T02** created two portal API routes: `GET /api/portal/pdf` for token-authenticated PDF download and `POST /api/portal/confirm-payment` for marking invoices as paid by the client. A migration (`012_portal_confirmation.sql`) added the `client_confirmed_at` column to the invoices table. Both routes validate the token via service-role client, verify the invoice belongs to the authenticated client (403 if not), and return 404 for invalid tokens or missing invoices.

**T03** built the portal client component (`portal-client.tsx`) with interactive download and confirm buttons. Download uses blob URL + programmatic anchor click to avoid popup blockers. Confirmation state is tracked locally via useState for instant feedback. The server page was updated to pass invoice IDs and the token to the client component.

## Verification

- `npx tsc --noEmit` passes with zero errors across all three tasks
- All 8 key files exist and are correctly structured
- Token validation: invalid token returns 404
- Authorization: invoice not belonging to client returns 403
- Admin PDF route continues working identically using shared generator
- Portal client component has download and confirm functionality with proper state management
- Migration adds `client_confirmed_at` column for payment confirmation tracking

## Requirements Advanced

None.

## Requirements Validated

- R013 — Portal API routes authenticate via token, PDF downloads work via shared generator, payment confirmation sets client_confirmed_at. Security: invalid token→404, wrong client→403. TypeScript compiles cleanly.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

none

## Known Limitations

Portal tokens do not expire — revocation requires manual DB deletion. No email notification to admin when client confirms payment. PDF visual output depends on correct invoice data seeding.

## Follow-ups

none

## Files Created/Modified

- `src/lib/supabase/admin.ts` — Service-role Supabase client for server-side RLS bypass
- `src/lib/invoice-pdf.ts` — Shared PDF generator extracted from admin route
- `src/lib/portal-auth.ts` — Portal token validation helper
- `src/app/api/invoices/pdf/route.ts` — Refactored to use shared PDF generator
- `src/app/api/portal/pdf/route.ts` — Token-authenticated PDF download for portal
- `src/app/api/portal/confirm-payment/route.ts` — Payment confirmation endpoint setting client_confirmed_at
- `src/lib/supabase/types.ts` — Added client_confirmed_at to Invoice type
- `supabase/migrations/012_portal_confirmation.sql` — Adds client_confirmed_at column to invoices
- `src/app/portal/[token]/portal-client.tsx` — Interactive client component with download/confirm buttons
- `src/app/portal/[token]/page.tsx` — Updated server page passing data to client component
