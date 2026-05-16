# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R004 — Remover feature de journaling/mood (daily_journal) — código e referências na sidebar
- Class: constraint
- Status: active
- Description: Remover feature de journaling/mood (daily_journal) — código e referências na sidebar
- Why it matters: Funcionalidade redundante para freelancer — tracking de horas é essencial, journaling com mood é ruído
- Source: user
- Primary owning slice: M001/S02
- Validation: mapped

### R005 — Sidebar consolidada de 16 para 9 itens com agrupamento por abas
- Class: primary-user-loop
- Status: active
- Description: Sidebar consolidada de 16 para 9 itens com agrupamento por abas
- Why it matters: 16 itens na sidebar é pesado demais para navegação diária — freelancer precisa de acesso rápido sem clutter
- Source: user
- Primary owning slice: M001/S02
- Validation: mapped
- Notes: Agenda+Disponibilidade+Folgas; Pipeline como aba de Clientes; Diário vira Tracking em Logs; Despesas+Metas+Automações em Settings

### R006 — Dashboard do dia como tela principal — horas hoje, tarefas, invoices vencidas, receita em risco, metas
- Class: primary-user-loop
- Status: active
- Description: Dashboard do dia como tela principal — horas hoje, tarefas, invoices vencidas, receita em risco, metas
- Why it matters: Freelancer precisa abrir o app e em 5 segundos saber o que fazer hoje e se está no caminho das metas
- Source: user
- Primary owning slice: M001/S03
- Validation: mapped

### R007 — Widget de receita em risco — invoices overdue + jobs sem log recente = dinheiro que pode escapar
- Class: differentiator
- Status: active
- Description: Widget de receita em risco — invoices overdue + jobs sem log recente = dinheiro que pode escapar
- Why it matters: Freelancer perde receita por não acompanhar invoices vencidas e jobs abandonados
- Source: inferred
- Primary owning slice: M001/S03
- Validation: mapped

### R008 — Folgas bloqueia disponibilidade automaticamente — folga criada marca dia como indisponível
- Class: integration
- Status: active
- Description: Folgas bloqueia disponibilidade automaticamente — folga criada marca dia como indisponível
- Why it matters: Hoje são ilhas separadas — freelancer pode aparecer como disponível em dia de folga
- Source: inferred
- Primary owning slice: M001/S02
- Validation: mapped

### R009 — Timer auto-stop em 8h com notificação visual (toast)
- Class: continuity
- Status: active
- Description: Timer auto-stop em 8h com notificação visual (toast)
- Why it matters: Freelancer esquece timer ligado e registra 24h — corrompe dados de horas e relatórios
- Source: inferred
- Primary owning slice: M001/S04
- Validation: mapped
- Notes: Limite configurável em Settings, default 8h

### R010 — Badge de notificações na sidebar — contagem de invoices vencidas, metas atrasadas, deals parados
- Class: failure-visibility
- Status: active
- Description: Badge de notificações na sidebar — contagem de invoices vencidas, metas atrasadas, deals parados
- Why it matters: Sem notificações visuais, freelancer não percebe items que precisam de atenção urgente
- Source: inferred
- Primary owning slice: M001/S04
- Validation: mapped

### R011 — Command palette (Cmd+K) busca dados reais de clientes, jobs e invoices
- Class: primary-user-loop
- Status: active
- Description: Command palette (Cmd+K) busca dados reais de clientes, jobs e invoices
- Why it matters: Command palette existe mas não conecta com dados — atalho de navegação desperdiçado
- Source: inferred
- Primary owning slice: M001/S05
- Validation: mapped

### R012 — Paginação em todas as listas — 25 items por página com load more
- Class: operability
- Status: active
- Description: Paginação em todas as listas — 25 items por página com load more
- Why it matters: Tudo carrega de uma vez — com muitos dados a UI trava
- Source: inferred
- Primary owning slice: M001/S05
- Validation: mapped

### R013 — Client portal com download de PDF e confirmação de pagamento pelo cliente
- Class: core-capability
- Status: active
- Description: Client portal com download de PDF e confirmação de pagamento pelo cliente
- Why it matters: Portal existe mas cliente não pode baixar invoice nem confirmar que pagou — perde a utilidade de self-service
- Source: user
- Primary owning slice: M001/S06
- Validation: mapped

## Validated

### R001 — Payment dialog deve respeitar a moeda da invoice (USD, EUR, BRL) em vez de hardcodar BRL
- Class: core-capability
- Status: validated
- Description: Payment dialog deve respeitar a moeda da invoice (USD, EUR, BRL) em vez de hardcodar BRL
- Why it matters: Freelancer que cobra em USD vê pagamento registrado em BRL — dado incorreto compromete relatórios financeiros
- Source: user
- Primary owning slice: M001/S01
- Validation: PaymentDialog uses formatCurrency(amount, invoice.currency); build succeeds confirming type safety. grep confirms no hardcoded BRL in PaymentDialog.
- Notes: Bug no PaymentDialog — formata sempre em BRL ignorando invoice.currency

### R002 — Types.ts completo cobrindo todas as tabelas do Supabase (30+)
- Class: quality-attribute
- Status: validated
- Description: Types.ts completo cobrindo todas as tabelas do Supabase (30+)
- Why it matters: Apenas 8 tabelas tipadas hoje — causa 19 instâncias de `as any` e fragiliza toda a type safety do projeto
- Source: inferred
- Primary owning slice: M001/S01
- Validation: 28 tables fully typed in src/lib/supabase/types.ts with Row/Insert/Update shapes. npx tsc --noEmit exits 0.

### R003 — Zero `as any` no codebase — todas as queries tipadas corretamente
- Class: quality-attribute
- Status: validated
- Description: Zero `as any` no codebase — todas as queries tipadas corretamente
- Why it matters: as any esconde bugs em tempo de compilação que só aparecem em runtime
- Source: user
- Primary owning slice: M001/S01
- Validation: grep -rn "as any" src/ returns zero matches. npx tsc --noEmit exits 0. npx next build succeeds.

## Deferred

## Out of Scope

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | core-capability | validated | M001/S01 | none | PaymentDialog uses formatCurrency(amount, invoice.currency); build succeeds confirming type safety. grep confirms no hardcoded BRL in PaymentDialog. |
| R002 | quality-attribute | validated | M001/S01 | none | 28 tables fully typed in src/lib/supabase/types.ts with Row/Insert/Update shapes. npx tsc --noEmit exits 0. |
| R003 | quality-attribute | validated | M001/S01 | none | grep -rn "as any" src/ returns zero matches. npx tsc --noEmit exits 0. npx next build succeeds. |
| R004 | constraint | active | M001/S02 | none | mapped |
| R005 | primary-user-loop | active | M001/S02 | none | mapped |
| R006 | primary-user-loop | active | M001/S03 | none | mapped |
| R007 | differentiator | active | M001/S03 | none | mapped |
| R008 | integration | active | M001/S02 | none | mapped |
| R009 | continuity | active | M001/S04 | none | mapped |
| R010 | failure-visibility | active | M001/S04 | none | mapped |
| R011 | primary-user-loop | active | M001/S05 | none | mapped |
| R012 | operability | active | M001/S05 | none | mapped |
| R013 | core-capability | active | M001/S06 | none | mapped |

## Coverage Summary

- Active requirements: 10
- Mapped to slices: 10
- Validated: 3 (R001, R002, R003)
- Unmapped active requirements: 0
