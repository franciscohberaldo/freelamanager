# Freela Manager — Documentação Completa

> Sistema de gestão para freelancers: clientes, jobs, registro de horas, invoices, agenda e disponibilidade.

---

## Índice

1. [Stack Tecnológica](#stack-tecnológica)
2. [Variáveis de Ambiente](#variáveis-de-ambiente)
3. [Regra de Negócio Principal](#regra-de-negócio-principal)
4. [Funcionalidades Implementadas](#funcionalidades-implementadas)
5. [API Routes](#api-routes)
6. [Banco de Dados](#banco-de-dados)
7. [Estrutura de Arquivos](#estrutura-de-arquivos)
8. [Fluxos Principais](#fluxos-principais)
9. [Observações Técnicas](#observações-técnicas)
10. [Roadmap de Evolução — 30 Funcionalidades](#roadmap-de-evolução--30-funcionalidades)
11. [Implementação em Fases](#implementação-em-fases)

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router) |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth (email/password) |
| Estilização | Tailwind CSS + shadcn/ui + Radix UI |
| Gráficos | Recharts |
| PDF | jsPDF + jspdf-autotable |
| E-mail | Resend API |
| Data/hora | date-fns (locale pt-BR) |
| Ícones | Lucide React |
| Notificações | Sonner (toast) |
| Tema | next-themes (dark/light mode) |
| Deploy | Vercel (CI/CD via GitHub) |

---

## Variáveis de Ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=         # URL do projeto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Chave anon pública do Supabase
NEXT_PUBLIC_SITE_URL=             # URL do app (ex: https://seu-app.vercel.app)
RESEND_API_KEY=                   # Chave da API Resend para envio de e-mail
RESEND_FROM_EMAIL=                # E-mail remetente (ex: invoices@seudominio.com)
```

---

## Regra de Negócio Principal

> **Invoice sempre calculado sobre `hours_billed` (horas contratadas), NUNCA sobre `hours_worked` (horas trabalhadas).**
>
> Fórmula: `total = hours_billed × hourly_rate`
>
> `hours_worked` serve apenas para controle interno de tempo real. `hours_billed` é o que vai para a fatura.

---

## Funcionalidades Implementadas

### 1. Login / Cadastro — `/login`

Página pública de acesso ao sistema.

**Modos:**
- **Entrar** — e-mail + senha, redireciona para o dashboard
- **Criar conta** — nome, e-mail, senha, confirmação. Se o Supabase não exigir confirmação de e-mail, entra direto. Caso contrário, exibe tela "Verifique seu e-mail"

**Tratamento de erros:**
- E-mail não confirmado → mensagem explicativa
- Credenciais inválidas → toast de erro
- Rate limit (429) → após muitas tentativas; aguardar ~1h ou usar outro e-mail
- Links expirados → captura `?error=` da URL e exibe toast

> **Configuração recomendada:** Desativar "Enable email confirmations" em _Supabase → Authentication → Settings_ para uso pessoal.

---

### 2. Dashboard — `/dashboard`

Visão geral mensal do negócio.

**KPIs:**
- Total faturado no mês (`hours_billed × hourly_rate`)
- Total de horas trabalhadas
- Jobs ativos
- Invoices pendentes (draft + sent)

**Gráficos:**
- Receita nos últimos 6 meses (AreaChart)
- Horas trabalhadas nos últimos 6 meses (BarChart)

**Listas:**
- Últimas 5 invoices criadas com status
- Próximos eventos da agenda (deadlines, entregas, reuniões)

---

### 3. Clientes — `/clients`

Cadastro e gerenciamento de clientes.

**Campos:** nome, empresa, e-mail, telefone, observações

**Funcionalidades:**
- Listar todos os clientes com contagem de jobs
- Criar e editar via dialog
- Contatos adicionais por cliente (nome, cargo, e-mail, telefone)

---

### 4. Jobs — `/jobs`

Projetos/contratos vinculados a clientes.

**Campos:**
- Nome, descrição, cliente
- Taxa horária (`hourly_rate`) e taxa diária (`daily_rate`)
- Moeda: BRL, USD ou EUR
- Status: `proposal` / `active` / `paused` / `completed`
- Valor do contrato, data início/fim
- Recorrente (flag), alíquota de imposto (`tax_rate`), observações

**Funcionalidades:**
- Listar com badge de status colorido
- Criar e editar via dialog
- Taxa horária é a base para cálculo de invoices

---

### 5. Registro Diário — `/logs`

Timesheet diário — controle de horas por job.

**Campos de cada registro:**
- Job + data
- Reuniões realizadas (texto livre)
- O que foi pedido/entregue (texto livre)
- `hours_worked` — horas efetivamente trabalhadas
- `hours_billed` — horas a serem cobradas (base da invoice)
- `total_value` — calculado automaticamente (`hours_billed × hourly_rate`)

**Funcionalidades:**
- Tabela: DATA, JOB, CLIENTE, DESCRIÇÃO, HORAS, STATUS
- Barra de estatísticas: total de horas, quantidade de registros, valor estimado
- Busca em tempo real (job, cliente, reuniões, pedidos)
- Navegação por mês (anterior/próximo)
- **Timer ao vivo por registro** — Play/Pause/Stop; ao parar, soma tempo ao `hours_worked`
- **Timer global** — "Iniciar timer" no topo abre dialog de criação com timer embutido
- Criar, editar e duplicar registros
- Status: "Concluído" (verde) se `hours_billed > 0`, "Em andamento" (azul) caso contrário

---

### 6. Invoices — `/invoices`

Geração e gestão de faturas.

**Campos:**
- Número sequencial automático por ano (ex: `2024-001`)
- Job e período (data início/fim)
- Total de horas faturadas, subtotal, imposto, total
- Moeda, data de vencimento
- Status: `draft` / `sent` / `paid` / `overdue`
- Observações

**Fluxo de criação:**
1. Selecionar job, período, data de vencimento
2. Sistema busca todos os `daily_logs` do período
3. Preview mostra cada log como linha de item
4. Ao confirmar: cria `invoice` + `invoice_items`
5. Numeração via função PostgreSQL `get_next_invoice_number`

**Ações por invoice:**
- Baixar PDF (PT ou EN) — `/api/invoices/pdf?id=X&lang=pt|en`
- Enviar por e-mail (PT ou EN) — via Resend
- Marcar como pago — atualiza status e `paid_at`

**PDF inclui:** número, dados do cliente, tabela de itens, totais, observações

**E-mail:** template HTML bilíngue, atualiza `status = 'sent'` e `sent_at`

---

### 7. Acompanhamento de Jobs (Agenda) — `/agenda`

Gestão de tarefas e marcos de projetos no estilo Monday.com.

**Tipos:** `payment` / `delivery` / `meeting` / `milestone` / `deadline`

**Campos:** título, descrição, job vinculado, `event_date`, `start_date`, status, prioridade, orçamento, `files_count`

**4 Visualizações:**

| View | Descrição |
|---|---|
| **Tabela** | Agrupada por status. Colunas: Tarefa, Status, Prazo, Orçamento, Timeline, Prioridade. Clique no status para alternar |
| **Timeline** | Lista cronológica por mês com cards coloridos |
| **Gantt** | SVG com barras por tarefa, linha de "hoje", cores por status |
| **Calendário** | Grade mensal, chips coloridos por dia, navegação por mês |

**Status de tarefa:** `todo` / `working_on_it` / `stuck` / `done`
**Prioridade:** `low` / `medium` / `high`

---

### 8. Status de Agenda — `/disponibilidade`

Configuração de disponibilidade do freelancer para novos projetos.

| Status | Cor | Significado |
|---|---|---|
| Disponível | Verde | Aceito novos projetos |
| Parcialmente disponível | Amarelo | Capacidade limitada |
| Ocupado | Laranja | Sem disponibilidade no momento |
| Indisponível | Vermelho | Fora de serviço |

**Campos:** disponível a partir de, horas/semana, dias de trabalho (toggle por dia), mensagem para clientes, aceitar novos contatos (toggle)

**Comportamento:** upsert — um único registro por usuário, exibe data/hora da última atualização

---

### 9. Relatórios — `/reports`

Análise financeira anual.

**KPIs:** total faturado, total recebido (invoices pagas), horas faturadas, eficiência de cobrança (%)

**Visualizações:**
- Evolução mensal de receita e horas (gráfico composto)
- Receita por job com barras proporcionais
- Seletor de ano (atual ± 1)

---

### 10. Configurações — `/settings`

**Funcionalidades:**
- Exibe e-mail e ID do usuário
- Alterar senha
- Status das integrações: Supabase (sempre ativo), Resend (indica se `RESEND_API_KEY` está configurado)

---

## API Routes

### `GET /api/invoices/pdf`
Gera PDF da invoice. Params: `id` (invoice ID), `lang` (`pt` ou `en`).
Retorna `application/pdf`. Requer autenticação.

### `POST /api/invoices/send-email`
Envia invoice por e-mail via Resend.
Body: `{ invoiceId: string, lang: "pt" | "en" }`.
Atualiza `status = 'sent'` e `sent_at`. Requer e-mail do cliente cadastrado.

### `POST /api/auth/signout`
Encerra a sessão e redireciona para `/login`.

---

## Banco de Dados

### Tabela: `clients`
```
id, user_id, name, company, email, phone, notes, created_at, updated_at
```

### Tabela: `client_contacts`
```
id, client_id, name, role, email, phone, created_at
```

### Tabela: `jobs`
```
id, user_id, client_id, name, description,
hourly_rate, daily_rate, currency,
status, contract_value, start_date, end_date,
is_recurring, tax_rate, notes, created_at, updated_at
```

### Tabela: `daily_logs`
```
id, user_id, job_id, date,
meetings, requests,
daily_rate, hours_worked, hours_billed, total_value,
created_at, updated_at
```

### Tabela: `invoices`
```
id, user_id, job_id, invoice_number,
period_start, period_end,
total_hours_billed, subtotal, tax_rate, tax_amount, total,
currency, status, sent_at, paid_at, due_date, notes,
created_at, updated_at
```

### Tabela: `invoice_items`
```
id, invoice_id, log_id, date, description, hours_billed, rate, subtotal
```

### Tabela: `invoice_sequences`
```
id, user_id, year, last_seq
```
> Garante numeração sequencial de invoices por ano (ex: `2024-001`)

### Tabela: `agenda_events`
```
id, user_id, job_id, title, description,
type, event_date, is_done,
task_status, priority, budget, start_date, files_count,
created_at, updated_at
```

### Tabela: `user_availability`
```
id, user_id, status,
available_from, hours_per_week, working_days[],
message, accepting_projects, updated_at
```

### Função PostgreSQL: `get_next_invoice_number(p_user_id, p_year)`
Incrementa e retorna o próximo número sequencial de invoice. Thread-safe via lock.

### Row Level Security (RLS)
Todas as tabelas têm RLS ativo. Cada usuário acessa **apenas seus próprios dados** via `auth.uid() = user_id`.

### Migrations
| Arquivo | Conteúdo |
|---|---|
| `001_initial_schema.sql` | Schema completo: todas as tabelas, RLS, triggers, índices, função `get_next_invoice_number` |
| `002_agenda_tasks.sql` | Adiciona `task_status`, `priority`, `budget`, `start_date`, `files_count` à `agenda_events` |
| `003_availability.sql` | Cria tabela `user_availability` com RLS |

---

## Estrutura de Arquivos

```
FreelancerAdmin/
├── src/
│   ├── app/
│   │   ├── (app)/                        # Rotas protegidas (requer auth)
│   │   │   ├── layout.tsx                # Layout com sidebar
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx
│   │   │   │   └── client-dialog.tsx
│   │   │   ├── jobs/
│   │   │   │   ├── page.tsx
│   │   │   │   └── job-dialog.tsx
│   │   │   ├── logs/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── logs-client.tsx       # Tabela + busca + totais
│   │   │   │   ├── log-dialog.tsx        # Create/edit/duplicate + timer embutido
│   │   │   │   └── log-timer-button.tsx  # Timer inline por registro
│   │   │   ├── invoices/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── create-invoice-dialog.tsx
│   │   │   │   └── invoice-actions.tsx   # Dropdown PDF/email/pago
│   │   │   ├── agenda/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── agenda-client.tsx     # Tabs das 4 views
│   │   │   │   ├── table-view.tsx
│   │   │   │   ├── timeline-view.tsx
│   │   │   │   ├── gantt-view.tsx
│   │   │   │   ├── calendar-view.tsx
│   │   │   │   └── task-dialog.tsx
│   │   │   ├── disponibilidade/
│   │   │   │   ├── page.tsx
│   │   │   │   └── availability-client.tsx
│   │   │   ├── reports/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── (auth)/
│   │   │   └── login/page.tsx            # Login + cadastro + confirmação
│   │   ├── api/
│   │   │   ├── auth/signout/route.ts
│   │   │   └── invoices/
│   │   │       ├── pdf/route.ts          # Gera PDF com jsPDF
│   │   │       └── send-email/route.ts   # Envia e-mail via Resend
│   │   ├── icon-192.png/route.tsx        # Ícone PWA gerado via next/og
│   │   ├── icon-512.png/route.tsx
│   │   ├── manifest.ts                   # PWA manifest (Next.js convention)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── layout/sidebar.tsx
│   │   ├── ui/                           # Componentes shadcn/ui
│   │   └── theme-provider.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                 # Browser client (sem generic <Database>)
│   │   │   ├── server.ts                 # Server client com cookie handling
│   │   │   ├── middleware.ts             # Auth token refresh
│   │   │   └── types.ts                 # Tipos TS de todas as tabelas
│   │   ├── utils.ts                      # formatCurrency, formatHours, calculateTotal
│   │   └── invoice-i18n.ts              # Traduções PT/EN para PDF e e-mail
│   └── middleware.ts                     # Proteção de rotas Next.js
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_agenda_tasks.sql
│       └── 003_availability.sql
└── DOCUMENTACAO.md
```

---

## Fluxos Principais

### Criar e Enviar Invoice
```
/jobs       → criar job com hourly_rate e cliente
/logs       → registrar horas diárias (hours_billed)
/invoices   → "Nova Invoice" → selecionar job + período
             Sistema busca logs → preview com totais
             Confirmar → invoice criada com número automático
             Ações → Baixar PDF (PT/EN) ou Enviar por e-mail
             Após recebimento → "Marcar como pago"
```

### Controle de Tempo
```
/logs       → linha do registro → clicar ▶ Timer
             Timer ao vivo com contagem de segundos
             ⏸ Pausar → retomar depois
             ⏹ Parar → soma ao hours_worked automaticamente
             Editar registro → ajustar hours_billed se necessário
```

### Acompanhamento de Projeto
```
/agenda     → "Nova tarefa" → vincular ao job, prazo, prioridade
             Acompanhar status no quadro (estilo Monday.com)
             Alternar entre Tabela / Timeline / Gantt / Calendário
             Clicar status da linha para avançar (todo→working→done)
```

---

## Observações Técnicas

### Supabase JS v2.101+ — sem generic `<Database>`
Clientes criados **sem** `createBrowserClient<Database>()` — versões novas causam tipo `never` em todos os inserts. Casts explícitos usam `as unknown as Tipo`.

### Resend — Inicialização lazy
`new Resend(key)` instanciado **dentro do handler**, não no topo do arquivo. Evita crash no build da Vercel quando `RESEND_API_KEY` não está definida durante o build.

### useSearchParams + Suspense
Em Next.js 14, `useSearchParams()` dentro de um page component exige `<Suspense>` boundary. O login usa um subcomponente `<UrlErrorHandler>` isolado em `<Suspense fallback={null}>`.

### PWA
- Ícones gerados dinamicamente via `next/og` (ImageResponse) — sem arquivos PNG estáticos
- Manifest via `src/app/manifest.ts` (convenção Next.js 14, serve em `/manifest.webmanifest`)
- Tema roxo (#7c3aed), ícone "F" em gradiente

### Dark Mode
Implementado via `next-themes`. Toggle no rodapé da sidebar. Persiste via `localStorage`.

---

## Roadmap de Evolução — 30 Funcionalidades

### Categoria: Financeiro & Faturamento

| # | Funcionalidade | Descrição |
|---|---|---|
| 1 | **Propostas / Orçamentos** | Módulo pré-invoice com status: rascunho → enviado → aprovado → recusado. Aprovação converte em job automaticamente |
| 2 | **Invoices Recorrentes** | Jobs de retainer geram invoices automaticamente no início de cada período. Configurável: dia do mês, valor, envio automático |
| 3 | **Lembretes de Cobrança** | E-mails automáticos via Resend quando invoice passa do vencimento: D+1, D+7, D+15 com tom progressivo |
| 4 | **Controle de Despesas** | Registro de gastos do negócio (software, hardware, cursos, impostos). Relatório de Lucro Real = Receita − Despesas |
| 5 | **Simulador de Impostos** | Calculadora de ISS, INSS e IR estimado sobre o faturamento. Configurável por regime tributário (MEI, ME, PJ) |
| 6 | **Pagamento Parcial** | Registrar que uma invoice foi paga em partes (ex: 50% entrada). Saldo em aberto visível |
| 7 | **Personalização de Invoice** | Upload de logo, CNPJ/CPF do prestador, cores, rodapé customizado. Preview em tempo real |
| 8 | **Link de Pagamento Online** | Integração com Stripe ou Mercado Pago. Botão "Pagar online" embutido no e-mail da invoice |

---

### Categoria: Clientes & Pipeline

| # | Funcionalidade | Descrição |
|---|---|---|
| 9 | **Pipeline de Vendas (CRM)** | Funil Kanban: Lead → Contato → Proposta → Negociação → Fechado. Drag-and-drop entre colunas |
| 10 | **Portal do Cliente** | Link público único por cliente para visualizar suas invoices, horas e status do projeto sem login |
| 11 | **Histórico de Comunicação** | Registro de e-mails, ligações e reuniões na ficha do cliente. Linha do tempo de interações |
| 12 | **Score de Cliente** | Avaliação interna: paga em dia, comunicação, complexidade. Útil para priorizar renovações |

---

### Categoria: Tempo & Produtividade

| # | Funcionalidade | Descrição |
|---|---|---|
| 13 | **Metas de Horas** | Definir meta semanal/mensal (ex: 30h/semana) com barra de progresso no dashboard. Alerta ao ultrapassar ou ficar abaixo |
| 14 | **Pomodoro Integrado** | Timer com ciclos de 25min + 5min no registro diário. Conta sessões e converte automaticamente em horas |
| 15 | **Arredondamento de Horas** | Opção para arredondar `hours_billed` automaticamente: 0,25h / 0,5h / 1h |
| 16 | **Heatmap de Produtividade** | Calendário anual (estilo GitHub) com intensidade de horas por dia. Identifica padrões e ociosidade |
| 17 | **Horas por Tarefa** | Dentro de um registro diário, quebrar horas em subtarefas específicas (ex: "Design: 2h", "Dev: 3h") |

---

### Categoria: Notificações & Alertas

| # | Funcionalidade | Descrição |
|---|---|---|
| 18 | **Notificações Push (PWA)** | Alertas de prazos, invoices vencendo, metas — direto no navegador/celular via Service Worker |
| 19 | **Resumo Semanal por E-mail** | Envio automático toda segunda com: horas da semana, faturamento, próximos vencimentos, tarefas em atraso |
| 20 | **Webhook Slack / Discord** | Notificações em canais quando: invoice é paga, deadline se aproxima, novo job criado |

---

### Categoria: Relatórios & Análise

| # | Funcionalidade | Descrição |
|---|---|---|
| 21 | **Rentabilidade por Job** | Comparar horas estimadas × trabalhadas × faturadas. Qual projeto foi mais lucrativo por hora real |
| 22 | **Valor por Cliente (LTV)** | Quanto cada cliente gerou desde o início, média mensal, tendência histórica |
| 23 | **Previsão de Receita** | Com base em jobs ativos e histórico, projetar receita dos próximos 3 meses |
| 24 | **Exportar CSV / Excel** | Exportar qualquer listagem (logs, invoices, clientes) para planilha. Fundamental para contabilidade |

---

### Categoria: Agenda & Organização

| # | Funcionalidade | Descrição |
|---|---|---|
| 25 | **Sync Google Calendar** | Exportar/importar eventos via OAuth. Manter agenda sincronizada com Google Calendar / Outlook |
| 26 | **Checklist por Tarefa** | Subtópicos com checkbox dentro de cada tarefa da agenda. Mais granularidade que apenas o status |
| 27 | **Eventos Recorrentes** | Criar evento que se repete (diário/semanal/mensal). Ex: reunião de alinhamento toda segunda |

---

### Categoria: Experiência & Interface

| # | Funcionalidade | Descrição |
|---|---|---|
| 28 | **Onboarding Guiado** | Wizard na primeira vez: "Crie seu primeiro cliente → Job → Registro diário". Reduz curva de aprendizado |
| 29 | **Atalhos de Teclado** | `N` = novo registro, `F` = buscar, `Esc` = fechar dialog, `Ctrl+S` = salvar. Aumenta velocidade de uso |
| 30 | **Multi-usuário / Workspace** | Adicionar assistente ou sócio com permissões limitadas (ex: só logs, sem acesso a financeiro) |

---

## Implementação em Fases

A evolução do sistema está dividida em 6 fases ordenadas por **impacto imediato**, **viabilidade técnica** e **dependências entre funcionalidades**.

---

### Fase 1 — Polimento e Gaps Críticos
**Objetivo:** Fechar lacunas do sistema atual antes de adicionar complexidade. Tudo que um freelancer sente falta no uso diário.

| # | Funcionalidade | Complexidade | Impacto |
|---|---|---|---|
| 24 | Exportar CSV / Excel | Baixa | Alto |
| 28 | Onboarding guiado | Baixa | Alto |
| 15 | Arredondamento de horas | Baixa | Médio |
| 29 | Atalhos de teclado | Baixa | Médio |
| 7  | Personalização de Invoice (logo, CNPJ) | Média | Alto |

**Migrations necessárias:** Adicionar campos de personalização em `user_settings` (nova tabela)

**Entregáveis:**
- Botão "Exportar CSV" nas páginas de logs, invoices e clientes
- Wizard de primeiro acesso com 3 passos
- Campo arredondamento nas configurações
- Atalhos globais via `useEffect` + `keydown`
- Upload de logo e campos de identificação fiscal na página de configurações

---

### Fase 2 — Poder Financeiro Completo
**Objetivo:** Tornar o módulo financeiro robusto o suficiente para substituir planilhas do Excel.

| # | Funcionalidade | Complexidade | Impacto |
|---|---|---|---|
| 4  | Controle de Despesas | Média | Alto |
| 5  | Simulador de Impostos | Baixa | Alto |
| 6  | Pagamento Parcial | Média | Médio |
| 1  | Propostas / Orçamentos | Alta | Alto |
| 13 | Metas de Horas | Média | Alto |

**Migrations necessárias:**
```sql
-- expenses: id, user_id, category, description, amount, date, receipt_url
-- proposals: id, user_id, client_id, title, items, status, valid_until, converted_job_id
-- invoice_payments: id, invoice_id, amount, paid_at, method, notes
-- user_goals: id, user_id, type, target, period
```

**Entregáveis:**
- Página `/despesas` com categorias e totais mensais
- Widget de impostos estimados no dashboard
- Registro de pagamentos parciais por invoice
- Módulo `/propostas` com gerador de PDF
- Card de meta de horas no dashboard com % de progresso

---

### Fase 3 — Automação e Comunicação
**Objetivo:** Reduzir trabalho manual com automações que poupam tempo toda semana.

| # | Funcionalidade | Complexidade | Impacto |
|---|---|---|---|
| 3  | Lembretes de cobrança automáticos | Média | Alto |
| 2  | Invoices recorrentes | Alta | Alto |
| 19 | Resumo semanal por e-mail | Média | Médio |
| 18 | Notificações Push (PWA) | Alta | Médio |
| 27 | Eventos recorrentes na agenda | Média | Médio |

**Tecnologias adicionais:**
- Supabase Edge Functions + pg_cron (para envios agendados)
- Web Push API + service worker (para notificações)

**Migrations necessárias:**
```sql
-- scheduled_emails: id, user_id, type, next_run, config (jsonb)
-- recurring_invoices: id, user_id, job_id, day_of_month, auto_send
-- push_subscriptions: id, user_id, endpoint, keys (jsonb)
```

**Entregáveis:**
- Configuração de lembrança por invoice (D+1, D+7, D+15)
- Setup de invoice recorrente por job com flag `is_recurring`
- E-mail de resumo semanal toda segunda-feira (Edge Function)
- Botão "Ativar notificações" no app (PWA push)
- Recorrência de eventos: diária, semanal, mensal

---

### Fase 4 — Análise e Inteligência
**Objetivo:** Transformar os dados acumulados em decisões de negócio claras.

| # | Funcionalidade | Complexidade | Impacto |
|---|---|---|---|
| 21 | Rentabilidade por job | Média | Alto |
| 22 | Valor por cliente (LTV) | Média | Alto |
| 16 | Heatmap de produtividade | Média | Médio |
| 23 | Previsão de receita | Alta | Alto |
| 17 | Horas por subtarefa | Média | Médio |

**Migrations necessárias:**
```sql
-- log_tasks: id, log_id, description, hours (subtarefas dentro de um log)
```

**Entregáveis:**
- Seção "Rentabilidade" em `/reports` com gráfico estimado × real por job
- Seção "Clientes" em `/reports` com LTV, média mensal, tendência
- Calendário heatmap em `/reports` (inspirado no GitHub contributions)
- Widget de previsão dos próximos 3 meses no dashboard
- Subtarefas com horas dentro do dialog de registro diário

---

### Fase 5 — Relacionamento com Cliente
**Objetivo:** Evoluir o sistema para suportar o ciclo completo de vendas e relacionamento.

| # | Funcionalidade | Complexidade | Impacto |
|---|---|---|---|
| 9  | Pipeline de Vendas (CRM Kanban) | Alta | Alto |
| 10 | Portal do Cliente (link público) | Alta | Alto |
| 11 | Histórico de comunicação | Média | Médio |
| 12 | Score de cliente | Baixa | Médio |
| 25 | Sync Google Calendar | Alta | Médio |

**Tecnologias adicionais:**
- Google Calendar API (OAuth 2.0)
- Tokens públicos para portal do cliente (JWT sem auth)

**Migrations necessárias:**
```sql
-- sales_pipeline: id, user_id, client_id, stage, title, value, notes, expected_close
-- client_interactions: id, client_id, type, summary, happened_at
-- client_portal_tokens: id, client_id, token (unique), expires_at
```

**Entregáveis:**
- Página `/pipeline` com Kanban drag-and-drop
- Rota pública `/portal/[token]` para o cliente ver suas invoices
- Timeline de interações na ficha do cliente
- Campo `score` (1–5) e etiquetas internas por cliente
- Botão "Conectar Google Calendar" nas configurações

---

### Fase 6 — Escala e Integrações
**Objetivo:** Preparar para múltiplos usuários, integrações externas e monetização do próprio sistema.

| # | Funcionalidade | Complexidade | Impacto |
|---|---|---|---|
| 8  | Link de Pagamento Online | Alta | Alto |
| 30 | Multi-usuário / Workspace | Muito alta | Alto |
| 20 | Webhook Slack / Discord | Média | Médio |
| 26 | Checklist por tarefa | Baixa | Médio |
| 14 | Pomodoro integrado | Média | Médio |

**Tecnologias adicionais:**
- Stripe API ou Mercado Pago API
- Workspace model: organizations + members + roles

**Migrations necessárias:**
```sql
-- organizations: id, name, owner_id, plan, stripe_customer_id
-- org_members: id, org_id, user_id, role (owner|admin|member|viewer)
-- payment_links: id, invoice_id, provider, link_url, status
-- task_checklist: id, agenda_event_id, text, is_done, position
-- webhooks: id, user_id, url, events[], secret
```

**Entregáveis:**
- Integração Stripe: gerar payment link por invoice, webhook de confirmação automática
- Sistema de workspaces com convite por e-mail e roles
- Configuração de webhooks customizados por evento
- Checklist inline em tarefas da agenda
- Timer Pomodoro com histórico de sessões
- Widget Pomodoro flutuante (PiP style)

---

## Resumo do Roadmap

```
HOJE          Fase 1         Fase 2         Fase 3         Fase 4         Fase 5         Fase 6
  │             │              │              │              │              │              │
  ▼             ▼              ▼              ▼              ▼              ▼              ▼
Sistema     Polimento     Financeiro     Automação      Análise       CRM +          Escala +
  atual     + CSV/Export  + Despesas     + Recorrência  + Heatmap    Portal         Pagamento
            + Onboarding  + Propostas    + Push Notif.  + Previsão   + Pipeline     + Multi-user
            + Atalhos     + Metas        + Resumo       + LTV        + Google Cal   + Stripe
```

| Fase | Funcionalidades | Complexidade geral | Pré-requisito |
|---|---|---|---|
| 1 — Polimento | 5 | Baixa | Nenhum |
| 2 — Financeiro | 5 | Média | Fase 1 |
| 3 — Automação | 5 | Alta | Fase 2 |
| 4 — Análise | 5 | Média | Fases 1 e 2 |
| 5 — CRM | 5 | Alta | Fases 2 e 3 |
| 6 — Escala | 5 | Muito alta | Todas as anteriores |
