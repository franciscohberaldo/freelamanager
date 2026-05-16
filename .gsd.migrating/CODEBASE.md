# Codebase Map

Generated: 2026-05-16T12:22:18Z | Files: 139 | Described: 0/139
<!-- gsd:codebase-meta {"generatedAt":"2026-05-16T12:22:18Z","fingerprint":"2b94a8d26f9cf1556fe46b832e7f1fe2ff0056a8","fileCount":139,"truncated":false} -->

### (root)/
- `.gitignore`
- `DOCUMENTACAO.md`
- `next.config.mjs`
- `package-lock.json`
- `package.json`
- `postcss.config.mjs`
- `tailwind.config.ts`
- `tsconfig.json`
- `vercel.json`

### .gsd.migrating/
- `.gsd.migrating/gsd.db`
- `.gsd.migrating/gsd.db-shm`
- `.gsd.migrating/gsd.db-wal`

### .gsd.migrating/runtime/
- `.gsd.migrating/runtime/write-gate-state.json`

### public/
- `public/sw.js`

### src/
- `src/middleware.ts`

### src/app/
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/manifest.ts`
- `src/app/page.tsx`

### src/app/(app)/
- `src/app/(app)/layout.tsx`

### src/app/(app)/agenda/
- `src/app/(app)/agenda/agenda-client.tsx`
- `src/app/(app)/agenda/calendar-view.tsx`
- `src/app/(app)/agenda/gantt-view.tsx`
- `src/app/(app)/agenda/page.tsx`
- `src/app/(app)/agenda/table-view.tsx`
- `src/app/(app)/agenda/task-dialog.tsx`
- `src/app/(app)/agenda/timeline-view.tsx`

### src/app/(app)/automacoes/
- `src/app/(app)/automacoes/automacoes-client.tsx`
- `src/app/(app)/automacoes/page.tsx`

### src/app/(app)/clients/
- `src/app/(app)/clients/client-dialog.tsx`
- `src/app/(app)/clients/page.tsx`

### src/app/(app)/clients/[id]/
- `src/app/(app)/clients/[id]/client-detail-client.tsx`
- `src/app/(app)/clients/[id]/page.tsx`

### src/app/(app)/dashboard/
- `src/app/(app)/dashboard/dashboard-charts.tsx`
- `src/app/(app)/dashboard/forecast-chart.tsx`
- `src/app/(app)/dashboard/page.tsx`

### src/app/(app)/despesas/
- `src/app/(app)/despesas/despesas-client.tsx`
- `src/app/(app)/despesas/page.tsx`

### src/app/(app)/diario/
- `src/app/(app)/diario/journal-client.tsx`
- `src/app/(app)/diario/page.tsx`
- `src/app/(app)/diario/tracking-client.tsx`

### src/app/(app)/disponibilidade/
- `src/app/(app)/disponibilidade/availability-client.tsx`
- `src/app/(app)/disponibilidade/page.tsx`

### src/app/(app)/folgas/
- `src/app/(app)/folgas/folgas-client.tsx`
- `src/app/(app)/folgas/page.tsx`

### src/app/(app)/invoices/
- `src/app/(app)/invoices/create-invoice-dialog.tsx`
- `src/app/(app)/invoices/invoice-actions.tsx`
- `src/app/(app)/invoices/page.tsx`

### src/app/(app)/jobs/
- `src/app/(app)/jobs/job-dialog.tsx`
- `src/app/(app)/jobs/page.tsx`

### src/app/(app)/logs/
- `src/app/(app)/logs/log-dialog.tsx`
- `src/app/(app)/logs/log-filters.tsx`
- `src/app/(app)/logs/log-timer-button.tsx`
- `src/app/(app)/logs/logs-client.tsx`
- `src/app/(app)/logs/page.tsx`

### src/app/(app)/metas/
- `src/app/(app)/metas/metas-client.tsx`
- `src/app/(app)/metas/page.tsx`

### src/app/(app)/pipeline/
- `src/app/(app)/pipeline/page.tsx`
- `src/app/(app)/pipeline/pipeline-client.tsx`

### src/app/(app)/projetos/
- `src/app/(app)/projetos/page.tsx`
- `src/app/(app)/projetos/projects-client.tsx`

### src/app/(app)/projetos/[id]/
- `src/app/(app)/projetos/[id]/gantt-chart.tsx`
- `src/app/(app)/projetos/[id]/kanban-board.tsx`
- `src/app/(app)/projetos/[id]/page.tsx`
- `src/app/(app)/projetos/[id]/project-client.tsx`

### src/app/(app)/reports/
- `src/app/(app)/reports/heatmap.tsx`
- `src/app/(app)/reports/page.tsx`
- `src/app/(app)/reports/reports-charts.tsx`
- `src/app/(app)/reports/reports-client.tsx`

### src/app/(app)/settings/
- `src/app/(app)/settings/api-keys-panel.tsx`
- `src/app/(app)/settings/company-form.tsx`
- `src/app/(app)/settings/export-button.tsx`
- `src/app/(app)/settings/page.tsx`
- `src/app/(app)/settings/settings-form.tsx`
- `src/app/(app)/settings/webhooks-panel.tsx`

### src/app/(auth)/
- `src/app/(auth)/layout.tsx`

### src/app/(auth)/login/
- `src/app/(auth)/login/page.tsx`

### src/app/api/api-keys/
- `src/app/api/api-keys/route.ts`

### src/app/api/auth/signout/
- `src/app/api/auth/signout/route.ts`

### src/app/api/cron/billing-reminders/
- `src/app/api/cron/billing-reminders/route.ts`

### src/app/api/cron/recurring-invoices/
- `src/app/api/cron/recurring-invoices/route.ts`

### src/app/api/cron/weekly-summary/
- `src/app/api/cron/weekly-summary/route.ts`

### src/app/api/export/
- `src/app/api/export/route.ts`

### src/app/api/invoices/ai-description/
- `src/app/api/invoices/ai-description/route.ts`

### src/app/api/invoices/payment-link/
- `src/app/api/invoices/payment-link/route.ts`

### src/app/api/invoices/pdf/
- `src/app/api/invoices/pdf/route.ts`

### src/app/api/invoices/send-email/
- `src/app/api/invoices/send-email/route.ts`

### src/app/api/v1/
- `src/app/api/v1/route.ts`

### src/app/api/v1/clients/
- `src/app/api/v1/clients/route.ts`

### src/app/api/v1/expenses/
- `src/app/api/v1/expenses/route.ts`

### src/app/api/v1/invoices/
- `src/app/api/v1/invoices/route.ts`

### src/app/api/v1/jobs/
- `src/app/api/v1/jobs/route.ts`

### src/app/api/v1/logs/
- `src/app/api/v1/logs/route.ts`

### src/app/api/webhooks/stripe/
- `src/app/api/webhooks/stripe/route.ts`

### src/app/api/webhooks/test/
- `src/app/api/webhooks/test/route.ts`

### src/app/icon-192.png/
- `src/app/icon-192.png/route.tsx`

### src/app/icon-512.png/
- `src/app/icon-512.png/route.tsx`

### src/app/offline/
- `src/app/offline/page.tsx`

### src/app/portal/[token]/
- `src/app/portal/[token]/page.tsx`

### src/components/
- `src/components/command-palette.tsx`
- `src/components/csv-export-button.tsx`
- `src/components/sw-register.tsx`
- `src/components/theme-provider.tsx`

### src/components/layout/
- `src/components/layout/sidebar.tsx`

### src/components/ui/
- `src/components/ui/badge.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/sonner.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/textarea.tsx`

### src/lib/
- `src/lib/api-auth.ts`
- `src/lib/csv.ts`
- `src/lib/invoice-i18n.ts`
- `src/lib/utils.ts`
- `src/lib/webhook-events.ts`
- `src/lib/webhooks.ts`

### src/lib/supabase/
- `src/lib/supabase/client.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/types.ts`

### supabase/migrations/
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_agenda_tasks.sql`
- `supabase/migrations/003_availability.sql`
- `supabase/migrations/004_projects.sql`
- `supabase/migrations/005_journal.sql`
- `supabase/migrations/006_user_settings.sql`
- `supabase/migrations/007_financeiro.sql`
- `supabase/migrations/008_projetos_avancado.sql`
- `supabase/migrations/009_automacoes.sql`
- `supabase/migrations/010_crm.sql`
- `supabase/migrations/011_plataforma.sql`
