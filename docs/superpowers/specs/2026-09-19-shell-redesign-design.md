# Shell redesign — design

**Date:** 2026-09-19
**Reference:** the "Agenda de projetos" mockup (light canvas, white sidebar, violet primary, page header with eyebrow + title + subtitle + action, calendar card).

## Goal

Make the whole app look like the mockup by changing what is shared — tokens, font, sidebar, top bar, page header, tabs, buttons — once, and rebuilding the one screen the mockup shows in full (the calendar). Every other page inherits the look through the tokens and a shared `PageHeader`; its tables, cards and dialogs are not redesigned here.

Decisions already taken with the user:

- The menu keeps all 14 entries, restyled (no regrouping).
- Dark mode stays: the mockup becomes the light theme; dark gets the same violet on dark neutrals. The theme toggle moves into the avatar menu.
- Top bar, right side: search (opens ⌘K), a bell with the count of overdue invoices and stalled NFs, and an avatar with a menu (Configurações, tema, Sair). No help icon.

## 1. Tokens and font

`src/app/globals.css` — light:

| token | value | note |
|---|---|---|
| `--background` | `220 20% 97%` | the grey canvas behind cards |
| `--card`, `--popover` | `0 0% 100%` | |
| `--foreground` | `228 22% 13%` | near-black neutral (replaces navy) |
| `--muted-foreground` | `225 10% 46%` | |
| `--muted`, `--secondary` | `220 18% 95%` | |
| `--accent` | `252 100% 96%` | lilac fill of the active nav item |
| `--accent-foreground` | `252 85% 52%` | |
| `--primary` | `252 92% 62%` (#6b4eff) | the mockup violet |
| `--border`, `--input` | `220 16% 90%` | |
| `--ring` | `252 92% 62%` | |
| `--radius` | `0.75rem` | cards 12px; buttons/chips 8px via `rounded-lg`/`rounded-md` |

Dark: `--background 228 18% 8%`, `--card 228 16% 11%`, `--border 228 12% 20%`, `--muted 228 14% 16%`, `--accent 252 40% 22%`, `--accent-foreground 252 100% 88%`, `--primary 252 95% 70%`, text `220 20% 95%` / muted `225 10% 65%`.

Chip palette (calendar and status chips), soft fill + strong text, defined as Tailwind classes in the components that use them, light/dark pairs: blue (open job / task), grey (closed job), green (worked day), amber (1st hold / working), violet (booked / today).

Font: **Manrope** via `next/font/google`, weights 400–700, `font-sans` through a CSS variable (`--font-sans`) wired in `tailwind.config.ts`. Headings keep `letter-spacing: -0.022em`; the display tier moves from light (300) to semibold (600), as in the mockup.

Buttons (`components/ui/button.tsx`): `rounded-lg` instead of pills; sizes unchanged. The `default` variant stays the only filled violet.

## 2. Shell

`src/app/(app)/layout.tsx` becomes: sidebar | column(top bar, main). Main is `bg-background overflow-y-auto`; the top bar and sidebar are `bg-card`.

**Sidebar** (`components/layout/sidebar.tsx`)
- 256px, `bg-card border-r`, collapsible to 64px (icons only, labels as `title`). Collapse button floats on the sidebar's right edge like the mockup; state in `localStorage` (`sidebar:collapsed`).
- Brand: 32px violet rounded square with "FM" in white, then "Freela Manager" semibold.
- Items (order and labels): Início `/dashboard`, Registro Diário `/logs`, Jobs `/historico` (alias `/jobs`), Clientes `/clients`, Invoices `/invoices`, Notas fiscais, E-mails, Despesas, Contabilidade, Agenda `/agenda`, Disponibilidade, Folgas, Relatórios `/reports`. Icons from lucide as today.
- Item: `h-10 rounded-lg px-3 gap-3 text-[15px]`; inactive `text-foreground/80 hover:bg-muted`; active `bg-accent text-accent-foreground font-medium`. Badges stay (overdue invoices on Invoices, stalled deals on Clientes).
- Footer: Configurações `/settings` and Sair, same item style. The ⌘K box and the theme toggle leave the sidebar (they move to the top bar / avatar menu).

**Top bar** (`components/layout/topbar.tsx`, new, client)
- `h-16 bg-card border-b px-8`, section title on the left in `text-xl font-semibold`: derived from the pathname via the nav table (detail pages show their section: `/jobs/[id]` → "Jobs"; `/contabilidade/2026-08` → "Contabilidade"; unknown → "Freela Manager").
- Right: ghost icon buttons — Search (dispatches the ⌘K keydown, as the old sidebar box did), Bell with a small dot when `overdue + stalled > 0` and a popover listing the two counts with links; Avatar (initial of the user's e-mail, violet circle) opening a dropdown with Configurações, "Modo escuro/claro" toggle, Sair.
- Badge counts move out of the sidebar into a small hook `useAttentionCounts()` used by both sidebar (badges) and bell.

`CommandPalette` keeps being mounted once, now from the top bar.

## 3. PageHeader

`components/page-header.tsx` (server-safe, no hooks):

```tsx
<PageHeader
  eyebrow="Planejamento"
  title="Agenda de projetos"
  description="Organize entregas, tarefas e períodos de trabalho em uma visão única."
  actions={<Button size="lg">Nova tarefa</Button>}
/>
```

Renders: eyebrow `text-xs font-semibold uppercase tracking-wider text-primary`, title `text-3xl font-semibold tracking-tight`, description `text-muted-foreground mt-1`, actions right-aligned and vertically centred, wrapping under on narrow screens. Margin below `mb-6`.

Page content container: pages keep their own wrappers; the ones replaced here use `px-8 py-6` (was `p-6`/`p-8` mixed) so the header sits where the mockup's does.

Mapping (eyebrow → pages):

| eyebrow | pages (title) |
|---|---|
| Visão geral | Dashboard → "Início" |
| Operação | Registro Diário (subtitle drops "/ Timesheet"), Histórico de jobs → "Jobs", job detail (title = job name), Clientes, client detail (title = client name) |
| Financeiro | Invoices, Notas fiscais, Despesas, Contabilidade, Competência …, Relatórios, Metas |
| Planejamento | Agenda de projetos (`/agenda`), Status de Agenda → "Disponibilidade", Folgas e Férias, Projetos, project detail, Diário (title = month) |
| Comunicação | Caixa de entrada, Pipeline de Vendas, Automações |
| Conta | Configurações |

Existing subtitles are kept as `description`; pages without one get a one-line description in the same voice as the mockup ("Organize…", "Acompanhe…").

The two pages with their own top bar (`logs-client.tsx`, `agenda-client.tsx`) drop it and use `PageHeader` with their primary action in `actions`.

## 4. Tabs

`components/ui/tabs.tsx`: `TabsList` becomes a transparent row with a bottom border; `TabsTrigger` is `h-10 px-1 mr-6 gap-2 text-sm text-muted-foreground border-b-2 border-transparent rounded-none`, active `text-primary border-primary`. The agenda's inline overrides are removed since the primitive now looks like that. Other tab users (`/reports`, `/settings`, `/projetos/[id]`) get the new look automatically; they are checked for fit.

## 5. Calendar (`agenda/calendar-view.tsx`)

- Card: `bg-card border rounded-xl shadow-sm overflow-hidden`.
- Header row: chevrons at the ends; centre stack "Julho 2026" (`text-lg font-semibold`, capitalised) over "Visão mensal" (`text-sm text-muted-foreground`).
- Legend row under the header, inside the card, `border-b px-5 py-2.5 text-sm`: dots + labels for Job em aberto, Job encerrado, Diária trabalhada, 1st hold, 2nd hold, Booked (the legend already exists; it moves in here and takes the new colours).
- Weekday row: `text-xs font-semibold uppercase tracking-wide text-muted-foreground`, centred.
- Grid: 7 columns, rows `min-h-[140px]`, `border-t border-l` per cell; out-of-month days `text-muted-foreground/50`; today: the number in a 28px violet circle with white text and the cell tinted `bg-accent/40`.
- Chips: `text-xs px-2 py-1 rounded-md truncate` in the soft palette; task chips keep their status colour mapped onto the palette (working → amber, done → green, stuck → red, todo → blue).
- Day click and the day dialog are unchanged.

## 6. Out of scope

New features; redesign of tables, forms and dialogs; regrouping the menu; the public portal and the login page (they get the tokens and font but no layout work).

## 7. Verification

- `tsc --noEmit`, `vitest run`, `next build`.
- Render with an authenticated session (magic-link cookie, see memory) the pages `/dashboard`, `/agenda`, `/logs`, `/historico`, `/invoices`, `/jobs/[id]`, `/settings`; assert 200 and the presence of the new header markup.
- Screenshot `/agenda` against the mockup when a browser is available.
