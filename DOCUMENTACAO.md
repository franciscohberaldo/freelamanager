# Freela Manager — Documentação Completa

> Sistema de gestão para freelancers: clientes, jobs, registro de horas, invoices, agenda, projetos com Gantt e diário pessoal.

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
10. [Roadmap de Evolução — 50 Funcionalidades](#roadmap-de-evolução--50-funcionalidades)
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

### 9. Projetos (Gantt) — `/projetos` e `/projetos/[id]`

Gerenciador dedicado de projetos com visualização Gantt.

**Página de lista `/projetos`:**
- Cards de projetos com: nome, cliente, status, barra de progresso (% tarefas concluídas), período
- Indicador de cor configurável por projeto
- Criar novo projeto via dialog: nome, descrição, cliente, status, cor, datas

**Página de detalhe `/projetos/[id]`:**
- Header com nome, cliente, período e barra de progresso geral
- Duas abas: **Gantt** e **Lista**

**Aba Gantt:**
- Painel esquerdo fixo: nome da tarefa + ponto de status
- Painel direito scrollável: timeline com cabeçalhos de mês
- Barras horizontais coloridas por status da tarefa
- Barra de progresso embutida dentro de cada barra
- Linha vermelha vertical indicando "hoje"
- Posicionamento pixel-preciso: 28px por dia

**Aba Lista:**
- Linhas com: status (dot colorido), título, período, barra de progresso %, badge de status
- Ações: editar, excluir (visíveis ao passar o mouse)
- Dialog de tarefa: título, descrição, status, progresso (slider 0–100), data início/fim

**Status de tarefa:** `todo` / `in_progress` / `done` / `blocked`

**Tabelas:** `projects`, `project_tasks`

---

### 10. Diário — `/diario`

Calendário pessoal para registrar o que foi feito a cada dia.

**Visualização:**
- Grade mensal (Dom→Sáb) com navegação por mês
- Dias com entrada exibem: emoji de humor + prévia do texto
- Dias vazios mostram um ponto sutil
- Dias futuros são desabilitados
- Clique em qualquer dia passado abre o dialog de edição
- Lista de entradas do mês abaixo do calendário (até 10 itens)

**Dialog de entrada:**
- Título: data completa (ex: "segunda-feira, 05 de maio")
- Seletor de humor com 5 opções: 😄 Ótimo / 🙂 Bom / 😐 Ok / 😕 Ruim / 😞 Péssimo
- Textarea: "O que você fez hoje?" (6 linhas)
- Botão "Excluir" para remover a entrada
- Upsert automático por data (uma entrada por dia)

**Tabela:** `daily_journal` com constraint `unique(user_id, date)`

---

### 11. Relatórios — `/reports`

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

### Tabela: `projects`
```
id, user_id, client_id,
name, description, status, color,
start_date, end_date,
created_at, updated_at
```
Status: `planning` / `active` / `on_hold` / `completed` / `cancelled`

### Tabela: `project_tasks`
```
id, project_id, user_id,
title, description, status, progress (0–100),
start_date, end_date, position,
created_at, updated_at
```
Status: `todo` / `in_progress` / `done` / `blocked`

### Tabela: `daily_journal`
```
id, user_id, date (unique per user),
content, mood, highlights[],
created_at, updated_at
```
Mood: `great` / `good` / `okay` / `bad` / `terrible`

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
| `004_projects.sql` | Cria tabelas `projects` e `project_tasks` com RLS e triggers |
| `005_journal.sql` | Cria tabela `daily_journal` com constraint unique por data |

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

## Roadmap de Evolução — 50 Funcionalidades

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

### Novas Sugestões (31–50)

#### Categoria: Produtividade & Organização

| # | Funcionalidade | Descrição |
|---|---|---|
| 31 | **Time Blocking** | Bloquear faixas de horário no calendário por cliente/job (manhã = Cliente A, tarde = Cliente B). Visual de agenda diária |
| 32 | **Templates de Projeto** | Salvar estrutura de projeto (fases + tarefas padrão) como template reutilizável. Ex: "Template Website" com 12 tarefas prontas |
| 33 | **Kanban de Tarefas** | Visão alternativa ao Gantt: quadro drag-and-drop com colunas por status. Complementa o Gantt para gestão visual |
| 34 | **Subtarefas** | Tarefas dentro de tarefas. Cada tarefa do projeto pode ter checklist de subtarefas com progresso individual |
| 35 | **Controle de Férias e Folgas** | Marcar dias como férias, feriado ou folga. Exclui esses dias do cálculo de disponibilidade e de horas esperadas |

#### Categoria: Financeiro Avançado

| # | Funcionalidade | Descrição |
|---|---|---|
| 36 | **Histórico de Taxas** | Registrar quando o valor/hora de um cliente mudou. Relatório mostra evolução de taxa por cliente ao longo do tempo |
| 37 | **Orçamento por Projeto** | Definir orçamento total do projeto e acompanhar consumo em tempo real (horas × taxa). Alerta quando chegar a 80% |
| 38 | **Conciliação Bancária** | Importar extrato bancário (CSV) e cruzar lançamentos com invoices pagas. Identifica divergências automaticamente |
| 39 | **Moeda com Cotação Automática** | Buscar cotação BRL/USD/EUR em tempo real e converter todos os valores para a moeda base do usuário no relatório |
| 40 | **Nota Fiscal (NF-e)** | Integração com API de emissão de NF-e (ex: NFe.io, Omie). Emitir nota diretamente ao marcar invoice como paga |

#### Categoria: Comunicação & Integração

| # | Funcionalidade | Descrição |
|---|---|---|
| 41 | **Envio via WhatsApp** | Enviar invoice por WhatsApp usando Z-API ou Twilio. Mensagem com link de PDF + botão de pagamento |
| 42 | **Zapier / Make Integration** | Expor webhooks padronizados para conectar com 1000+ ferramentas (Notion, Trello, Google Sheets, etc.) |
| 43 | **Extensão de Navegador** | Extension Chrome/Firefox com timer flutuante. Logar horas e criar registros diários sem abrir o app |
| 44 | **Resumo por WhatsApp** | Envio automático de resumo semanal para o próprio número: horas trabalhadas, faturamento, próximas entregas |
| 45 | **API Pública REST** | Endpoints autenticados para integração com sistemas externos. Útil para conectar com ERPs, CRMs ou scripts |

#### Categoria: Inteligência & Segurança

| # | Funcionalidade | Descrição |
|---|---|---|
| 46 | **IA para Descrição de Invoice** | Usar Claude API para gerar automaticamente a descrição dos itens da invoice a partir das notas de reuniões e pedidos dos logs |
| 47 | **Busca Global** | Campo de busca unificado (Cmd+K) que pesquisa simultaneamente em clientes, jobs, logs, invoices e projetos |
| 48 | **Autenticação em Dois Fatores (2FA)** | TOTP via app autenticador (Google Authenticator, Authy). Adiciona camada extra de segurança à conta |
| 49 | **Backup Completo** | Exportar todos os dados da conta em JSON estruturado. Garante portabilidade e recuperação em caso de necessidade |
| 50 | **Modo Offline (PWA)** | Usar Service Worker para cachear os dados mais recentes. Permitir visualização e criação de logs sem conexão, sincronizando ao reconectar |

---

## Implementação em Fases

### Estado atual do sistema (v1 — live em produção)

| Rota | Página | Banco |
|---|---|---|
| `/dashboard` | KPIs + gráficos de receita e horas | `daily_logs`, `invoices`, `jobs`, `agenda_events` |
| `/clients` | Cadastro de clientes + contatos | `clients`, `client_contacts` |
| `/jobs` | Projetos/contratos por cliente | `jobs` |
| `/logs` | Timesheet com timer ao vivo | `daily_logs` |
| `/invoices` | Invoice com PDF/e-mail PT e EN | `invoices`, `invoice_items` |
| `/agenda` | Quadro de tarefas (Tabela/Timeline/Gantt/Cal) | `agenda_events` |
| `/projetos` | Lista de projetos com progresso | `projects`, `project_tasks` |
| `/projetos/[id]` | Gantt chart + lista de tarefas | `project_tasks` |
| `/diario` | Calendário diário com humor | `daily_journal` |
| `/disponibilidade` | Status de disponibilidade | `user_availability` |
| `/reports` | Relatórios anuais | `daily_logs`, `invoices` |
| `/settings` | Conta + integrações | `auth.users` |

**12 páginas · 10 tabelas · 5 migrations · 3 API routes**

---

### Critérios de priorização

Cada funcionalidade foi avaliada em 3 eixos:

| Eixo | Peso | Critério |
|---|---|---|
| **Impacto** | Alto | Uso diário, poupa tempo real ou aumenta faturamento |
| **Complexidade** | Alto | Esforço de dev + migrations necessárias |
| **Dependência** | Médio | Precisa de outra feature pronta antes |

---

### Fase 1 — Configurações & Exportação
> **Objetivo:** Completar o sistema central antes de expandir. Features de baixo esforço e alto retorno que qualquer freelancer usa diariamente.

| # | Funcionalidade | Complexidade | Impacto | Por que agora |
|---|---|---|---|---|
| 7  | Personalização de Invoice (logo, CNPJ) | Média | 🔴 Alto | Primeira coisa que um cliente vê |
| 24 | Exportar CSV (logs, invoices, clientes) | Baixa | 🔴 Alto | Fundamental para contabilidade |
| 15 | Arredondamento automático de horas | Baixa | 🟡 Médio | Poupa ajuste manual toda vez |
| 29 | Atalhos de teclado globais | Baixa | 🟡 Médio | Aumenta velocidade de uso diário |
| 47 | Busca global (Cmd+K) | Média | 🟡 Médio | Base para todas as features futuras |
| 48 | Autenticação 2FA | Média | 🟡 Médio | Segurança antes de dados crescerem |

**Migrations:**
```sql
-- 006_user_settings.sql
create table user_settings (
  user_id       uuid primary key references auth.users(id),
  company_name  text,
  cnpj_cpf      text,
  logo_url      text,
  invoice_color text default '#7c3aed',
  hour_rounding text default 'none'  -- none | 0.25 | 0.5 | 1
);
```

**Entregáveis:**
- `/settings` expandido: logo upload (Supabase Storage), CNPJ, nome empresa, cor de invoice
- PDF usa logo e dados fiscais do usuário automaticamente
- Botão "Exportar CSV" em `/logs`, `/invoices`, `/clients`
- Hook global `useHotkeys` com `N` (novo), `F` (buscar), `Esc` (fechar)
- Paleta de busca (Cmd+K) com resultados de todas as entidades
- TOTP 2FA via Supabase Auth MFA

---

### Fase 2 — Financeiro Completo
> **Objetivo:** Tornar o módulo financeiro capaz de substituir qualquer planilha. Fechar o ciclo completo de receita, despesa e tributação.

| # | Funcionalidade | Complexidade | Impacto | Por que agora |
|---|---|---|---|---|
| 4  | Controle de Despesas | Média | 🔴 Alto | Sem despesas, não há lucro real |
| 5  | Simulador de Impostos (MEI/ME/PJ) | Baixa | 🔴 Alto | Dúvida constante de todo PJ |
| 1  | Propostas / Orçamentos | Alta | 🔴 Alto | Início do funil de vendas |
| 13 | Metas de horas e receita | Média | 🔴 Alto | Visibilidade do progresso mensal |
| 6  | Pagamento parcial de invoice | Média | 🟡 Médio | Clientes que pagam em partes |
| 37 | Orçamento por projeto (budget tracking) | Média | 🟡 Médio | Controle de escopo em Projetos |
| 36 | Histórico de taxas por cliente | Baixa | 🟡 Médio | Rastrear reajustes ao longo do tempo |
| 39 | Cotação automática BRL/USD/EUR | Média | 🟡 Médio | Clientes internacionais |

**Migrations:**
```sql
-- 007_financeiro.sql
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  category text not null,  -- software|hardware|curso|imposto|outro
  description text not null,
  amount numeric(12,2) not null,
  date date not null,
  receipt_url text,
  created_at timestamptz default now()
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  client_id uuid references clients(id),
  title text not null,
  status text default 'draft',  -- draft|sent|approved|rejected
  valid_until date,
  total numeric(12,2),
  notes text,
  converted_job_id uuid references jobs(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id),
  amount numeric(12,2) not null,
  paid_at date not null,
  method text,  -- pix|ted|cartao|outro
  notes text
);

create table user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  type text not null,  -- hours_week|hours_month|revenue_month
  target numeric(12,2) not null,
  period text not null  -- 2025-04 | 2025-W15
);
```

**Entregáveis:**
- `/despesas` — cadastro por categoria, relatório mensal, gráfico Receita vs Despesa
- `/propostas` — criador de orçamento com geração de PDF, link de aprovação
- Dashboard com card de meta mensal (barra de progresso receita/horas)
- Widget de impostos estimados (ISS + INSS + IR) configurável por regime
- Pagamentos parciais visíveis por invoice com saldo em aberto
- Campo de orçamento em `/projetos/[id]` com % consumido
- Histórico de `hourly_rate` por job em linha do tempo

---

### Fase 3 — Projetos Avançados
> **Objetivo:** Tornar o gerenciador de projetos tão poderoso quanto ferramentas dedicadas, sem sair do Freela Manager.

| # | Funcionalidade | Complexidade | Impacto | Por que agora |
|---|---|---|---|---|
| 33 | Kanban de tarefas (drag-and-drop) | Alta | 🔴 Alto | Vista complementar ao Gantt |
| 34 | Subtarefas com checklist | Média | 🟡 Médio | Detalhar tarefas grandes |
| 32 | Templates de projeto | Média | 🟡 Médio | Reaproveitamento para projetos similares |
| 26 | Checklist por evento da agenda | Baixa | 🟡 Médio | Mais granularidade nos eventos |
| 17 | Horas por subtarefa no log diário | Média | 🟡 Médio | Rastreio granular de onde o tempo vai |
| 35 | Controle de férias e folgas | Média | 🟡 Médio | Excluir dias do cálculo de disponibilidade |

**Migrations:**
```sql
-- 008_projetos_avancado.sql
create table project_task_items (  -- subtarefas/checklist
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references project_tasks(id) on delete cascade,
  text text not null,
  is_done boolean not null default false,
  position int not null default 0
);

create table project_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  tasks jsonb not null default '[]'
);

create table time_off (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  date date not null,
  type text not null,  -- ferias|feriado|folga|doenca
  note text,
  unique(user_id, date)
);

create table log_subtasks (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references daily_logs(id) on delete cascade,
  description text not null,
  hours numeric(5,2) not null default 0
);
```

**Entregáveis:**
- Aba "Kanban" em `/projetos/[id]` com drag-and-drop por status
- Checklist expandível dentro de cada tarefa do projeto
- `/projetos` — botão "Usar template" ao criar novo projeto
- Checklist nos eventos de `/agenda`
- Quebra de horas por atividade dentro do dialog de log diário
- Calendário de férias/folgas visível na disponibilidade

---

### Fase 4 — Automação & Comunicação
> **Objetivo:** Reduzir trabalho manual recorrente. O sistema trabalha para você quando você não está olhando.

| # | Funcionalidade | Complexidade | Impacto | Por que agora |
|---|---|---|---|---|
| 3  | Lembretes de cobrança automáticos | Média | 🔴 Alto | Elimina follow-up manual de invoice |
| 2  | Invoices recorrentes | Alta | 🔴 Alto | Jobs de retainer não precisam de ação mensal |
| 19 | Resumo semanal por e-mail | Média | 🟡 Médio | Visão sem precisar abrir o app |
| 27 | Eventos recorrentes na agenda | Média | 🟡 Médio | Reuniões de alinhamento toda semana |
| 41 | Envio de invoice via WhatsApp | Alta | 🟡 Médio | Canal preferido de muitos clientes |
| 44 | Resumo semanal via WhatsApp | Média | 🟡 Médio | Notificação onde o usuário já está |
| 18 | Notificações Push (PWA) | Alta | 🟡 Médio | Alertas de prazos sem abrir o app |

**Tecnologias adicionais:**
- Supabase Edge Functions (processamento server-side agendado)
- `pg_cron` via Supabase (cron jobs no banco)
- Z-API ou Twilio (WhatsApp)
- Web Push API + VAPID keys (notificações PWA)

**Migrations:**
```sql
-- 009_automacao.sql
alter table jobs add column if not exists
  auto_invoice boolean not null default false,
  invoice_day_of_month int;

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz default now()
);

create table notification_settings (
  user_id uuid primary key references auth.users(id),
  overdue_reminder boolean default true,
  weekly_email boolean default true,
  whatsapp_number text,
  push_enabled boolean default false
);
```

**Entregáveis:**
- Edge Function `send-overdue-reminders` — roda diariamente, envia e-mail D+1/7/15
- Edge Function `generate-recurring-invoices` — roda no dia configurado por job
- Edge Function `weekly-summary` — toda segunda às 8h, resumo por e-mail
- `/settings` com painel de notificações (toggle cada automação)
- Botão "Enviar por WhatsApp" nas ações de invoice
- Service Worker registrado + prompt de ativação de push

---

### Fase 5 — Análise & Inteligência
> **Objetivo:** Os dados acumulados de meses de uso viram insights que guiam decisões de negócio.

| # | Funcionalidade | Complexidade | Impacto | Por que agora |
|---|---|---|---|---|
| 21 | Rentabilidade por job | Média | 🔴 Alto | Qual projeto vale a pena renovar |
| 22 | Valor por cliente (LTV) | Média | 🔴 Alto | Quem merece mais atenção |
| 23 | Previsão de receita (3 meses) | Alta | 🔴 Alto | Planejamento financeiro antecipado |
| 16 | Heatmap de produtividade | Média | 🟡 Médio | Identifica padrões e ociosidade |
| 46 | IA para descrição de invoice | Alta | 🟡 Médio | Gera texto profissional dos logs |
| 49 | Backup completo dos dados | Baixa | 🟡 Médio | Segurança e portabilidade |
| 38 | Conciliação bancária (CSV) | Alta | 🟡 Médio | Fecha ciclo contábil |

**Tecnologias adicionais:**
- Claude API (`claude-sonnet-4-6`) para geração de texto
- Algoritmo de regressão linear simples para previsão

**Entregáveis:**
- `/reports` com nova aba "Rentabilidade": estimado × real × faturado por job
- `/reports` com aba "Clientes": LTV, ticket médio, tendência por cliente
- Dashboard: card "Previsão 3 meses" com gráfico de projeção
- `/reports` com heatmap anual de horas (inspirado no GitHub)
- Botão "Gerar com IA" no preview de invoice → Claude descreve os itens
- `/settings` → Exportar tudo em JSON (todos os dados da conta)
- `/despesas` → Import de extrato bancário CSV com mapeamento de colunas

---

### Fase 6 — CRM & Relacionamento com Cliente
> **Objetivo:** Cobrir o ciclo completo: prospecção → proposta → entrega → renovação.

| # | Funcionalidade | Complexidade | Impacto | Por que agora |
|---|---|---|---|---|
| 9  | Pipeline de Vendas Kanban | Alta | 🔴 Alto | Gestão de leads e oportunidades |
| 10 | Portal do cliente (link público) | Alta | 🔴 Alto | Cliente acompanha sem entrar no sistema |
| 11 | Histórico de comunicação | Média | 🟡 Médio | Contexto completo do relacionamento |
| 12 | Score de cliente | Baixa | 🟡 Médio | Decide quem priorizar |
| 25 | Sync Google Calendar | Alta | 🟡 Médio | Agenda unificada com a vida real |
| 40 | Nota Fiscal NF-e | Muito alta | 🔴 Alto | Obrigação legal para PJ |

**Tecnologias adicionais:**
- Google Calendar API + OAuth 2.0
- NFe.io ou Omie API (emissão de nota fiscal)
- JWT público para portal do cliente (sem auth Supabase)

**Migrations:**
```sql
-- 010_crm.sql
create table sales_pipeline (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  client_id uuid references clients(id),
  stage text not null,  -- lead|contacted|proposal|negotiation|won|lost
  title text not null,
  value numeric(12,2),
  expected_close date,
  notes text,
  position int default 0,
  created_at timestamptz default now()
);

create table client_interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  type text not null,  -- email|call|meeting|note
  summary text not null,
  happened_at timestamptz not null default now()
);

create table client_portal_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  token text unique not null default gen_random_uuid()::text,
  expires_at timestamptz,
  created_at timestamptz default now()
);
```

**Entregáveis:**
- `/pipeline` — Kanban com drag-and-drop entre estágios, valor total por estágio
- `/portal/[token]` — página pública: invoices, horas registradas, status de projetos
- Ficha do cliente expandida com timeline de interações e score (1–5)
- Botão "Gerar link do portal" em cada cliente
- `/settings` → conectar Google Calendar (OAuth)
- Botão "Emitir NF-e" ao marcar invoice como paga

---

### Fase 7 — Escala & Plataforma
> **Objetivo:** Transformar o sistema pessoal em uma plataforma multi-usuário, com integrações de pagamento e ecossistema externo.

| # | Funcionalidade | Complexidade | Impacto | Por que agora |
|---|---|---|---|---|
| 8  | Link de pagamento online (Stripe/MP) | Alta | 🔴 Alto | Encurta ciclo de recebimento |
| 30 | Multi-usuário / Workspace | Muito alta | 🔴 Alto | Estúdios e parcerias |
| 42 | Zapier / Make webhooks | Média | 🟡 Médio | Conectar com 1000+ ferramentas |
| 45 | API REST pública | Alta | 🟡 Médio | Integrações com sistemas externos |
| 43 | Extensão de navegador | Alta | 🟡 Médio | Timer sem abrir o app |
| 50 | Modo offline (PWA) | Alta | 🟡 Médio | Trabalhar sem internet |
| 14 | Pomodoro integrado | Média | 🟢 Baixo | Feature de nicho |
| 31 | Time blocking no calendário | Alta | 🟢 Baixo | Planejamento do dia a dia |

**Tecnologias adicionais:**
- Stripe API + webhooks (pagamentos online)
- Mercado Pago API (alternativa para BR)
- Supabase multi-tenant com `organization_id` em todas as tabelas
- Chrome Extension API (Manifest v3)
- Workbox (Service Worker para offline)

**Migrations:**
```sql
-- 011_plataforma.sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id),
  plan text default 'free',  -- free|pro|team
  stripe_customer_id text,
  created_at timestamptz default now()
);

create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null default 'member',  -- owner|admin|member|viewer
  unique(org_id, user_id)
);

create table payment_links (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id),
  provider text not null,  -- stripe|mercadopago
  link_url text not null,
  status text default 'pending',  -- pending|paid|expired
  created_at timestamptz default now()
);

create table webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  url text not null,
  events text[] not null,
  secret text not null,
  is_active boolean default true
);
```

**Entregáveis:**
- Botão "Gerar link de pagamento" na invoice → Stripe Checkout ou MP
- Webhook Stripe confirma pagamento → status atualizado automaticamente
- Sistema de organizações com convite por e-mail, roles, billing separado
- Endpoint `/api/v1/*` com auth por API key para integrações
- Painel de webhooks em `/settings` (URL, eventos, teste)
- Chrome Extension com timer flutuante e quick-add de log
- Cache offline com Workbox (dados dos últimos 7 dias disponíveis sem internet)

---

## Resumo do Roadmap

```
v1 HOJE    Fase 1      Fase 2      Fase 3       Fase 4      Fase 5      Fase 6      Fase 7
  ▼          ▼           ▼           ▼            ▼           ▼           ▼           ▼
12 páginas  Config &   Financeiro  Projetos     Automação   Análise &   CRM &       Escala &
10 tabelas  Exportação  Completo    Avançado     & Comunic.  Inteligên.  Cliente     Plataforma
            ──────────  ──────────  ──────────   ──────────  ──────────  ──────────  ──────────
            Logo/CNPJ   Despesas    Kanban       Cobrança    Rentabili.  Pipeline    Stripe/MP
            CSV Export  Propostas   Subtarefas   Recorrente  LTV         Portal      Workspace
            Atalhos     Metas       Templates    Resumo      Previsão    NF-e        API REST
            Busca (⌘K)  Impostos    Checklist    WhatsApp    Heatmap     Google Cal  Extension
            2FA         Pagto Parc. Férias/Folga Push Notif  IA Invoice  Score       Offline PWA
```

### Tabela de fases

| Fase | Foco | Features | Complexidade | Depende de |
|---|---|---|---|---|
| **1** | Config & Exportação | 6 | Baixa–Média | — |
| **2** | Financeiro completo | 8 | Média–Alta | Fase 1 |
| **3** | Projetos avançados | 6 | Média–Alta | v1 |
| **4** | Automação | 7 | Alta | Fases 1, 2 |
| **5** | Análise & IA | 7 | Média–Alta | Fases 1, 2, 3 |
| **6** | CRM & Cliente | 6 | Alta–Muito Alta | Fases 1, 2, 4 |
| **7** | Escala & Plataforma | 8 | Muito Alta | Todas |
| **Total** | | **48 funcionalidades** | | |
| 3 — Automação | 5 | Alta | Fase 2 |
| 4 — Análise | 5 | Média | Fases 1 e 2 |
| 5 — CRM | 5 | Alta | Fases 2 e 3 |
| 6 — Escala | 5 | Muito alta | Todas as anteriores |
