# Freela Manager — Documentação Completa

> Sistema de gestão para freelancers: clientes, jobs, registro de horas, invoices, notas fiscais, contabilidade documental, agenda, projetos com Gantt, pipeline de vendas, portal do cliente, automações por e-mail e API pública.
>
> **Documentação atualizada em 16/09/2026** para refletir o código atual: 28 páginas, 33 tabelas, 29 migrations, 30 API routes, 3 buckets de storage.

---

## Índice

1. [Stack Tecnológica](#stack-tecnológica)
2. [Variáveis de Ambiente](#variáveis-de-ambiente)
3. [Regras de Negócio Principais](#regras-de-negócio-principais)
4. [Funcionalidades Implementadas](#funcionalidades-implementadas)
5. [API Routes](#api-routes)
6. [Banco de Dados](#banco-de-dados)
7. [Storage (Supabase)](#storage-supabase)
8. [Estrutura de Arquivos](#estrutura-de-arquivos)
9. [Fluxos Principais](#fluxos-principais)
10. [Observações Técnicas](#observações-técnicas)
11. [Scripts de Importação](#scripts-de-importação)
12. [Roadmap — Status das 50 Funcionalidades](#roadmap--status-das-50-funcionalidades)

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router) |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth (email/password) |
| Storage | Supabase Storage (3 buckets) |
| Estilização | Tailwind CSS + shadcn/ui + Radix UI |
| Gráficos | Recharts |
| PDF | jsPDF + jspdf-autotable (invoices, billing) |
| E-mail | Resend API (envio **e recebimento** via inbound webhook) |
| IA | Anthropic SDK (descrição de invoice, extração de PDF) |
| Pagamentos | Stripe (payment links + webhook) |
| Dados públicos | BrasilAPI (consulta de CNPJ) |
| Data/hora | date-fns (locale pt-BR) |
| Ícones | Lucide React |
| Notificações | Sonner (toast) |
| Tema | next-themes (dark/light mode) |
| Testes | Vitest (15 suítes em `src/lib/__tests__/`) |
| Deploy | Vercel (CI/CD via GitHub + Vercel Cron) |

---

## Variáveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=         # URL do projeto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Chave anon pública
SUPABASE_SERVICE_ROLE_KEY=        # Service role (usada pelo admin client em crons/webhooks)

# App
NEXT_PUBLIC_SITE_URL=             # URL do app (ex: https://seu-app.vercel.app)
NEXT_PUBLIC_APP_URL=              # URL pública usada em links de retorno (Stripe)

# Resend (e-mail)
RESEND_API_KEY=                   # Chave da API Resend
RESEND_FROM_EMAIL=                # Remetente (ex: invoices@seudominio.com)
RESEND_WEBHOOK_SECRET=            # Segredo de verificação (svix) do webhook inbound
RESEND_INBOUND_DOMAIN=            # Domínio de recebimento (plus-addressing por solicitação de NF)

# Cron
CRON_SECRET=                      # Bearer token que protege /api/cron/* (Vercel Cron)

# IA
ANTHROPIC_API_KEY=                # Claude — descrição de invoice e extração de jobs de PDF

# Stripe (opcional)
STRIPE_SECRET_KEY=                # Geração de payment links
STRIPE_WEBHOOK_SECRET=            # Verificação do webhook de pagamento
```

A página `/settings` mostra o status de cada integração (configurada ou não) em tempo de execução.

---

## Regras de Negócio Principais

### 1. Invoice é calculado sobre `hours_billed`

> **Invoice sempre calculado sobre `hours_billed` (horas contratadas), NUNCA sobre `hours_worked` (horas trabalhadas).**
>
> Fórmula: `total = hours_billed × hourly_rate`
>
> `hours_worked` serve apenas para controle interno de tempo real. `hours_billed` é o que vai para a fatura.

### 2. Três modos de cobrança por job

| `billing_mode` | Base de cálculo | Unidade do item na invoice |
|---|---|---|
| `hourly` (padrão) | `hours_billed × hourly_rate` | `hour` |
| `daily` | dias trabalhados × `daily_rate` (1 dia = 8h para relatórios) | `day` |
| `fixed` | preço fechado em `contract_value`; horas são registradas mas não viram dinheiro | `project` (quantidade 1) |

### 3. Duas numerações de invoice

- **`invoice_number`** — sequencial por ano (ex: `2024-001`), via função `get_next_invoice_number`.
- **`seq_number`** — sequencial contínuo de 4 dígitos (ex: `0102`), via função `get_next_invoice_seq` (atômica, contador em `user_settings.next_invoice_seq`). É o número que aparece para o cliente internacional.

### 4. Ciclo de vida da Nota Fiscal

```
not_required → pending → requested → issued → sent
```

- Invoices em moeda estrangeira são marcadas `not_required` até serem pagas.
- Séries: `paulinia` e `sao_paulo` — **a empresa mudou de cidade: notas emitidas até 2019 são da série Paulínia, de 2020 em diante são São Paulo** (`NF_SERIES_CUTOFF = "2020-01-01"` em `src/lib/nf-status.ts`).
- **Formato de exibição**: número com 4 dígitos + código da série — `0030 PLN` (Paulínia), `0015 SP` (São Paulo), via `formatNfNumber()`. No banco, `nf_number` guarda só os dígitos (`normalizeNfNumber()` limpa o que o usuário digitar: "30", "0030 PLN", "nfp 30" → `0030`).
- **Registros antigos sem série gravada** (importados antes da migration 016): a série é derivada na exibição pela data — `effectiveNfSeries(nf_series, nf_issued_at)` — então notas de 2015–2019 aparecem como PLN mesmo com `nf_series` nula no banco.
- No `/historico`, a coluna **Invoices** também carrega o código da época: `NFP056 PLN`, `0102 SP` (derivado de `nf_issued_at ?? period_start`).
- No dialog de registro, a **série é pré-selecionada pela data de emissão** e muda sozinha ao editar a data; uma prévia mostra como o número ficará.
- A NF é **solicitada ao contador por e-mail** (não há integração de emissão via API) — o sistema monta o e-mail com os dados fiscais do tomador e do prestador, envia via Resend com `replyTo` em plus-addressing, e a resposta do contador cai na caixa de entrada do app.
- Solicitação pode partir **da invoice** ou **direto do job** (preço fechado com valor e data próprios).
- Alerta de "acumulada" quando uma NF fica mais de 7 dias sem avançar de status.

### 5. Competência contábil

Documentos da empresa (guias DAS, pagamentos, honorários, TFE, DASN, extratos) são arquivados por **competência** (o mês a que se referem, `AAAA-MM`), não por data de upload. A guia do DAS de um mês é emitida no mês seguinte — arquivar guia e pagamento na mesma competência é o que os mantém juntos.

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
- **Metas do mês** — progresso das metas de horas e receita (`user_goals`)

**Gráficos:**
- Receita nos últimos 6 meses (AreaChart)
- Horas trabalhadas nos últimos 6 meses (BarChart)

**Listas:**
- Últimas 5 invoices criadas com status
- Próximos eventos da agenda (deadlines, entregas, reuniões)

---

### 3. Clientes — `/clients` e `/clients/[id]`

Cadastro e gerenciamento de clientes.

**Campos:** nome, empresa, e-mail, telefone, observações, **dados fiscais** (razão social, CNPJ, endereço, inscrição estadual, entidade/endereço de cobrança, regras de NF), **score** (1–5)

**Lista:**
- Todos os clientes com contagem de jobs
- Criar e editar via dialog
- Consulta de CNPJ via BrasilAPI preenche razão social e endereço (`/api/cnpj`)

**Detalhe do cliente (`/clients/[id]`):**
- Card de contato e dados fiscais
- **Score do cliente** (avaliação interna 1–5)
- Card financeiro (faturado, recebido, em aberto)
- **Contatos adicionais** — nome, cargo, e-mail, telefone e flag `cc_invoices` (o contato é copiado no e-mail da invoice)
- **Histórico de interações** — timeline de e-mails, ligações, reuniões e notas (`client_interactions`)
- **Link do portal do cliente** — gera/copia o link público (`client_portal_tokens`)
- Invoices do cliente

---

### 4. Jobs — `/historico` (alias `/jobs`) e `/jobs/[id]`

A listagem principal de jobs é a página **Histórico** (`/historico`, com `/jobs` como alias na navegação).

**Campos do job:**
- Nome, descrição, cliente
- **Modo de cobrança**: `hourly` / `daily` / `fixed` + taxa horária, taxa diária e valor do contrato
- Moeda: BRL, USD ou EUR
- Status: `proposal` / `active` / `paused` / `completed`
- **Código do projeto** (`project_code`), **PO** (`po_number`), cliente final (`end_client`), intermediário
- **Timezone e horário de trabalho** (ex: `America/Los_Angeles`, `09:00-18:00`) — exibidos convertidos para o horário local
- **Confidencial** (`is_confidential`)
- **Descrição para NF** (`nf_description`)
- Thumbnail (imagem do projeto, bucket público)
- Recorrente (flag), alíquota de imposto, observações

**Histórico (`/historico`):**
- Tabela densa com colunas **reordenáveis por drag-and-drop** (ordem persistida em `localStorage`)
- Ordenação por coluna (valor, horas, NF, etc.)
- Status de cobrança por job: sem invoice / a receber / recebido
- Colunas de **documentos anexados** (✓ por tipo: contrato, invoice, NF, DAS, comprovante…)
- Colunas de **solicitações de NF enviadas** e **respostas do contador** (via e-mail inbound)
- Ação de solicitar NF direto da linha

**Detalhe do job (`/jobs/[id]`):**
- Header com status, modo de cobrança, taxa, timezone convertido
- Formulário de edição completo
- **Painel de documentos** — upload/download dos 7 tipos (ver [Storage](#storage-supabase)); um arquivo por tipo, reenviar substitui
- Invoices do job com status e ações
- Logs de horas do job
- Ações: solicitar NF ao contador, anexar PDF da invoice como documento

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
- **Arredondamento de horas** — `hour_rounding` em `user_settings` (`none` / `0.25` / `0.5` / `1`) aplicado ao sugerir `hours_billed` a partir do trabalhado
- Criar, editar e duplicar registros
- Status: "Concluído" (verde) se `hours_billed > 0`, "Em andamento" (azul) caso contrário
- **Exportar CSV**

---

### 6. Invoices — `/invoices`

Geração e gestão de faturas.

**Campos:**
- `invoice_number` sequencial por ano (ex: `2024-001`) **e** `seq_number` contínuo de 4 dígitos
- Job e período (data início/fim)
- Total de horas faturadas, subtotal, imposto, total
- Moeda, data de vencimento, PO
- Status: `draft` / `sent` / `paid` / `overdue`
- **Status de NF** (`nf_status`) com série, número, data e valor emitido
- Observações

**Fluxo de criação:**
1. Selecionar job, período, data de vencimento
2. Sistema busca todos os `daily_logs` do período
3. Preview mostra cada log como linha de item (unidade `hour`/`day`/`project` conforme o modo do job)
4. Ao confirmar: cria `invoice` + `invoice_items`
5. Numerações via funções PostgreSQL `get_next_invoice_number` e `get_next_invoice_seq`

**Ações por invoice:**
- Baixar PDF (PT ou EN) — `/api/invoices/pdf?id=X&lang=pt|en`
- Enviar por e-mail (PT ou EN) — via Resend, **copiando contatos com `cc_invoices`**
- **Gerar descrição com IA** — Claude resume os logs em texto profissional (`/api/invoices/ai-description`)
- **Link de pagamento Stripe** — Checkout Session por invoice (`/api/invoices/payment-link`)
- **Solicitar NF ao contador** — e-mail fiscal completo (`/api/invoices/nf-request`)
- Marcar como pago — atualiza status e `paid_at`; **pagamentos internacionais** registram câmbio (`exchange_rate`, `amount_received_brl`, `fees`, método `wire`)
- **Pagamentos parciais** — múltiplos recebimentos por invoice (`invoice_payments`) com saldo em aberto

**PDF inclui:** número, dados do cliente, tabela de itens, totais, observações, **bloco de dados bancários** (conta BR, conta internacional + banco intermediário, PIX) e **contato do emissor** (e-mail/telefone junto à razão social)

---

### 7. Notas Fiscais — `/notas-fiscais`

Painel de acompanhamento do ciclo de vida das NFs.

- Lista invoices com NF (exclui `not_required`) com job, cliente, série, número, datas e valores — número exibido no formato `0030 PLN` / `0015 SP`
- Filtros por **status**, **série** (Paulínia / São Paulo) e **ano**
- **Alertas de integridade**: lacunas e duplicatas na sequência de invoices e na numeração de NF por série
- Contador de NFs **acumuladas há mais de 7 dias** sem avançar
- Ações de invoice inline (PDF, e-mail, solicitação de NF)

---

### 8. E-mails — `/emails`

Caixa de entrada das respostas do contador (e outras mensagens recebidas no domínio inbound).

- **Recebimento duplo**: webhook do Resend (`/api/inbound/nf`, verificação svix) como caminho rápido + **poll** via cron (`/api/cron/check-emails`) que importa o que o webhook perder — nada se perde
- Cada mensagem é associada automaticamente à solicitação de NF, invoice ou job (via plus-addressing no `replyTo`)
- **Threads**: respostas escritas no app ficam na mesma conversa (`direction` = `in`/`out`, `in_reply_to`)
- **Responder com anexos** (até 25 MB) — sai do mesmo remetente das solicitações e mantém o plus-address para a próxima resposta cair na mesma thread
- Anexo PDF de NF é **arquivado automaticamente** como documento do job; se a associação automática falhar, o botão **"Arquivar como NF"** deixa escolher o job manualmente (`/api/inbound/nf/file-attachment`)
- Botão **Atualizar** roda o poll sob demanda (`/api/emails/refresh`)

---

### 9. Despesas — `/despesas`

Controle de gastos do negócio.

**Categorias:** Software/SaaS 💻 · Hardware 🖥️ · Curso/Educação 📚 · Imposto/Contador 🧾 · Serviço/Terceiro 🔧 · Outro 📦

**Funcionalidades:**
- Navegação por mês, lista paginada ("carregar mais")
- **Gráfico de pizza** por categoria (ano)
- Criar, editar, excluir via dialog
- **Importar e exportar CSV**

---

### 10. Contabilidade — `/contabilidade` e `/contabilidade/[competencia]`

Arquivo documental da empresa, organizado por **competência** (mês de referência).

**Tipos de documento:** guia DAS, pagamento DAS, recibo de honorários, pagamento de honorários, TFE, guia DASN, pagamento DASN, extrato bancário — com escopo **mensal ou anual**

**Lista (`/contabilidade`):**
- Uma linha por competência com contagem de arquivos por tipo
- Sem regra de um-arquivo-por-slot: um mês pode ter vários extratos ou uma guia recalculada ao lado da original

**Detalhe (`/contabilidade/AAAA-MM`):**
- Painel de upload/download por tipo, com valor opcional por documento
- Navegação entre competências

---

### 11. Acompanhamento de Jobs (Agenda) — `/agenda`

Gestão de tarefas e marcos de projetos no estilo Monday.com.

**Tipos:** `payment` / `delivery` / `meeting` / `milestone` / `deadline`

**Campos:** título, descrição, job vinculado, `event_date`, `start_date`, status, prioridade, orçamento, `files_count`, **recorrência** (`none` / `daily` / `weekly` / `biweekly` / `monthly` + data fim)

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

### 12. Status de Agenda — `/disponibilidade`

Configuração de disponibilidade do freelancer para novos projetos.

| Status | Cor | Significado |
|---|---|---|
| Disponível | Verde | Aceito novos projetos |
| Parcialmente disponível | Amarelo | Capacidade limitada |
| Ocupado | Laranja | Sem disponibilidade no momento |
| Indisponível | Vermelho | Fora de serviço |

**Campos:** disponível a partir de, horas/semana, dias de trabalho (toggle por dia), mensagem para clientes, aceitar novos contatos (toggle)

**Holds de clientes** (`availability_holds`): reservas de agenda no estilo de produção audiovisual — `1st_hold`, `2nd_hold`, `booked` — com cliente, job, período e nota.

**Comportamento:** upsert — um único registro por usuário, exibe data/hora da última atualização. Folgas (`/folgas`) sincronizam a disponibilidade do dia automaticamente.

---

### 13. Projetos (Gantt) — `/projetos` e `/projetos/[id]`

Gerenciador dedicado de projetos com visualização Gantt.

**Página de lista `/projetos`:**
- Cards de projetos com: nome, cliente, status, barra de progresso (% tarefas concluídas), período
- Indicador de cor configurável por projeto
- Criar novo projeto via dialog: nome, descrição, cliente, status, cor, datas
- **Templates de projeto** (`project_templates`) — estruturas de tarefas reutilizáveis

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
- **Subtarefas/checklist** por tarefa (`project_task_items`)

**Status de tarefa:** `todo` / `in_progress` / `done` / `blocked`

**Tabelas:** `projects`, `project_tasks`, `project_task_items`, `project_templates`

---

### 14. Diário — `/diario`

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

### 15. Metas — `/metas`

Metas mensais de horas e receita.

- Dois cards: **meta de horas** e **meta de receita** do mês, com barra de progresso contra o realizado
- Navegação por mês
- Mostra também as **despesas do mês** (visão de lucro)
- Metas por período (`AAAA-MM`), upsert por tipo (`user_goals`)

---

### 16. Folgas — `/folgas`

Calendário de férias, feriados e folgas.

**Tipos:** 🏖️ Férias · 🎉 Feriado · 😴 Folga · 🤒 Doença · 📌 Outro

- Grade mensal com chips coloridos por tipo
- Um registro por dia (`unique(user_id, date)`), criar clicando no dia, excluir por dialog
- Resumo do ano
- **Sincroniza a disponibilidade** do dia automaticamente

---

### 17. Pipeline de Vendas — `/pipeline`

Funil Kanban de oportunidades (CRM).

**Estágios:** Lead (cinza) → Contatado (azul) → Proposta (âmbar) → Negociação (roxo) → Fechado (verde) / Perdido (vermelho)

- **Drag-and-drop** entre colunas (posição persistida)
- Cards com título, cliente, valor e data esperada de fechamento
- Criar/editar/excluir deals via dialog
- Valor total por estágio
- Deals parados aparecem como badge na navegação (sidebar)

---

### 18. Automações — `/automacoes`

Painel de automações recorrentes (executadas pelo Vercel Cron).

| Automação | Configuração | Cron (UTC) |
|---|---|---|
| **Lembretes de cobrança** | toggle + N dias após vencimento | `0 8 * * *` (diário 08:00) |
| **Resumo semanal por e-mail** | toggle + dia da semana | `0 8 * * 1` (segunda 08:00) |
| **Invoice recorrente** | toggle + job + frequência **mensal** (dia do mês) ou **semanal** (dia da semana + início da semana) + prazo de vencimento (dias líquidos) | `0 7 * * *` (diário 07:00) |
| **Keep-alive** | ping no banco para não hibernar | `0 6 */4 * *` |
| **Verificar e-mails** | poll do inbound do Resend | `47 6 * * *` (diário 06:47) |

- Botão **"Testar"** dispara cada automação manualmente (`/api/automations/run`, sem expor o `CRON_SECRET` ao navegador)
- **Log de execuções** (`automation_log`) com status ok/erro
- Invoice recorrente gera **rascunho** respeitando o modo de cobrança do job e cria lembrete na agenda para envio

---

### 19. Relatórios — `/reports`

Análise financeira anual.

**KPIs:** total faturado, total recebido (invoices pagas), horas faturadas, eficiência de cobrança (%)

**Visualizações:**
- Evolução mensal de receita e horas (gráfico composto)
- Receita por job com barras proporcionais
- Seletor de ano (atual ± 1)

**Relacionado:** timesheet semanal em CSV por job — `/api/reports/timesheet?job_id=X&week=AAAA-MM-DD&week_start=0-6` (padrão domingo→sábado, compatível com estúdios americanos)

---

### 20. Configurações — `/settings`

- **Dados da empresa** (`CompanyForm`): razão social, nome fantasia, CNPJ/CPF, inscrição municipal, endereço fiscal, logo, cor da invoice, contato impresso (e-mail/telefone)
- **Dados bancários**: conta BR (banco/agência/conta), conta internacional (SWIFT/IBAN/ABA…), **banco intermediário**, chave PIX
- **Contador**: nome e e-mail (destino das solicitações de NF)
- **Preferências**: arredondamento de horas
- **Conta**: e-mail, ID, alterar senha
- **API Keys**: criar chaves `fm_…` (hash sha256, prefixo visível) para a API REST
- **Webhooks**: URLs de saída com eventos assinados (`invoice.created`, `invoice.paid`, `invoice.overdue`, `client.created`, `job.created`, `log.created`, `expense.created`), teste de disparo e log de entregas
- **Integrações**: status de Supabase, Resend (envio e inbound), Anthropic, Stripe
- **Backup de dados**: exporta todos os dados da conta em JSON (`/api/export`)

---

### 21. Portal do Cliente — `/portal/[token]`

Página **pública** (sem login) que cada cliente acessa por link único.

- Valida o token em `client_portal_tokens` (policy pública de leitura)
- Exibe: dados do cliente, jobs com status, **invoices com download de PDF** (`/api/portal/pdf`) e projetos em andamento
- **Confirmar pagamento** — o cliente marca a invoice como paga pelo portal (`/api/portal/confirm-payment`, grava `client_confirmed_at`)

---

### 22. PWA & Offline

- Manifest via `src/app/manifest.ts`, ícones gerados via `next/og`
- Service worker (`public/sw.js`) com cache de páginas visitadas
- Página `/offline` como fallback sem conexão
- Busca global **Cmd+K** (`CommandPalette`, montada na sidebar) pesquisando clientes, jobs, logs, invoices e projetos

---

## API Routes

### Invoices

| Rota | Método | Descrição |
|---|---|---|
| `/api/invoices/pdf` | GET | Gera PDF da invoice. Params: `id`, `lang` (`pt`/`en`). Requer auth |
| `/api/invoices/send-email` | POST | Envia invoice por e-mail via Resend. Body: `{ invoiceId, lang }`. Atualiza `status='sent'` e `sent_at`. Copia contatos com `cc_invoices` |
| `/api/invoices/ai-description` | POST | Gera descrição dos itens com Claude a partir dos logs. Body: `{ invoiceId}`. Requer `ANTHROPIC_API_KEY` |
| `/api/invoices/payment-link` | POST | Cria Stripe Checkout Session para a invoice. Requer `STRIPE_SECRET_KEY` |
| `/api/invoices/nf-request` | POST | Envia e-mail de solicitação de NF ao contador (a partir da invoice **ou do job**), grava `nf_requests`, avança `nf_status` para `requested` |

### Portal do cliente (público, auth por token)

| Rota | Método | Descrição |
|---|---|---|
| `/api/portal/pdf` | GET | PDF da invoice validando `token` + `invoice_id` |
| `/api/portal/confirm-payment` | POST | Cliente confirma pagamento (`client_confirmed_at`) |

### E-mail inbound

| Rota | Método | Descrição |
|---|---|---|
| `/api/inbound/nf` | POST | Webhook do Resend (verificação svix via `RESEND_WEBHOOK_SECRET`). Processa e arquiva respostas do contador |
| `/api/inbound/nf/reply` | POST | Resposta escrita na caixa de entrada, com anexos (até 25 MB). Mantém plus-address da thread |
| `/api/inbound/nf/file-attachment` | POST | Arquiva manualmente um anexo PDF como NF de um job |
| `/api/emails/refresh` | POST | Roda o poll de e-mails recebidos sob demanda (botão "Atualizar") |

### Cron (protegidas por `CRON_SECRET`, agendadas no `vercel.json`)

| Rota | Schedule (UTC) | Descrição |
|---|---|---|
| `/api/cron/billing-reminders` | `0 8 * * *` | E-mail de lembrete para invoices vencidas há N dias |
| `/api/cron/weekly-summary` | `0 8 * * 1` | Resumo semanal por e-mail (horas, faturamento, vencimentos) |
| `/api/cron/recurring-invoices` | `0 7 * * *` | Gera rascunho de invoice recorrente (mensal/semanal) + lembrete na agenda |
| `/api/cron/check-emails` | `47 6 * * *` | Poll do inbound do Resend — importa o que o webhook perdeu |
| `/api/cron/keep-alive` | `0 6 */4 * *` | Ping no Supabase para evitar hibernação |

| Rota | Método | Descrição |
|---|---|---|
| `/api/automations/run` | POST | Dispara um cron manualmente (botão "Testar") sem expor o `CRON_SECRET` |

### Plataforma

| Rota | Método | Descrição |
|---|---|---|
| `/api/api-keys` | POST | Cria API key `fm_<48 hex>`; grava só o hash sha256 + prefixo |
| `/api/export` | GET | Backup completo da conta em JSON |
| `/api/cnpj` | GET | Proxy da BrasilAPI: razão social, endereço e situação a partir do CNPJ |
| `/api/reports/timesheet` | GET | Timesheet semanal em CSV. Params: `job_id`, `week`, `week_start` |
| `/api/webhooks/stripe` | POST | Webhook do Stripe (assinatura HMAC) — confirma pagamento da invoice |
| `/api/webhooks/test` | POST | Dispara evento de teste para um webhook de saída do usuário |
| `/api/auth/signout` | POST | Encerra a sessão e redireciona para `/login` |

### API REST pública v1 (auth: `Authorization: Bearer fm_…`)

| Rota | Descrição |
|---|---|
| `GET /api/v1` | Índice dos endpoints |
| `GET /api/v1/clients` | Lista clientes |
| `GET /api/v1/jobs` | Lista jobs |
| `GET /api/v1/invoices` | Lista invoices |
| `GET /api/v1/logs` | Logs diários (`?from=AAAA-MM-DD&to=AAAA-MM-DD`) |
| `GET /api/v1/expenses` | Despesas (`?from=` / `?to=`) |

---

## Banco de Dados

### Tabela: `clients`
```
id, user_id, name, company, email, phone, notes,
score (1–5),
legal_name, cnpj, address, state_registration,
billing_entity, billing_address, nf_rules,
created_at, updated_at
```

### Tabela: `client_contacts`
```
id, client_id, name, role, email, phone,
cc_invoices (bool — copiado no e-mail da invoice),
created_at
```

### Tabela: `jobs`
```
id, user_id, client_id, name, description,
billing_mode (hourly|daily|fixed),
hourly_rate, daily_rate, contract_value, currency,
status, start_date, end_date,
project_code, po_number, end_client, intermediary, nf_description,
timezone, work_hours, is_confidential,
thumbnail_url,
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
id, user_id, job_id, invoice_number, seq_number, po_number,
period_start, period_end,
total_hours_billed, subtotal, tax_rate, tax_amount, total,
currency, status, sent_at, paid_at, due_date, notes,
client_confirmed_at,
nf_status (not_required|pending|requested|issued|sent),
nf_series (paulinia|sao_paulo), nf_number, nf_issued_at, nf_amount_brl,
nf_requested_at, nf_sent_at,
created_at, updated_at
```
Índices únicos: `(user_id, seq_number)` e `(user_id, nf_series, nf_number)`.

### Tabela: `invoice_items`
```
id, invoice_id, log_id, date, description,
hours_billed, rate, subtotal,
quantity, unit (hour|day|project),
job_number, is_manual
```

### Tabela: `invoice_payments` (pagamentos parciais)
```
id, invoice_id, user_id, amount, paid_at,
method (pix|ted|cartao|boleto|wire|outro),
exchange_rate, amount_received_brl, fees,   -- câmbio em recebimentos internacionais
notes, created_at
```

### Tabela: `invoice_sequences`
```
id, user_id, year, last_seq
```
> Garante numeração sequencial de invoices por ano (ex: `2024-001`)

### Tabela: `nf_requests` (solicitações de NF ao contador)
```
id, user_id,
invoice_id (nullable), job_id (nullable),   -- pelo menos um dos dois (check)
sent_to, reply_to, subject, body,
resend_id, status (sent|failed), error, created_at
```

### Tabela: `inbound_emails` (caixa de entrada)
```
id, user_id, nf_request_id, invoice_id, job_id,
resend_email_id (unique), from_email, to_email, subject, body,
attachments (jsonb), filed (bool), note,
direction (in|out), in_reply_to,
created_at
```

### Tabela: `agenda_events`
```
id, user_id, job_id, title, description,
type, event_date, is_done,
task_status, priority, budget, start_date, files_count,
recurrence (none|daily|weekly|biweekly|monthly), recurrence_end,
created_at, updated_at
```

### Tabela: `user_availability`
```
id, user_id, status,
available_from, hours_per_week, working_days[],
message, accepting_projects, updated_at
```

### Tabela: `availability_holds`
```
id, user_id, client_id, job_id,
type (1st_hold|2nd_hold|booked),
start_date, end_date, note, created_at
```

### Tabelas: `projects` e `project_tasks`
```
projects:      id, user_id, client_id, name, description, status, color,
               start_date, end_date, created_at, updated_at
               status: planning|active|on_hold|completed|cancelled

project_tasks: id, project_id, user_id, title, description,
               status (todo|in_progress|done|blocked), progress (0–100),
               start_date, end_date, position, created_at, updated_at

project_task_items: id, task_id, text, is_done, position, created_at  -- checklist

project_templates:  id, user_id, name, tasks (jsonb), created_at
```

### Tabela: `daily_journal`
```
id, user_id, date (unique per user),
content, mood (great|good|okay|bad|terrible), highlights[],
created_at, updated_at
```

### Tabelas financeiras
```
expenses:   id, user_id, category (software|hardware|curso|imposto|servico|outro),
            description, amount, date, notes, created_at, updated_at

user_goals: id, user_id, type (hours_month|revenue_month),
            target, period (AAAA-MM), created_at
            unique(user_id, type, period)

time_off:   id, user_id, date, type (ferias|feriado|folga|doenca|outro),
            note, created_at
            unique(user_id, date)
```

### Tabelas de automação
```
automation_settings: user_id (pk),
  billing_reminder_enabled, billing_reminder_days,
  weekly_summary_enabled, weekly_summary_day,
  recurring_invoice_enabled, recurring_invoice_job_id,
  recurring_invoice_frequency (monthly|weekly),
  recurring_invoice_day, recurring_invoice_weekday,
  recurring_invoice_week_start, recurring_invoice_due_days,
  updated_at

automation_log: id, user_id, type, payload (jsonb),
  status (ok|error), error_msg, created_at
```

### Tabelas de CRM
```
sales_pipeline:      id, user_id, client_id,
                     stage (lead|contacted|proposal|negotiation|won|lost),
                     title, value, expected_close, notes, position,
                     created_at, updated_at

client_interactions: id, user_id, client_id,
                     type (email|call|meeting|note|proposal),
                     summary, happened_at, created_at

client_portal_tokens: id, user_id, client_id (unique), token (unique), created_at
                      -- leitura pública para validação do portal
```

### Tabelas de plataforma
```
api_keys:           id, user_id, name, key_hash (unique, sha256),
                    key_prefix, is_active, last_used, created_at

webhooks:           id, user_id, name, url, events[], secret,
                    is_active, last_fired, created_at

webhook_deliveries: id, webhook_id, event, payload (jsonb),
                    status_code, response, fired_at

payment_links:      id, user_id, invoice_id,
                    provider (stripe|mercadopago), link_url,
                    status (pending|paid|expired), created_at
```

### Tabelas de documentos
```
job_documents:         id, user_id, job_id,
                       kind (contract|invoice|accountant_email|nf|das_issued|das_paid|payment_proof),
                       path, file_name, mime_type, size_bytes, uploaded_at
                       unique(job_id, kind)  -- um arquivo por tipo; reenviar substitui

accounting_documents:  id, user_id, competencia (date),
                       scope (month|year),
                       kind (das_guide|das_payment|fee_receipt|fee_payment|
                             tfe|dasn_guide|dasn_payment|statement),
                       path (unique), file_name, mime_type, size_bytes,
                       amount, uploaded_at
```

### Tabela: `user_settings`
```
user_id (pk), company_name, cnpj_cpf, logo_url, invoice_color,
hour_rounding (none|0.25|0.5|1),
legal_name, municipal_registration, fiscal_address,
accountant_name, accountant_email, next_invoice_seq,
invoice_contact_email, invoice_contact_phone,
pix_key,
bank_beneficiary, bank_name, bank_account_type, bank_account_number,
bank_routing, bank_swift, bank_iban, bank_address,        -- conta que recebe wire
br_bank_name, br_bank_agency, br_bank_account,            -- conta para tomador BR
fx_bank_name, fx_bank_agency, fx_bank_account, fx_bank_swift,  -- conta de fechamento de câmbio
intermediary_bank_name, intermediary_bank_swift,
intermediary_bank_aba, intermediary_bank_account,
intermediary_bank_address,
created_at, updated_at
```

### Funções PostgreSQL
- `get_next_invoice_number(p_user_id, p_year)` — próximo número sequencial por ano. Thread-safe via lock
- `get_next_invoice_seq(p_user_id)` — próximo `seq_number` de 4 dígitos, contínuo, atômico (upsert em `user_settings.next_invoice_seq`)

### Row Level Security (RLS)
Todas as tabelas têm RLS ativo. Cada usuário acessa **apenas seus próprios dados** via `auth.uid() = user_id`. Exceções deliberadas:
- `client_portal_tokens` tem policy pública de **leitura** (o portal valida o token sem login)
- Buckets de storage têm policies próprias (ver abaixo)

### Migrations

| Arquivo | Conteúdo |
|---|---|
| `001_initial_schema.sql` | Schema inicial: tabelas base, RLS, triggers, índices, `get_next_invoice_number` |
| `002_agenda_tasks.sql` | `task_status`, `priority`, `budget`, `start_date`, `files_count` em `agenda_events` |
| `003_availability.sql` | Tabela `user_availability` |
| `004_projects.sql` | Tabelas `projects` e `project_tasks` |
| `005_journal.sql` | Tabela `daily_journal` |
| `006_user_settings.sql` | Tabela `user_settings` (empresa, logo, cor, arredondamento) |
| `007_financeiro.sql` | `expenses`, `invoice_payments`, `user_goals` |
| `008_projetos_avancado.sql` | `project_task_items`, `project_templates`, `time_off` |
| `009_automacoes.sql` | `automation_settings`, `automation_log`, recorrência em `agenda_events` |
| `010_crm.sql` | `clients.score`, `sales_pipeline`, `client_interactions`, `client_portal_tokens` |
| `011_plataforma.sql` | `api_keys`, `webhooks`, `payment_links`, `webhook_deliveries` |
| `012_portal_confirmation.sql` | `invoices.client_confirmed_at` |
| `013_international_billing.sql` | `billing_mode` (hourly/daily), `project_code`, itens em hora/dia, dados bancários + PIX |
| `014_weekly_invoices_holds.sql` | Invoice recorrente semanal; `availability_holds` |
| `015_timezone_fx_confidential.sql` | Timezone/horário/confidencial no job; câmbio em `invoice_payments` |
| `016_nf_lifecycle.sql` | Ciclo de vida da NF: `seq_number`, `nf_*`, dados fiscais, `nf_requests`, `get_next_invoice_seq` |
| `017_job_thumbnails.sql` | `jobs.thumbnail_url` + bucket público `job-thumbnails` |
| `018_job_documents.sql` | `job_documents` + bucket privado `job-documents` |
| `019_job_document_kinds.sql` | 7º tipo (`accountant_email`); `das_received` → `das_issued` |
| `020_accounting_documents.sql` | `accounting_documents` + bucket privado `accounting-documents` |
| `021_billing_mode_fixed.sql` | `billing_mode` ganha `fixed` (preço fechado) |
| `022_invoice_item_unit_project.sql` | Itens de invoice com unidade `project` |
| `023_contact_cc_invoices.sql` | `client_contacts.cc_invoices` |
| `024_client_state_registration.sql` | `clients.state_registration` |
| `025_nf_request_from_job.sql` | `nf_requests` pode apontar para job (sem invoice) |
| `026_nf_bank_blocks.sql` | Contas `br_bank_*` e `fx_bank_*` em `user_settings` |
| `027_inbound_emails.sql` | Tabela `inbound_emails` |
| `028_inbound_email_replies.sql` | Threads: `direction` + `in_reply_to` |
| `029_invoice_contact.sql` | Contato do emissor impresso na invoice |

---

## Storage (Supabase)

| Bucket | Público | Limite | Conteúdo |
|---|---|---|---|
| `job-thumbnails` | ✅ sim | 5 MB | Imagens de capa dos jobs (png/jpeg/webp/gif/avif) |
| `job-documents` | ❌ não | 10 MB | Contratos, invoices, NFs, DAS, comprovantes (pdf/png/jpeg) — leitura via URL assinada; também guarda os anexos da caixa de entrada |
| `accounting-documents` | ❌ não | 10 MB | Guias DAS/DASN, honorários, TFE, extratos (pdf/png/jpeg) |

Escrita sempre confinada à pasta nomeada com o `user_id` do chamador (`(storage.foldername(name))[1] = auth.uid()::text`).

---

## Estrutura de Arquivos

```
FreelancerAdmin/
├── src/
│   ├── app/
│   │   ├── (app)/                        # Rotas protegidas (layout com sidebar)
│   │   │   ├── dashboard/
│   │   │   ├── clients/ + [id]/          # Lista + detalhe (contatos, score, interações, portal)
│   │   │   ├── jobs/ + [id]/             # Form + detalhe (documentos, NF, invoices)
│   │   │   ├── historico/                # Tabela principal de jobs (colunas reordenáveis)
│   │   │   ├── logs/                     # Timesheet + timers
│   │   │   ├── invoices/                 # Invoices + ações (PDF, e-mail, IA, Stripe, NF)
│   │   │   ├── notas-fiscais/            # Painel do ciclo de vida da NF
│   │   │   ├── emails/                   # Caixa de entrada (threads, anexos, arquivar NF)
│   │   │   ├── despesas/                 # Despesas + gráfico + CSV
│   │   │   ├── contabilidade/ + [competencia]/  # Arquivo documental por mês
│   │   │   ├── agenda/                   # 4 views (Tabela/Timeline/Gantt/Calendário)
│   │   │   ├── disponibilidade/          # Status + holds de clientes
│   │   │   ├── projetos/ + [id]/         # Gantt + lista + subtarefas + templates
│   │   │   ├── diario/                   # Calendário com humor
│   │   │   ├── metas/                    # Metas mensais de horas e receita
│   │   │   ├── folgas/                   # Férias/feriados/folgas
│   │   │   ├── pipeline/                 # Kanban de vendas
│   │   │   ├── automacoes/               # Toggles + teste + log das automações
│   │   │   ├── reports/                  # Relatórios anuais
│   │   │   └── settings/                 # Empresa, bancos, API keys, webhooks, backup
│   │   ├── (auth)/login/
│   │   ├── portal/[token]/               # Portal público do cliente
│   │   ├── offline/                      # Fallback PWA
│   │   ├── api/                          # 30 rotas (ver seção API Routes)
│   │   ├── manifest.ts                   # PWA manifest
│   │   └── icon-192|512.png/             # Ícones via next/og
│   ├── components/
│   │   ├── layout/sidebar.tsx            # Nav + badges (invoices vencidas, deals parados) + CommandPalette
│   │   ├── command-palette.tsx           # Busca global (Cmd+K)
│   │   ├── ui/                           # shadcn/ui
│   │   └── ...
│   ├── hooks/use-paginated-list.ts
│   └── lib/
│       ├── supabase/                     # client, server, middleware, admin (service role), types
│       ├── invoice-pdf.ts, billing-pdf.ts, invoice-i18n.ts, invoice-items.ts, invoice-layout.ts
│       ├── nf-request.ts, nf-status.ts, nf-sequence.ts, nfse-prefeitura.ts
│       ├── inbound-email.ts, process-received-email.ts
│       ├── job-documents.ts, accounting-documents.ts, job-history.ts, job-thumbnail.ts
│       ├── billing-mode.ts, timezone.ts, cnpj.ts, text-case.ts
│       ├── api-auth.ts, cron-auth.ts, portal-auth.ts, webhooks.ts, webhook-events.ts
│       ├── csv.ts, emails.ts, column-order.ts, utils.ts
│       ├── fonts/                        # Família Jost embutida para PDFs
│       └── __tests__/                    # 15 suítes Vitest
├── supabase/migrations/                  # 001–029
├── scripts/                              # Importação/manutenção de dados (ver abaixo)
├── public/sw.js                          # Service worker
├── vercel.json                           # 5 crons agendados
└── DOCUMENTACAO.md
```

---

## Fluxos Principais

### Criar e Enviar Invoice
```
/jobs       → criar job com billing_mode, taxa e cliente
/logs       → registrar horas diárias (hours_billed)
/invoices   → "Nova Invoice" → selecionar job + período
             Sistema busca logs → preview com totais
             Confirmar → invoice criada com número automático (ano + seq de 4 dígitos)
             Ações → Baixar PDF (PT/EN) · Enviar por e-mail (com CC dos contatos)
                     Gerar descrição com IA · Link de pagamento Stripe
             Após recebimento → "Marcar como pago" (com câmbio, se internacional)
```

### Ciclo completo da Nota Fiscal
```
Invoice paga (ou job de preço fechado)
  → "Solicitar NF" → sistema monta e-mail fiscal (tomador, CNPJ, IE, PO, valores,
    bloco bancário BR ou internacional + intermediário)
  → envio via Resend com replyTo em plus-addressing → nf_status = requested
  → contador responde → webhook (ou poll) grava na caixa de entrada /emails
  → PDF da NF anexado é arquivado como documento do job (automático ou manual)
  → registrar número/série/valor → nf_status = issued → sent
/notas-fiscais → acompanha pendências, lacunas e duplicatas de sequência
```

### Controle de Tempo
```
/logs       → linha do registro → clicar ▶ Timer
             Timer ao vivo com contagem de segundos
             ⏸ Pausar → retomar depois
             ⏹ Parar → soma ao hours_worked automaticamente
             Editar registro → ajustar hours_billed (com arredondamento configurado)
```

### Acompanhamento de Projeto
```
/agenda     → "Nova tarefa" → vincular ao job, prazo, prioridade, recorrência
             Acompanhar status no quadro (estilo Monday.com)
             Alternar entre Tabela / Timeline / Gantt / Calendário
/projetos   → Gantt dedicado com subtarefas e templates
```

### Automações (Vercel Cron)
```
Diário 07:00 UTC  → gera rascunho de invoice recorrente (mensal ou semanal)
Diário 08:00 UTC  → lembretes de cobrança de invoices vencidas
Segunda 08:00 UTC → resumo semanal por e-mail
Diário 06:47 UTC  → poll de e-mails recebidos (fallback do webhook)
A cada 4 dias     → keep-alive do Supabase
Tudo configurável e testável em /automacoes
```

---

## Observações Técnicas

### Supabase JS v2.101+ — sem generic `<Database>`
Clientes criados **sem** `createBrowserClient<Database>()` — versões novas causam tipo `never` em todos os inserts. Casts explícitos usam `as unknown as Tipo`.

### Admin client separado
`src/lib/supabase/admin.ts` usa `SUPABASE_SERVICE_ROLE_KEY` para crons e webhooks (contorna RLS). Nunca importar em código de cliente.

### Resend — inicialização lazy
`new Resend(key)` instanciado **dentro do handler**, não no topo do arquivo. Evita crash no build da Vercel quando `RESEND_API_KEY` não está definida durante o build.

### E-mail inbound — caminho duplo
O webhook (`/api/inbound/nf`) é o caminho rápido; o poll (`/api/cron/check-emails` + botão "Atualizar") garante que uma entrega perdida não perca o e-mail. A lógica compartilhada vive em `process-received-email.ts`. Deduplicação por `resend_email_id` (índice único). O `replyTo` de cada solicitação usa plus-addressing com o ID da request — é o que permite associar a resposta automaticamente.

### Cron — autenticação
Todas as rotas `/api/cron/*` exigem `Authorization: Bearer $CRON_SECRET` (`src/lib/cron-auth.ts`). O botão "Testar" em `/automacoes` chama `/api/automations/run`, que dispara o cron server-side sem expor o segredo.

### useSearchParams + Suspense
Em Next.js 14, `useSearchParams()` dentro de um page component exige `<Suspense>` boundary. O login usa um subcomponente `<UrlErrorHandler>` isolado em `<Suspense fallback={null}>`.

### PDFs com fonte embutida
Os PDFs usam a família **Jost** embutida em `src/lib/fonts/` (base64), garantindo tipografia consistente sem depender de fontes do sistema.

### PWA
- Ícones gerados dinamicamente via `next/og` (ImageResponse) — sem arquivos PNG estáticos
- Manifest via `src/app/manifest.ts` (convenção Next.js 14, serve em `/manifest.webmanifest`)
- Service worker em `public/sw.js` + página `/offline`

### Dark Mode
Implementado via `next-themes`. Toggle no rodapé da sidebar. Persiste via `localStorage`.

### Testes
`npm test` roda Vitest sobre `src/lib/__tests__/` — 15 suítes cobrindo lógica pura: sequência e status de NF, documentos (jobs e contabilidade), histórico, billing mode, CNPJ, e-mails inbound, layout e itens de invoice, ordem de colunas, capitalização de nomes.

---

## Scripts de Importação

Utilitários em `scripts/` (rodar com `node scripts/<nome>.mjs`) usados para migração e manutenção dos dados reais:

| Script | Função |
|---|---|
| `apply-migration.mjs` | Aplica uma migration SQL no banco |
| `import-material-cliente.mjs` | Importa jobs/documentos a partir da pasta `MaterialCliente` |
| `import-accounting.mjs` | Importa documentos contábeis históricos por competência |
| `import-nf-document.mjs` | Arquiva uma NF emitida como documento do job |
| `import-nf-history.mjs` | Importa o histórico de NFs (série Paulínia entra com prefixo `NFP`, fora da sequência de invoices) |
| `backfill-nf-series.mjs` | Preenche `nf_series` nula em invoices com NF, derivando de `nf_issued_at ?? period_start` (antes de 2020 → `paulinia`). Idempotente, suporta `--dry` |
| `import-orphan-docs.mjs` | Arquiva PDFs que ficaram sem par |
| `rebuild-history-jobs.mjs` | Reconstrói jobs do histórico |
| `backfill-job-brands.mjs` | Preenche marcas/thumbnails de jobs |
| `normalize-names.mjs` | Normaliza capitalização de nomes |
| `setup-payment-and-logo.mjs` | Configura dados bancários e logo |

A extração de dados de PDFs de clientes usa Claude (`src/lib/job-from-pdf.ts`, requer `ANTHROPIC_API_KEY`).

---

## Roadmap — Status das 50 Funcionalidades

Das 50 funcionalidades planejadas originalmente, **25 estão implementadas** (algumas em forma parcial ou alternativa), além de 6 módulos novos que não estavam no roadmap. Status individual:

### ✅ Implementadas

| # | Funcionalidade | Como ficou |
|---|---|---|
| 2 | Invoices Recorrentes | Cron diário, mensal ou semanal, gera rascunho + lembrete na agenda |
| 3 | Lembretes de Cobrança | Cron diário, N dias após vencimento, configurável em `/automacoes` |
| 4 | Controle de Despesas | `/despesas` com categorias, gráfico e CSV |
| 6 | Pagamento Parcial | `invoice_payments` com múltiplos recebimentos e câmbio |
| 7 | Personalização de Invoice | Logo, CNPJ, cor, dados fiscais e bancários em `/settings` |
| 8 | Link de Pagamento Online | Stripe Checkout + webhook de confirmação (Mercado Pago previsto no schema, não implementado) |
| 9 | Pipeline de Vendas (CRM) | `/pipeline` Kanban com drag-and-drop |
| 10 | Portal do Cliente | `/portal/[token]` com PDF e confirmação de pagamento |
| 11 | Histórico de Comunicação | `client_interactions` na ficha do cliente |
| 12 | Score de Cliente | `clients.score` (1–5) na ficha do cliente |
| 13 | Metas de Horas | `/metas` + progresso no dashboard |
| 15 | Arredondamento de Horas | `hour_rounding` em `user_settings`, aplicado nos logs |
| 19 | Resumo Semanal por E-mail | Cron de segunda-feira |
| 24 | Exportar CSV / Excel | Botões de exportação (logs, despesas) + timesheet semanal CSV |
| 27 | Eventos Recorrentes | `recurrence` em `agenda_events` |
| 32 | Templates de Projeto | `project_templates` |
| 34 | Subtarefas | Checklist `project_task_items` nas tarefas do projeto |
| 35 | Controle de Férias e Folgas | `/folgas` com sincronização de disponibilidade |
| 40 | Nota Fiscal | **Forma alternativa**: ciclo completo de solicitação ao contador por e-mail, séries Paulínia/São Paulo, painel `/notas-fiscais` — sem API de emissão de NF-e |
| 42 | Webhooks de saída | Painel em `/settings`, 7 eventos assinados, log de entregas, teste |
| 45 | API Pública REST | `/api/v1/*` com auth por API key |
| 46 | IA para Descrição de Invoice | Claude gera a descrição dos itens |
| 47 | Busca Global | CommandPalette (Cmd+K) na sidebar |
| 49 | Backup Completo | `/api/export` em JSON |
| 50 | Modo Offline (PWA) | Service worker + página `/offline` (visualização; criação offline não sincroniza) |
| — | Holds de disponibilidade | `1st_hold` / `2nd_hold` / `booked` (não estava no roadmap original) |
| — | Cobrança internacional | Modos hourly/daily/fixed, câmbio, blocos bancários BR/FX/intermediário |
| — | Caixa de entrada de e-mails | `/emails` com threads e arquivamento de NF |
| — | Contabilidade documental | `/contabilidade` por competência |
| — | Documentos por job | 7 tipos com storage privado |
| — | Consulta de CNPJ | BrasilAPI |

### ⏳ Pendentes (backlog)

| # | Funcionalidade | Observação |
|---|---|---|
| 1 | Propostas / Orçamentos | Início do funil com conversão em job |
| 5 | Simulador de Impostos | MEI/ME/PJ |
| 14 | Pomodoro Integrado | Nicho |
| 16 | Heatmap de Produtividade | Estilo GitHub |
| 17 | Horas por Tarefa | Quebra dentro do log diário |
| 18 | Notificações Push (PWA) | VAPID + Web Push |
| 20 | Webhook Slack / Discord | Coberto parcialmente pelos webhooks genéricos |
| 21 | Rentabilidade por Job | Estimado × real × faturado |
| 22 | Valor por Cliente (LTV) | |
| 23 | Previsão de Receita | 3 meses |
| 25 | Sync Google Calendar | OAuth |
| 26 | Checklist por Tarefa (agenda) | Existe em projetos, falta na agenda |
| 28 | Onboarding Guiado | |
| 29 | Atalhos de Teclado | Parcial: Cmd+K existe; faltam N/F/Esc/Ctrl+S |
| 30 | Multi-usuário / Workspace | Requer `organization_id` em todas as tabelas |
| 31 | Time Blocking | |
| 33 | Kanban de Tarefas (projetos) | Vista alternativa ao Gantt |
| 36 | Histórico de Taxas | Evolução de `hourly_rate` por cliente |
| 37 | Orçamento por Projeto | Campo `budget` existe na agenda; falta tracking de consumo |
| 38 | Conciliação Bancária | Cruzar extrato CSV com invoices |
| 39 | Cotação Automática | Hoje o câmbio é informado manualmente no pagamento |
| 41 | Envio via WhatsApp | Z-API/Twilio |
| 43 | Extensão de Navegador | |
| 44 | Resumo por WhatsApp | |
| 48 | 2FA | TOTP via Supabase Auth MFA |

---

> **Estado atual:** 28 páginas · 33 tabelas · 29 migrations · 30 API routes · 3 buckets · 5 crons · 15 suítes de teste
