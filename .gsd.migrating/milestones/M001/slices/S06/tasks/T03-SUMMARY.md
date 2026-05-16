---
id: T03
parent: S06
milestone: M001
key_files:
  - src/app/portal/[token]/portal-client.tsx
  - src/app/portal/[token]/page.tsx
key_decisions:
  - Used blob URL + programmatic anchor click for PDF download (avoids window.open popup blockers)
  - Tracked confirmed state locally via useState rather than refetching to keep the portal stateless and fast
  - Removed INV_STATUS from server page since rendering moved to client component
duration: 
verification_result: passed
completed_at: 2026-05-16T19:56:25.181Z
blocker_discovered: false
---

# T03: Built portal client component with PDF download and payment confirmation buttons, integrated into server page

**Built portal client component with PDF download and payment confirmation buttons, integrated into server page**

## What Happened

Created `portal-client.tsx` as a client component with two interactive actions per invoice row:\n\n1. **Download PDF** — fetches `/api/portal/pdf?token=xxx&invoice_id=yyy`, creates a blob URL, and triggers a file download via programmatic anchor click. Shows "Baixando..." loading state.\n\n2. **Confirm payment** — visible only for invoices with status `sent` or `overdue` that haven't been confirmed yet. POSTs to `/api/portal/confirm-payment` and on success updates local state to show a "Confirmado" badge. Shows "Confirmando..." loading state.\n\nUpdated the server page (`page.tsx`) to:\n- Add `id` and `client_confirmed_at` to the invoices select query\n- Replace the static invoices rendering with the `<PortalInvoices>` client component\n- Remove the now-unused `INV_STATUS` constant\n- Pass serializable invoice data and token as props

## Verification

Ran `npx tsc --noEmit` — passed with zero errors. All types correctly aligned between server page props and client component interface.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | pass | 8000ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/app/portal/[token]/portal-client.tsx`
- `src/app/portal/[token]/page.tsx`
