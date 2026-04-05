# Freela Manager — Documentação Completa

> Sistema de gestão para freelancers: clientes, jobs, registro de horas, invoices, agenda e disponibilidade.

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router) |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| Estilização | Tailwind CSS + shadcn/ui |
| Gráficos | Recharts |
| PDF | jsPDF + jspdf-autotable |
| E-mail | Resend API |
| Data/hora | date-fns (locale pt-BR) |
| Ícones | Lucide React |
| Notificações | Sonner |
| Deploy | Vercel |

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

---

## Páginas e Funcionalidades

### 1. Login / Cadastro — `/login`

Página pública de acesso ao sistema.

**Modos:**
- **Entrar** — e-mail + senha, redireciona para o dashboard
- **Criar conta** — nome, e-mail, senha, confirmação. Se o Supabase não exigir confirmação de e-mail, entra direto. Caso contrário, mostra tela de "verifique seu e-mail"

**Tratamento de erros:**
- E-mail não confirmado → mensagem explicativa
- Credenciais inválidas → toast de erro
- Rate limit (429) → ocorre após muitas tentativas; aguardar ~1h ou usar outro e-mail
- Links expirados → captura o parâmetro `?error=` da URL e exibe toast

**Configuração Supabase recomendada:** Desativar "Enable email confirmations" em _Authentication → Settings_ para uso pessoal.

---

### 2. Dashboard — `/dashboard`

Visão geral mensal do negócio.

**KPIs exibidos:**
- Total faturado no mês (horas × taxa)
- Total de horas trabalhadas
- Jobs ativos
- Invoices pendentes

**Gráficos:**
- Receita nos últimos 6 meses (AreaChart)
- Horas trabalhadas nos últimos 6 meses (BarChart)

**Listas:**
- Últimas 5 invoices criadas
- Próximos eventos da agenda (deadlines, entregas, reuniões)

---

### 3. Clientes — `/clients`

Cadastro e gerenciamento de clientes.

**Campos:**
- Nome, empresa, e-mail, telefone, observações

**Funcionalidades:**
- Listar todos os clientes com contagem de jobs
- Criar novo cliente (dialog)
- Editar cliente existente
- Contatos adicionais por cliente (nome, cargo, e-mail, telefone)

---

### 4. Jobs — `/jobs`

Projetos/contratos vinculados a clientes.

**Campos:**
- Nome, descrição
- Taxa horária (`hourly_rate`) e taxa diária (`daily_rate`)
- Moeda: BRL, USD ou EUR
- Status: `proposal` / `active` / `paused` / `completed`
- Valor do contrato, data início/fim
- Recorrente (flag)
- Alíquota de imposto (`tax_rate`)
- Observações

**Funcionalidades:**
- Listar com badge de status colorido
- Criar e editar via dialog
- Taxa horária usada como base para cálculo de invoices

---

### 5. Registro Diário — `/logs`

Timesheet diário — controle de horas por job.

**Campos de cada registro:**
- Job (vinculado ao cliente)
- Data
- Reuniões realizadas (texto livre)
- O que foi pedido/entregue (texto livre)
- `hours_worked` — horas efetivamente trabalhadas
- `hours_billed` — horas a serem cobradas (base da invoice)
- `total_value` — calculado automaticamente (`hours_billed × hourly_rate`)

**Funcionalidades:**
- Tabela com colunas: DATA, JOB, CLIENTE, DESCRIÇÃO, HORAS, STATUS
- Barra de estatísticas: total de horas, quantidade de registros, valor estimado
- Busca em tempo real (filtra por job, cliente, reuniões, pedidos)
- Navegação por mês (anterior/próximo)
- **Timer ao vivo por registro** — Play/Pause/Stop; ao parar, soma o tempo ao `hours_worked`
- **Timer global** — botão "Iniciar timer" no topo abre o dialog de criação com timer embutido
- Criar, editar e duplicar registros
- Status: "Concluído" (verde) se `hours_billed > 0`, "Em andamento" (azul) caso contrário

---

### 6. Invoices — `/invoices`

Geração e gestão de faturas.

**Campos:**
- Número sequencial automático por ano (ex: `2024-001`)
- Job e período (data início/fim)
- Total de horas faturadas
- Subtotal, imposto, total
- Moeda, data de vencimento
- Status: `draft` / `sent` / `paid` / `overdue`
- Observações

**Fluxo de criação:**
1. Selecionar job, período, data de vencimento
2. Sistema busca todos os `daily_logs` do período
3. Preview mostra cada log como linha de item (data, horas, taxa, subtotal)
4. Ao confirmar: cria `invoice` + `invoice_items` no banco
5. Número sequencial gerado via função PostgreSQL `get_next_invoice_number`

