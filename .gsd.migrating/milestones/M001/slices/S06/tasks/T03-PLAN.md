---
estimated_steps: 14
estimated_files: 2
skills_used: []
---

# T03: Build portal client component with download and confirm buttons

**Why:** The portal page is a pure server component. Adding interactive download/confirm buttons requires a client component. The server component must also be updated to include invoice `id` in the select and pass data + token to the client component.

**Do:**
1. Create `src/app/portal/[token]/portal-client.tsx` as a client component:
   - Props: `invoices` (array with id, invoice_number, total, currency, status, period_start, period_end, due_date, client_confirmed_at), `token` (string).
   - Each invoice row renders:
     a. Download PDF button — calls `/api/portal/pdf?token=xxx&invoice_id=yyy`, opens response as blob URL.
     b. Confirm payment button — visible only for invoices with status `sent` or `overdue` and no `client_confirmed_at`. POST to `/api/portal/confirm-payment`. On success, updates local state to show 'Confirmado' badge.
   - Use existing UI patterns from the portal page (rounded cards, status badges, formatCurrency).
   - Show loading state during download/confirm actions.
2. Update `src/app/portal/[token]/page.tsx`:
   - Add `id` and `client_confirmed_at` to the invoices select query.
   - Replace the static invoices section with the new `<PortalInvoices>` client component.
   - Pass serializable invoice data and token as props.

**Done when:** Portal page renders download/confirm buttons. Clicking download triggers PDF fetch. Clicking confirm sends POST and updates UI. `npx tsc --noEmit` passes.

## Inputs

- `src/app/portal/[token]/page.tsx`
- `src/app/api/portal/pdf/route.ts`
- `src/app/api/portal/confirm-payment/route.ts`

## Expected Output

- `src/app/portal/[token]/portal-client.tsx`
- `src/app/portal/[token]/page.tsx`

## Verification

npx tsc --noEmit
