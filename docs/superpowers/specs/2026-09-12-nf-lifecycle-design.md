# Sub-projeto 1 — Dados fiscais e ciclo da nota fiscal (NF)

Data: 2026-09-12
Status: aprovado em conversa, pronto para plano de implementação

## Contexto

O usuário (Estúdio Judite Ltda, ME, Simples Nacional, São Paulo) fatura estúdios e
agências no Brasil e no exterior. As notas fiscais (NFS-e) são emitidas pelo contador a
partir de um pedido por e-mail. Problemas hoje:

- NFs não emitidas se acumulam sem controle.
- Não há registro de quais NFs já foram emitidas; a numeração ficou confusa porque há
  três séries (NFS-e Paulínia 2015–2019, NFS-e São Paulo desde nov/2019, e a sequência
  própria de invoices, única para BRL e USD, atualmente em 0101).
- Dados do tomador (CNPJ, endereço) e do job (cliente final, intermediário, PO) vivem em
  planilhas e e-mails, não no sistema.
- Recebimentos em dólar exigem NF ao contador para recolher impostos; hoje isso é manual.

Este sub-projeto resolve o controle. Os sub-projetos seguintes (recebimento do e-mail do
contador, documentos, conciliação com o Banco Inter e fechamento mensal) dependem dele.

## Fora de escopo

- Leitura automática do e-mail do contador (sub-projeto 2).
- Armazenamento de PDFs/XML (sub-projeto 3). Neste sub-projeto a NF é registrada por
  número, série e data; o arquivo entra depois.
- Conciliação bancária e extrato mensal ao contador (sub-projeto 4).
- OCR de PDFs da prefeitura de São Paulo (são imagem).

## Modelo de dados

Migration `016_nf_lifecycle.sql`.

### user_settings (novas colunas)
| coluna | tipo | uso |
|---|---|---|
| legal_name | text | razão social para NF e invoice |
| municipal_registration | text | CCM (São Paulo) |
| fiscal_address | text | endereço fiscal completo |
| accountant_name | text | |
| accountant_email | text | destinatário do pedido de NF |
| next_invoice_seq | int default 102 | próxima invoice (série própria, contínua) |
| intermediary_bank_name | text | ex. JP Morgan Chase N.A. |
| intermediary_bank_swift | text | ex. CHASUS33 |
| intermediary_bank_aba | text | |
| intermediary_bank_account | text | |
| intermediary_bank_address | text | |

Observação: `bank_iban`, `bank_swift`, `bank_name`, `bank_address`, `pix_key` já existem.

### clients (novas colunas)
| coluna | tipo | uso |
|---|---|---|
| legal_name | text | razão social quando difere do nome |
| cnpj | text | |
| address | text | endereço fiscal do tomador |
| billing_entity | text | quem recebe a invoice quando não é o cliente (ex. Steelhead para Deutsch) |
| billing_address | text | |
| nf_rules | text | regras do cliente para a NF (ex. Lobo: sem inglês, sem nome de job, dados bancários no corpo) |

### jobs (novas colunas)
| coluna | tipo | uso |
|---|---|---|
| end_client | text | marca final (Mastercard, Accenture) |
| intermediary | text | estúdio no meio (Lobo) |
| nf_description | text | texto fiscal, ex. "Serviços prestados de animação" |
| po_number | text | PO padrão do job (pode ser sobrescrita na invoice) |

### invoices (novas colunas)
| coluna | tipo | uso |
|---|---|---|
| seq_number | text | série própria, ex. "0102"; único por usuário |
| po_number | text | |
| nf_status | text | `not_required` \| `pending` \| `requested` \| `issued` \| `sent` |
| nf_series | text | `paulinia` \| `sao_paulo` |
| nf_number | text | número oficial da NFS-e |
| nf_issued_at | date | |
| nf_amount_brl | numeric(12,2) | valor da NF em reais (invoices em moeda estrangeira) |
| nf_requested_at | timestamptz | |
| nf_sent_at | timestamptz | enviada ao cliente |

Índice único parcial em (`user_id`, `nf_series`, `nf_number`) quando `nf_number` não é nulo,
para impedir duplicata da mesma série.

### invoice_items (novas colunas)
| coluna | tipo | uso |
|---|---|---|
| description | text | já existe; passa a ser usado nas linhas livres |
| job_number | text | número do job do cliente (ex. 1371300-1045-F0) |
| is_manual | boolean default false | linha livre, não derivada de daily_logs |

### nf_requests (tabela nova)
| coluna | tipo |
|---|---|
| id | uuid pk |
| user_id | uuid fk auth.users |
| invoice_id | uuid fk invoices |
| sent_to | text |
| reply_to | text (reservado para o sub-projeto 2) |
| subject | text |
| body | text |
| resend_id | text |
| status | text `sent` \| `failed` |
| error | text |
| created_at | timestamptz |

RLS igual às demais tabelas (usuário só vê o próprio).

## Regras de negócio

### Numeração da invoice
- Ao criar uma invoice, `seq_number` recebe `next_invoice_seq` formatado com 4 dígitos e o
  contador incrementa (RPC `get_next_invoice_seq`, `security definer`, atômico).
- `invoice_number` (formato `2026-001`) continua existindo por compatibilidade; a UI passa
  a exibir `seq_number` como número principal.
- A página "Notas fiscais" avisa lacunas e duplicatas em `seq_number` e em
  (`nf_series`, `nf_number`).