**Ações por invoice:**
- **Baixar PDF em PT** — `/api/invoices/pdf?id=X&lang=pt`
- **Baixar PDF em EN** — `/api/invoices/pdf?id=X&lang=en`
- **Enviar por e-mail em PT** — `/api/invoices/send-email` com `lang: "pt"`
- **Enviar por e-mail em EN** — `/api/invoices/send-email` com `lang: "en"`
- **Marcar como pago** — atualiza status e registra `paid_at`

**PDF gerado inclui:**
- Cabeçalho com número da invoice
- Dados do cliente e serviço
- Tabela de itens (data, horas, taxa, subtotal)
- Total com imposto
- Seção de observações

**E-mail:**
- Enviado via Resend
- Template HTML bilíngue (PT ou EN)
- Atualiza status para `sent` e registra `sent_at`
- Requer `RESEND_API_KEY` configurado

---

### 7. Acompanhamento de Jobs (Agenda) — `/agenda`

Gestão de tarefas e marcos de projetos. Inspirado no Monday.com.

**Tipos de evento:**
`payment` / `delivery` / `meeting` / `milestone` / `deadline`

**Campos:**
- Título, descrição
- Job vinculado (opcional)
- Data do evento (`event_date`)
- Data de início (`start_date`) — para tarefas com duração
- Status: `todo` / `working_on_it` / `stuck` / `done`
- Prioridade: `low` / `medium` / `high`
- Orçamento (budget)
- Contagem de arquivos (files_count)

**4 Visualizações:**

#### Tabela
- Agrupada por status (To-Do / Working on it / Stuck / Done)
- Colunas: Tarefa, Status, Prazo, Orçamento, Timeline, Prioridade, Notas
- Clique no status para alternar
- Clique na linha para editar

#### Timeline
- Lista cronológica agrupada por mês
- Cards com status colorido, prioridade, período (início→fim), orçamento

#### Gantt
- Gráfico SVG com barras por tarefa
- Cabeçalho com meses e dias
- Linha vermelha vertical indicando "hoje"
- Cores por status da tarefa

#### Calendário
- Grade mensal (Dom→Sáb)
- Eventos do dia exibidos como chips coloridos
- Navegação por mês (anterior/próximo)
- Hoje destacado em azul

---

### 8. Status de Agenda — `/disponibilidade`

Configuração de disponibilidade do freelancer.

**Status disponíveis:**
| Status | Cor | Descrição |
|---|---|---|
| Disponível | Verde | Aceito novos projetos |
| Parcialmente disponível | Amarelo | Capacidade limitada |
| Ocupado | Laranja | Sem disponibilidade no momento |
| Indisponível | Vermelho | Fora de serviço |

**Campos configuráveis:**
- Disponível a partir de (data)
- Horas disponíveis por semana
- Dias de trabalho (Dom, Seg, Ter, Qua, Qui, Sex, Sáb — toggle por dia)
- Mensagem para clientes (texto livre)
- Toggle "Aceitar novos contatos"

**Comportamento:**
- Upsert — um único registro por usuário
- Exibe data/hora da última atualização
- Persiste no banco em `user_availability`

---

### 9. Relatórios — `/reports`

Análise financeira anual.

**KPIs:**
- Total faturado no ano
- Total recebido (invoices pagas)
- Total de horas faturadas
- Eficiência de cobrança (%)

**Visualizações:**
- Evolução mensal de receita e horas (gráfico composto)
- Receita por job com barras proporcionais
- Seletor de ano (ano atual ± 1)

---

### 10. Configurações — `/settings`

Gerenciamento da conta.

**Funcionalidades:**
- Exibe e-mail e ID do usuário logado
- Alterar senha
- Status das integrações:
  - Supabase (sempre conectado)
  - Resend (indica se `RESEND_API_KEY` está configurado)

---

## API Routes

### `GET /api/invoices/pdf`

Gera PDF da invoice.

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `id` | query string | ID da invoice |
| `lang` | query string | `pt` ou `en` |

**Autenticação:** obrigatória (verifica que o usuário é dono da invoice)
**Retorno:** arquivo PDF (`application/pdf`)

---

### `POST /api/invoices/send-email`

Envia invoice por e-mail via Resend.

```json
{
  "invoiceId": "uuid",
  "lang": "pt"
}
```

**Pré-condições:** cliente deve ter e-mail cadastrado
**Efeitos colaterais:** atualiza `status = 'sent'` e `sent_at` na invoice
**Retorno:** `{ success: true }` ou mensagem de erro

---

### `POST /api/auth/signout`

