---
phase: closeout
phase_name: Milestone Completion
project: Freela Manager
generated: 2026-05-16T20:15:00.000Z
counts:
  decisions: 5
  lessons: 4
  patterns: 5
  surprises: 2
missing_artifacts: []
---

# M001 Learnings: Polish & Consolidation

### Decisions

- **D001: Tab consolidation over nested routes** — Chose shadcn/ui Tabs within existing pages to reduce sidebar from 16→9 items. Preserves simple URLs, doesn't break bookmarks. Alternatives considered: nested routes (more complex routing), dropdown menus (hides functionality).
  Source: M001-ROADMAP.md/Success Criteria

- **D006: Server/client split for dashboard** — page.tsx stays server-only for Supabase auth + parallel queries; dashboard-client.tsx manages Tab state and passes serialized props to view components. Keeps Next.js boundary clean.
  Source: S03-SUMMARY.md/Key decisions

- **D008: Hybrid SSR + client load-more pagination** — Server fetches first 25 with .range(0,24) + count:'exact'; client hook loads more. Preserves SSR first-paint while enabling incremental loading without converting to full client render.
  Source: S05-SUMMARY.md/Key decisions

- **D009: Service-role client for portal routes** — Portal uses SUPABASE_SERVICE_ROLE_KEY instead of adding public-read RLS policies to financial tables. Token validation first, then scoped data fetch. Security boundary decision (non-revisable).
  Source: S06-SUMMARY.md/Key decisions

- **D010: client_confirmed_at column for payment confirmation** — Separate from freelancer's PaymentDialog flow. Client marks they paid via timestamp; freelancer independently verifies and records actual payment.
  Source: S06-SUMMARY.md/Key decisions

### Lessons

- **Supabase FK join type mismatch requires `as unknown as T`** — Supabase codegen represents many-to-one FK joins as arrays instead of single objects. Using `as unknown as T` is safer than `as any` and correctly types the result. This affected all 15 files with FK expansion queries.
  Source: S01-SUMMARY.md/Known limitations

- **Schema reality differs from plan assumptions** — S02's availability sync adapted from per-date upserts to singleton status update because the actual schema has no date column. Always verify schema before implementing data access patterns.
  Source: S02-SUMMARY.md/Deviations

- **Timer auto-stop should reset, not save** — Hitting max hours means user forgot the timer; accumulated time is unreliable. Auto-stop resets state without persisting to DB, avoiding corrupt time data.
  Source: S04-SUMMARY.md/Key decisions

- **Pure server components need thin client wrappers for hooks** — Jobs and invoices pages were server-only. Adding pagination required new *-client.tsx wrappers to house the usePaginatedList hook, since hooks require client components.
  Source: S05-SUMMARY.md/Deviations

### Patterns

- **Server/client split pattern** — Server page.tsx fetches all data with parallel Supabase queries, serializes (ISO dates as strings), passes props to client component that manages interactivity. Used consistently in dashboard, list pages, and portal.
  Source: S03-SUMMARY.md/Patterns established

- **usePaginatedList hook** — Generic typed hook wrapping Supabase .range() with filter tuples, configurable pageSize, and LoadMoreButton companion. Server provides initialData + totalCount; hook handles subsequent pages.
  Source: S05-SUMMARY.md/Patterns established

- **Tab consolidation pattern** — Parent page renders shared header (title, actions) outside Tabs; child components imported and rendered inside TabsContent. Header stays visible regardless of active tab.
  Source: S02-SUMMARY.md/Patterns established

- **Portal token auth pattern** — validate token → fetch scoped data via service-role client → verify ownership (client_id match) → respond. Invalid token = 404, wrong client = 403.
  Source: S06-SUMMARY.md/Patterns established

- **head:true count queries for badges** — Use Supabase `head: true` with count to get badge numbers without transferring row data. Efficient for sidebar badges that only need counts.
  Source: S04-SUMMARY.md/Key decisions

### Surprises

- **28 tables instead of planned 27** — invoice_sequences was already present in the original types file and is a real table from migrations. Plan assumed 27 but actual schema has 28.
  Source: S01-SUMMARY.md/Deviations

- **Availability sync is client-side only** — The implemented solution only syncs availability for today when a folga is created/deleted. If a future folga becomes active overnight, status won't auto-update without a server-side cron or DB trigger (out of scope).
  Source: S02-SUMMARY.md/Known limitations
