# M001: Polish & Consolidation

**Gathered:** 2026-05-15
**Status:** Ready for planning

## Project Description

Polimento e consolidação do Freela Manager — corrigir bugs que comprometem dados financeiros, simplificar a navegação de 16 para 9 itens na sidebar, adicionar um Dashboard do Dia como tela principal, e implementar features utilitárias (timer com limite, notificações, command palette funcional, paginação, melhorias no client portal).

## Why This Milestone

O app funciona mas tem problemas que corroem confiança: pagamento registrado na moeda errada, tipos frágeis que escondem bugs, e uma navegação pesada demais para uso diário. Falta a visão de "o que fazer agora" — o caso de uso mais frequente de um freelancer. Esse milestone transforma um app funcional num app que o freelancer quer abrir todo dia.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Abrir o app e ver imediatamente o que tem pra fazer hoje, quanto já trabalhou, e se está no caminho das metas
- Navegar entre 9 itens claros na sidebar em vez de 16
- Registrar pagamento em invoice USD e ver o valor formatado corretamente em USD
- Buscar clientes, jobs e invoices via Cmd+K
- Compartilhar link do portal com cliente que pode baixar PDF e confirmar pagamento

### Entry point / environment

- Entry point: http://localhost:3000 (dev) / URL Vercel (prod)
- Environment: browser (desktop)
- Live dependencies involved: Supabase (PostgreSQL + Auth), Vercel (deploy + crons), Resend (emails)

## Completion Class

- Contract complete means: Build TypeScript compila sem erros e sem `as any`; todas as rotas consolidadas respondem corretamente
- Integration complete means: Sidebar navega para todas as telas agrupadas; dashboard do dia consulta dados reais do Supabase
- Operational complete means: App funciona em produção na Vercel com todas as mudanças

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- Freelancer abre o app, vê dashboard do dia com dados reais, navega pela sidebar consolidada, registra pagamento em moeda correta
- Cliente acessa portal via token, baixa PDF de invoice, confirma pagamento
- Command palette retorna resultados reais de busca
- Timer para automaticamente após 8h

## Architectural Decisions

### Sidebar consolidation strategy

**Decision:** Agrupar telas por abas dentro de páginas existentes em vez de criar nova hierarquia de rotas

**Rationale:** Mantém URLs simples, não quebra bookmarks existentes, e usa o componente Tabs do shadcn/ui que já está no projeto

**Alternatives Considered:**
- Nested routes com layout groups — mais complexo, requer refactor de layouts
- Dropdown menus na sidebar — esconde funcionalidades, pior discoverability

### Dashboard do dia como página principal

**Decision:** `/dashboard` mostra visão do dia por padrão com toggle para visão mensal (dashboard atual)

**Rationale:** Freelancer precisa da visão diária como porta de entrada; visão mensal continua acessível mas não é o default

**Alternatives Considered:**
- Rota separada `/hoje` — fragmenta a experiência, dois dashboards competindo
- Widget no topo do dashboard atual — não dá destaque suficiente à visão diária

### Error handling defaults

**Decision:** Toast com mensagem genérica pro usuário + log no console para debug; estados vazios amigáveis; TypeScript strict mode

**Rationale:** App é single-user, erros são majoritariamente de query/rede — toast + console é suficiente sem over-engineering

**Alternatives Considered:**
- Error boundaries por seção — overkill para app single-user
- Sentry/error tracking — adiciona dependência externa desnecessária nesse estágio

## Error Handling Strategy

- Erros de query/banco: toast com mensagem genérica pro usuário, log detalhado no console
- Timer esquecido: auto-stop em 8h com toast de notificação
- Dashboard do dia sem dados: estados vazios amigáveis ("Nenhuma tarefa hoje", "Comece registrando suas horas")
- Types: erros de tipo quebram o build (strict mode)
- Command palette sem resultados: sugestão ("Tente buscar por cliente, job ou invoice")
- Paginação: 25 items por página como default, load more button

## Risks and Unknowns

- types.ts incompleto é raiz de vários `as any` — precisa ser resolvido primeiro porque afeta todas as slices
- Consolidação da sidebar muda organização de rotas — pode quebrar links/bookmarks
- Dashboard do dia precisa de queries eficientes para não ficar lento (múltiplas tabelas consultadas)

## Existing Codebase / Prior Art

- `src/lib/supabase/types.ts` — Tipos parciais do Supabase (8 de 30+ tabelas)
- `src/components/layout/sidebar.tsx` — Sidebar atual com 16 itens
- `src/app/(app)/dashboard/page.tsx` — Dashboard mensal existente
- `src/app/(app)/invoices/invoice-actions.tsx` — PaymentDialog com bug de moeda
- `src/components/command-palette.tsx` — Command palette sem dados reais
- `src/app/portal/[token]/page.tsx` — Client portal funcional mas sem download PDF/confirmação
- `src/app/(app)/logs/log-timer-button.tsx` — Timer sem limite máximo
- `src/app/(app)/diario/` — Journaling/mood a ser removido

## Relevant Requirements

- R001-R003 — Type safety e bug fixes como fundação
- R004-R005, R008 — Consolidação da navegação e integração folgas/disponibilidade
- R006-R007 — Dashboard do dia e receita em risco
- R009-R010 — Timer e notificações
- R011-R012 — Command palette e paginação
- R013 — Client portal melhorado

## Scope

### In Scope

- Corrigir bug de currency no PaymentDialog
- Completar types.ts para todas as tabelas do Supabase
- Eliminar todos os `as any` do codebase
- Remover journaling/mood (daily_journal)
- Consolidar sidebar de 16 para 9 itens
- Integrar folgas com disponibilidade
- Dashboard do dia como tela principal
- Widget receita em risco
- Timer auto-stop 8h configurável
- Badge de notificações na sidebar
- Command palette com busca real
- Paginação em listas longas
- Client portal: download PDF + confirmação de pagamento

### Out of Scope / Non-Goals

- Migração de infra (fica no Supabase)
- Features novas: NF-e, Stripe/Mercado Pago, multi-user, WhatsApp, browser extension
- Mobile-first redesign
- Test suite formal
- Sync Google Calendar
- Modo offline completo

## Technical Constraints

- Supabase free tier (com keep-alive cron configurado)
- Next.js 14 App Router
- shadcn/ui como design system
- Sem breaking changes nas API v1 routes

## Integration Points

- Supabase — Banco de dados e auth (todas as queries passam por supabase-js)
- Vercel — Deploy e cron jobs
- Resend — Envio de emails de invoice
- jsPDF — Geração de PDF para portal do cliente

## Testing Requirements

Build TypeScript compila sem erros. Verificação visual em browser para cada feature. Sem test suite formal (projeto não tem testes hoje).

## Acceptance Criteria

- Build compila limpo sem `as any`
- Sidebar mostra 9 itens; agrupamentos funcionam com abas
- Dashboard do dia mostra horas hoje, tarefas, invoices vencidas, receita em risco, metas
- Payment dialog formata na moeda correta da invoice
- Timer para em 8h com toast
- Badge mostra contagem real de pendências
- Cmd+K retorna clientes, jobs, invoices
- Listas com >25 items paginam
- Cliente acessa portal, baixa PDF, confirma pagamento

## Open Questions

- Nenhuma questão aberta — escopo confirmado pelo usuário
