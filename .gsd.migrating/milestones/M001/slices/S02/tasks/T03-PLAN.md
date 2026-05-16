---
estimated_steps: 8
estimated_files: 3
skills_used: []
---

# T03: Consolidate Clients page with Pipeline tab

Why: R005 — Pipeline is a CRM view tied to clients. Embedding it as a tab in /clients reduces sidebar items and co-locates related concerns.

Do:
1. Convert src/app/(app)/clients/page.tsx from a pure server component to a layout that wraps content in Tabs. The default tab ("Clientes") shows the existing client list. A second tab ("Pipeline") renders PipelineClient.
2. In the server component: add sales_pipeline query (same as pipeline/page.tsx) to the existing Promise.all. Pass deals and clients to a new ClientsPageClient component.
3. Create src/app/(app)/clients/clients-page-client.tsx: a client component that renders Tabs with two TabsContent blocks — one for the client list (inline the existing JSX) and one for <PipelineClient deals={deals} clients={clients} />.
4. Import Tabs/TabsList/TabsTrigger/TabsContent from @/components/ui/tabs and PipelineClient from the pipeline directory.
5. Keep /pipeline route functional — do not delete pipeline/page.tsx.

Done when: /clients renders two tabs (Clientes, Pipeline). Pipeline tab shows Kanban board. npx tsc --noEmit exits 0.

## Inputs

- `src/app/(app)/clients/page.tsx`
- `src/app/(app)/pipeline/page.tsx`
- `src/app/(app)/pipeline/pipeline-client.tsx`
- `src/app/(app)/clients/client-dialog.tsx`
- `src/components/ui/tabs.tsx`

## Expected Output

- `src/app/(app)/clients/page.tsx`
- `src/app/(app)/clients/clients-page-client.tsx`

## Verification

npx tsc --noEmit
