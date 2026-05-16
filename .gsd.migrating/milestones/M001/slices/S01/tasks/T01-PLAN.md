---
estimated_steps: 16
estimated_files: 1
skills_used: []
---

# T01: Complete types.ts with all 27 tables and composite types

Why: Only 8 of 27 Supabase tables have TypeScript types in `src/lib/supabase/types.ts`. This causes 15 files to use `as any` casts because TypeScript can't infer query return shapes. Every downstream fix depends on having complete types first.

Do:
1. Read all 11 migration files to build the cumulative schema for each table (some tables are altered in later migrations — e.g., `agenda_events` gets `recurrence` and `recurrence_end` in migration 009, `clients` gets `score` in migration 010).
2. Add Row and Insert types for all 19 missing tables: `user_availability`, `projects`, `project_tasks`, `daily_journal`, `user_settings`, `expenses`, `invoice_payments`, `user_goals`, `project_task_items`, `project_templates`, `time_off`, `automation_settings`, `automation_log`, `sales_pipeline`, `client_interactions`, `client_portal_tokens`, `api_keys`, `webhooks`, `payment_links`, `webhook_deliveries`.
3. Update `AgendaEventRow` to include `recurrence` (text|null, default 'none'), `recurrence_end` (string|null).
4. Update `ClientRow` to include `score` (number|null).
5. Register all new tables in the `Database['public']['Tables']` map with Row/Insert/Update/Relationships.
6. Add composite types used by actual queries in the codebase:
   - `ProjectWithClient` = Project & { clients: Client | null }
   - `ProjectWithTasks` = Project & { clients: Client | null; project_tasks: ProjectTask[] }
   - `ProjectTaskWithItems` = ProjectTask & { project_task_items: ProjectTaskItem[] }
   - `DailyLogWithJob` already exists — verify it still matches query shapes.
   - `InvoiceWithJob` already exists — verify it still matches query shapes.
   - `AgendaEventWithJob` already exists — verify it still matches.
7. Export all new types as convenience aliases (e.g., `export type Project = Database['public']['Tables']['projects']['Row']`).

Done when: `npx tsc --noEmit` runs without errors on `src/lib/supabase/types.ts` itself. All 27 tables appear in the Database type map.

## Inputs

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
- `src/lib/supabase/types.ts`

## Expected Output

- `src/lib/supabase/types.ts`

## Verification

npx tsc --noEmit
