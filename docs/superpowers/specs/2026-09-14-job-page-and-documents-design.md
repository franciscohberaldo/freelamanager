# Página do job, documentos anexos e colunas reordenáveis

Data: 2026-09-14
Status: aprovado em conversa, pronto para implementação

## Contexto

Hoje um job só pode ser visto e editado por um modal (`job-dialog.tsx`, 374 linhas), que
já está apertado: são 23 campos mais o upload de thumbnail. Os documentos que
comprovam o job — contrato, invoice, NF emitida, DAS recebido, DAS pago e comprovante de
pagamento — vivem fora do sistema, em pastas e e-mails, e não há como saber de bater o
olho o que falta num job.

A tabela do histórico (`/historico`, criada nesta mesma sessão) tem doze colunas numa
ordem fixa que nem sempre é a ordem em que se quer ler.

## Fora de escopo

- Coluna "Documentos" no histórico com indicadores do que já foi enviado.
- Ordem das colunas salva no banco (fica em `localStorage`, por navegador).
- Vários arquivos por tipo de documento. Um job tem no máximo um contrato, uma
  invoice, uma NF, um DAS recebido, um DAS pago e um comprovante — reenviar substitui.
- Ligar o DAS à competência mensal. O DAS do Simples é mensal e vai se repetir entre
  jobs do mesmo mês; foi decidido aceitar essa duplicação em troca de simplicidade.
- OCR ou leitura do conteúdo dos arquivos.

## 1. Colunas reordenáveis no histórico

`src/lib/column-order.ts` já existe e é o motor disto:

- `reorder(list, from, to)` — move um item, sem tocar na entrada.
- `mergeColumnOrder(saved, defaults)` — concilia uma ordem salva com as colunas de hoje:
  chave desconhecida sai, coluna nova entra no fim. Uma ordem antiga nunca quebra a tabela.

Mudanças em `job-history.tsx`:

- `COLUMNS` hoje usa `key` com dois sentidos: identidade e ordenação (`key: null` quer
  dizer "não ordenável"). Os dois sentidos se separam: `key` passa a identificar toda
  coluna, e `sortKey` (opcional) diz se e por onde ela ordena.
- O `<th>` ganha `draggable` e os eventos `dragstart` / `dragover` / `drop`, do HTML5.
  Sem dependência nova: o projeto não tem lib de drag-and-drop e uma linha de cabeçalho
  não justifica uma.
- A ordem vai para `localStorage` sob `historico:column-order`, e volta por
  `mergeColumnOrder`.
- Botão "Restaurar ordem", visível só quando a ordem difere do padrão.

## 2. Página do job — `/jobs/[id]`

Clicar num job em `/jobs` ou no `/historico` abre a página. O "Editar" dos dois lugares
vira link. O modal sobrevive apenas para "Novo Job".

### Refatoração que vem junto

O formulário inteiro está preso dentro do `<Dialog>`. Ele sai para **`job-form.tsx`**
(campos + schema zod + submit), usado pelo dialog de criação e pela página de edição. Sem
isso, a página duplicaria ~250 linhas de campos. `job-dialog.tsx` fica como invólucro.

### Layout

```
← Jobs
┌──────┐  Nome do job              [Ativo] [Recorrente] [NDA]
│ thumb│  Tomador · via Estúdio · Marca
└──────┘  R$ X/dia · 12/03/2026 – 30/06/2026

[ Dados ]  [ Documentos ]  [ Invoices ]  [ Registros ]
```

- **Dados** — `job-form.tsx` em modo edição, em largura cheia.
- **Documentos** — os seis slots.
- **Invoices** — invoices do job: nº, período, total, status, NF. Leitura, com link
  para `/invoices`.
- **Registros** — total de horas ou dias lançados e os últimos lançamentos.

## 3. Documentos do job

Seis tipos, um arquivo cada:

| kind | rótulo |
|---|---|
| contract | Contrato |
| invoice | Invoice |
| nf | NF emitida |
| das_received | DAS recebido |
| das_paid | DAS pago |
| payment_proof | Comprovante de pagamento |

### Modelo de dados

Migration `018_job_documents.sql`.

```
job_documents
  id          uuid pk
  user_id     uuid -> auth.users on delete cascade
  job_id      uuid -> jobs       on delete cascade
  kind        text check (kind in (...os seis...))
  path        text   -- caminho no bucket
  file_name   text   -- nome original, para exibir e baixar
  mime_type   text
  size_bytes  bigint
  uploaded_at timestamptz default now()
  unique (job_id, kind)
```

Tabela em vez de seis colunas em `jobs` porque guarda nome de arquivo e data de envio, e
porque um sétimo tipo depois é uma linha no check, não uma migration de schema.

### Storage

Bucket **`job-documents`, privado** — ao contrário do `job-thumbnails`, que é público.
Contrato, DAS e comprovante de pagamento não podem ficar legíveis por URL, nem com nome
aleatório. Ver e baixar passam por `createSignedUrl` com validade curta.

Caminho `{user_id}/{job_id}/{kind}.{ext}`. As políticas de storage confinam escrita e
leitura à pasta do próprio usuário, no mesmo padrão da `017_job_thumbnails.sql`.

### `src/lib/job-documents.ts`

Puro e testado:

- `DOCUMENT_KINDS` — os seis tipos, com rótulo, na ordem de exibição.
- `validateDocument(file)` — PDF, PNG ou JPG, até 10 MB.
- `documentPath(userId, jobId, kind, fileName)`.
- `formatFileSize(bytes)`.

## Verificação

- Testes vitest para `job-documents.ts`; os de `column-order.ts` já existem (11 casos).
- `npx tsc --noEmit` e `npx next build`.
- Migration aplicada por `node scripts/apply-migration.mjs supabase/migrations/018_job_documents.sql`.