### Status da NF
- Invoice em BRL: `nf_status` começa em `pending` ao ser criada.
- Invoice em USD/EUR: começa em `not_required`. Ao registrar um pagamento (tabela
  `invoice_payments`) vira `pending` e `nf_amount_brl` recebe `amount_received_brl` do
  pagamento (editável).
- "Pedir NF ao contador" → `requested`, grava `nf_requested_at` e uma linha em `nf_requests`.
- "Registrar NF" (número, série, data) → `issued`.
- "Marcar enviada ao cliente" → `sent`, grava `nf_sent_at`.
- Transições permitidas: `not_required → pending`, `pending → requested → issued → sent`,
  `pending → issued` (quando o contador já emitiu), `requested → pending` (cancelar pedido).
- "NF acumulada" = `pending` ou `requested` há mais de 7 dias (limite fixo nesta versão).

### Pedido de NF ao contador
E-mail via Resend para `accountant_email`, assunto
`Pedido de NF — Invoice {seq_number} — {cliente}`. Corpo com:
- Tomador: razão social, CNPJ, endereço (do cliente).
- Descrição do serviço: `jobs.nf_description`.
- Valor em reais: `nf_amount_brl` (BRL: total da invoice; USD/EUR: líquido recebido).
- Vencimento: `due_date`.
- Dados bancários do prestador para constar na NF (banco, agência, conta, PIX).
- Regras do cliente (`clients.nf_rules`) quando existirem.
- Link para o PDF da invoice (rota autenticada existente).
Preview editável antes de enviar. `reply_to` fica preparado para o sub-projeto 2.

### PDF da invoice (moeda estrangeira)
Acrescentar ao PDF existente quando `currency != BRL`:
- "Purchase order: {po_number}" e "Bill to" com `billing_entity`/`billing_address` quando
  existirem (senão o cliente).
- Linhas livres (`is_manual`) com descrição e job number, além das linhas por dia.
- Bloco "Payment instructions" com banco intermediário (Field 56), banco de destino
  (Field 57: Inter, SWIFT) e beneficiário (Field 59: razão social, IBAN).
- "Recipient info" com razão social, e-mail, telefone e endereço fiscal.
Em BRL o layout atual permanece, acrescentando CNPJ e endereço do tomador no bloco "Para".

### Criação de invoice
O diálogo de criação passa a ter uma aba "Linhas livres" para adicionar itens manuais
(descrição, job number, quantidade, valor) e o campo PO. O total soma dias e linhas livres.

## Telas

### Notas fiscais (`/notas-fiscais`)
Tabela com todas as invoices cujo `nf_status != not_required`: seq, série e número da NF,
data de emissão, tomador, valor em BRL, status, dias em aberto. Filtros: status, ano, série.
Faixa de alertas no topo: lacunas e duplicatas por série. Ações em linha: pedir ao contador,
registrar NF, marcar enviada, cancelar pedido.

### Dashboard
Card "NFs pendentes": contagem, soma em BRL e a mais antiga. Link para a página.

### Configurações
Seção "Dados fiscais": razão social, CNPJ, CCM, endereço fiscal, contador (nome e e-mail),
próxima invoice. Seção "Banco intermediário (wire)" ao lado dos dados bancários já existentes.

### Cliente e job
Campos novos nos diálogos existentes. Na lista de jobs, mostrar cliente final e intermediário
quando existirem.

## Importação do histórico

Script único, idempotente, executado com o client admin:
1. Clientes a partir das NFs de Paulínia e das invoices internacionais, com CNPJ/endereço
   quando disponíveis: Videographica, Lobo Multimídia, Cinemalink, SAM Transmedia, Polis,
   Mais Filmes, Jofilsan, Capela, Quanta, A00, Árvore, Tabuleiro, State Design, Firegrader,
   Steelhead (Deutsch), Joy, RGA, AKQA, King Ursa, Vanpaio, Tuzuu, Invisible Works, Deutsch.
2. Um job "Histórico" por cliente para ancorar as invoices antigas.
3. 60 NFs de Paulínia (nº 50 a 117) como invoices `issued`, série `paulinia`, com valor,
   data e tomador. Fonte: `nf_historico.csv` gerado do material.
4. Invoices internacionais lidas do material (006 a 0101) com seq, cliente, data, PO e
   valor quando lidos; `nf_status` conforme regra (USD sem pagamento registrado →
   `not_required`).
5. Linhas 083 a 088 da planilha 2025 como invoices com seq, cliente, valor e
   `nf_issued_at` onde há data de emissão (`issued`), senão `pending`.
Conflitos (mesmo seq já existente) são reportados e não sobrescritos.

## Testes e verificação

- Typecheck limpo.
- Teste unitário da máquina de estados (`lib/nf-status.ts`) cobrindo todas as transições e
  a regra BRL vs moeda estrangeira.
- Geração dos PDFs de exemplo: BRL com CNPJ do tomador; USD com PO, linhas livres e bloco
  de banco intermediário. Inspeção visual.
- Envio do pedido de NF em modo teste para o próprio e-mail do usuário.
- Páginas renderizando com o histórico importado; alertas de lacuna aparecendo para as
  faixas conhecidas (013–047, 055–078, 081–088).

## Riscos e decisões

- OCR da NFS-e de São Paulo fica fora; o número é digitado. O sub-projeto 2 pode usar o
  XML quando o contador enviar.
- `invoice_number` anual e `seq_number` contínuo coexistem; relatórios continuam usando
  `invoice_number` até migração futura.
- DNS de `chico.cx` ainda não informado; só afeta o sub-projeto 2.