Encerra a sessão do usuário e redireciona para `/login`.

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
is_recurring, tax_rate, notes,
created_at, updated_at
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
id, invoice_id, log_id, date, description,
hours_billed, rate, subtotal
```

### Tabela: `invoice_sequences`
```
id, user_id, year, last_seq
```
> Garante numeração sequencial de invoices por ano (ex: `2024-001`, `2024-002`)

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
Incrementa e retorna o próximo número sequencial de invoice para o usuário no ano informado.

### Row Level Security (RLS)
Todas as tabelas têm RLS ativo. Cada usuário acessa **apenas seus próprios dados** via `auth.uid() = user_id`.

---

## Estrutura de Arquivos

```
FreelancerAdmin/
├── src/
│   ├── app/
│   │   ├── (app)/                     # Rotas protegidas (requer auth)
│   │   │   ├── layout.tsx             # Layout com sidebar
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx
│   │   │   │   └── client-dialog.tsx
│   │   │   ├── jobs/
│   │   │   │   ├── page.tsx
│   │   │   │   └── job-dialog.tsx
│   │   │   ├── logs/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── logs-client.tsx
│   │   │   │   ├── log-dialog.tsx
│   │   │   │   └── log-timer-button.tsx
│   │   │   ├── invoices/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── create-invoice-dialog.tsx
│   │   │   │   └── invoice-actions.tsx
│   │   │   ├── agenda/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── agenda-client.tsx
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
│   │   ├── (auth)/                    # Rotas públicas
│   │   │   └── login/page.tsx
│   │   ├── api/
│   │   │   ├── auth/signout/route.ts
│   │   │   └── invoices/
│   │   │       ├── pdf/route.ts
│   │   │       └── send-email/route.ts
│   │   ├── icon-192.png/route.tsx     # Ícone PWA 192×192
│   │   ├── icon-512.png/route.tsx     # Ícone PWA 512×512
│   │   ├── manifest.ts                # Web App Manifest (PWA)
│   │   └── layout.tsx                 # Root layout
│   ├── components/
│   │   ├── layout/sidebar.tsx
│   │   ├── ui/                        # shadcn/ui components
│   │   └── theme-provider.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   ├── server.ts             # Server Supabase client
│   │   │   ├── middleware.ts         # Auth middleware helper
│   │   │   └── types.ts             # TypeScript types das tabelas
│   │   ├── utils.ts                  # Formatação, cálculos
│   │   └── invoice-i18n.ts           # Traduções PT/EN para invoices
│   └── middleware.ts                  # Auth middleware Next.js
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql    # Schema completo inicial
│       ├── 002_agenda_tasks.sql      # Campos extras de agenda
│       └── 003_availability.sql      # Tabela de disponibilidade
└── DOCUMENTACAO.md                   # Este arquivo
```

---

## Fluxos Principais

### Criar e Enviar Invoice

```
1. /jobs → criar job com hourly_rate
2. /logs → registrar horas diárias (hours_billed)
3. /invoices → "Nova Invoice" → selecionar job + período
4. Sistema busca logs do período → preview
5. Confirmar → invoice criada com número automático
6. Ações → "Baixar PDF" (PT ou EN) ou "Enviar por e-mail"
7. Após recebimento → "Marcar como pago"
```

### Controle de Tempo

```
1. /logs → abrir registro do dia
2. Clicar ▶ Timer na linha → timer ao vivo
3. ⏸ Pausar → retomar depois
4. ⏹ Parar → soma o tempo ao hours_worked automaticamente
5. Editar registro → ajustar hours_billed manualmente se necessário
```

### Acompanhamento de Projeto

```
1. /agenda → "Nova tarefa"
2. Vincular ao job, definir prazo, prioridade
3. Acompanhar status pelo quadro (estilo Monday.com)
4. Alternar entre Tabela / Timeline / Gantt / Calendário
```

---

## Observações Técnicas

### Compatibilidade Supabase JS v2.101+
- Clientes Supabase criados **sem** o generic `<Database>` (causa tipo `never` em versões novas)
- Casts explícitos usam o padrão `as unknown as Tipo`

### Resend — Inicialização lazy
- `new Resend(key)` é instanciado **dentro do handler** da route, não no topo do arquivo
- Evita crash no build da Vercel quando `RESEND_API_KEY` não está definida

### PWA
- Ícones gerados dinamicamente via `next/og` (ImageResponse)
- Manifest via `src/app/manifest.ts` (convenção Next.js 14)
- Tema roxo (#7c3aed) com ícone "F" em gradiente

### Dark Mode
- Implementado via `next-themes`
- Toggle no rodapé da sidebar
- Persiste via `localStorage`
