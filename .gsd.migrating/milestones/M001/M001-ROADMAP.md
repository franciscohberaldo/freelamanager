# M001: Polish & Consolidation

**Vision:** Transformar o Freela Manager de um app funcional mas pesado num app que o freelancer quer abrir todo dia — bugs corrigidos, navegação enxuta, visão diária como porta de entrada.

## Success Criteria

- Build TypeScript compila sem erros e zero `as any`
- Sidebar tem 9 itens com agrupamento por abas
- Dashboard do dia mostra horas hoje, tarefas, invoices vencidas, receita em risco, metas
- Payment dialog formata na moeda correta da invoice
- Cliente acessa portal via token, baixa PDF, confirma pagamento
- Cmd+K retorna resultados reais de clientes, jobs e invoices
- Listas com >25 items paginam com load more

## Slices

- [ ] **S01: Types & Bug Fixes** `risk:high` `depends:[]`
  > After this: Registrar pagamento em invoice USD — mostra valor em USD, não BRL. Build compila sem `as any`.

- [ ] **S02: Consolidar Navegacao** `risk:medium` `depends:[S01]`
  > After this: Sidebar tem 9 itens. Agenda mostra abas Tarefas/Disponibilidade/Folgas. Clientes mostra aba Pipeline. Folga criada aparece como indisponivel.

- [ ] **S03: Dashboard do Dia** `risk:medium` `depends:[S01]`
  > After this: Abrir o app mostra horas de hoje, tarefas da agenda, invoices vencidas, receita em risco, progresso das metas. Toggle alterna pra visao mensal.

- [ ] **S04: Timer & Notificacoes** `risk:low` `depends:[S02]`
  > After this: Timer para automaticamente em 8h com toast. Badge na sidebar mostra contagem de invoices vencidas e deals parados.

- [ ] **S05: Command Palette & Paginacao** `risk:low` `depends:[S01]`
  > After this: Cmd+K busca e encontra cliente por nome. Lista de logs com 50+ items mostra carregar mais apos 25.

- [ ] **S06: Client Portal Melhorado** `risk:low` `depends:[S01]`
  > After this: Cliente acessa portal via token, faz download do PDF, marca pagamento como feito.

## Boundary Map

### S01 → S02

Produces:
- Types completos em `src/lib/supabase/types.ts` cobrindo todas as tabelas
- Queries tipadas sem `as any` em todos os arquivos

Consumes:
- nothing (first slice)

### S01 → S03

Produces:
- Types completos para queries do dashboard (daily_logs, agenda_tasks, invoices, jobs, goals)

Consumes:
- nothing (first slice)

### S01 → S05

Produces:
- Types completos para queries de busca (clients, jobs, invoices)

Consumes:
- nothing (first slice)

### S01 → S06

Produces:
- Types completos para portal queries e PaymentDialog corrigido

Consumes:
- nothing (first slice)

### S02 → S04

Produces:
- Sidebar consolidada com 9 itens (onde o badge será renderizado)
- Settings page com seções adicionais (onde timer limit será configurável)

Consumes:
- Types completos de S01
