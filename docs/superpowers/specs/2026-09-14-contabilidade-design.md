# Contabilidade: documentos mensais e cruzamento por competência

Data: 2026-09-14
Status: aprovado em conversa, pronto para implementação

## Contexto

O import de `MaterialCliente` (2026-09-14) achou 351 arquivos. 48 foram para slots de job.
Dos 130 que sobraram sem tipo reconhecível, a maioria é contabilidade mensal da empresa —
guias de DAS, recibos e pagamentos do contador, TFE, DASN e extratos bancários, de 2016 a
2026. Nada disso pertence a um job: pertence a um mês.

A regra que organiza esses arquivos: **a guia do DAS é emitida no fim do mês seguinte ao
trabalho prestado**. `DAS 11.2025.pdf` está na pasta `2025/2025_12`; `DAS 02.2022.pdf` está
em `2022/03_Marco`. O nome diz a competência, a pasta diz quando foi pago. É a competência
que cruza a guia com o comprovante.

## Fora de escopo

- Conciliação do extrato com as invoices recebidas.
- Cálculo ou conferência do valor do DAS.
- Leitura do conteúdo dos PDFs (a maioria é imagem, sem camada de texto).
- Corrigir `job_documents`, que guarda um arquivo por `(job, kind)` e por isso deixou 28
  PDFs de fora. Continua pendente; ver a memória do projeto.

## 1. Modelo

Migration `020_accounting_documents.sql`.

```
accounting_documents
  id          uuid pk
  user_id     uuid -> auth.users on delete cascade
  competencia date not null   -- primeiro dia do mês a que o documento se refere
  scope       text not null default 'month' check (scope in ('month','year'))
  kind        text not null check (kind in (...os oito...))
  path        text not null
  file_name   text not null
  mime_type   text
  size_bytes  bigint
  amount      numeric(12,2)
  uploaded_at timestamptz not null default now()
```

**Sem `unique (competencia, kind)`**, deliberadamente. Foi essa restrição em
`job_documents` que deixou 28 PDFs de fora, e aqui quebraria de imediato: há 2 ou 3
extratos em vários meses, e guias "RECALCULADO" convivendo com a original.

Os oito tipos:

| kind | rótulo |
|---|---|
| das_guide | Guia do DAS |
| das_payment | Pagamento do DAS |
| fee_receipt | Recibo de honorários |
| fee_payment | Pagamento de honorários |
| tfe | TFE |
| dasn_guide | Guia do DASN |
| dasn_payment | Pagamento do DASN |
| statement | Extrato |

DASN é anual: entra com `scope = 'year'` e competência em janeiro do ano.

Bucket privado `accounting-documents`, caminho `{user_id}/{AAAA-MM}/{kind}-{uuid}.{ext}`,
políticas iguais às de `job-documents` (migration 018).

## 2. `src/lib/accounting-documents.ts`

Puro e testado:

- `ACCOUNTING_KINDS`, `ACCOUNTING_LABELS`, `ACCOUNTING_SHORT_LABELS`, `ACCOUNTING_HINTS`.
- `kindFromName(fileName)` — que tipo de documento o nome indica.
- `competenciaFromName(fileName, folderPath)` — a peça central, abaixo.
- `formatCompetencia(date, scope)` — "11/2025" ou "2021".

### `competenciaFromName`

Contra os arquivos reais:

| arquivo | competência | de onde |
|---|---|---|
| `DAS 11.2025.pdf` | 2025-11 | `MM.AAAA` no nome |
| `RECIBO HONORARIO REF. MES 02.2022.pdf` | 2022-02 | `MM.AAAA` no nome |
| `DAS 12.2022 - RECALCULADO.pdf` | 2022-12 | `MM.AAAA` no nome |
| `2207_DAS_Pagamento.jpg` | 2022-07 | prefixo `AAMM` |
| `220221_Honorarios_ref_2201_Guia.pdf` | 2022-01 | `ref_AAMM` |
| `210305_RPS_2101_HonorarioGuia.pdf` | 2021-01 | `_AAMM_` |
| `210325_DASN_202101_Guia.pdf` | 2021-01 | `AAAAMM`, scope ano |
| `191216_Simples_Pagamento_Nov2019.pdf` | 2019-11 | mês por extenso |
| `260120_GuiaPagamento_Contador_2025_12.pdf` | 2025-12 | `AAAA_MM` |
| `NU_..._01JAN2022_31JAN2022.pdf` | 2022-01 | período do extrato |
| `EstudioJudite-Extrato-2026-01-Janeiro.pdf` | 2026-01 | `AAAA-MM` |
| `Pagamento DAS.jpg` em `2022/09_Setembro` | 2022-08 | pasta **menos um mês** |

A ordem importa: o nome sempre ganha da pasta. A pasta só entra quando o nome não diz
nada, e aí vale a regra do usuário — a pasta é o mês do pagamento, a competência é a
anterior.

## 3. Telas

- `/contabilidade` — uma linha por competência, decrescente, com uma coluna por tipo
  mostrando ✓ (e a contagem quando há mais de um arquivo). Colunas arrastáveis, pela mesma
  mecânica do histórico (`column-order.ts`).
- `/contabilidade/[competencia]` — os oito grupos do mês, cada um aceitando vários
  arquivos, com ver / remover / enviar. Link assinado de um minuto, como nos jobs.
- Item "Contabilidade" no sidebar e no ⌘K.

## 4. Import

`scripts/import-accounting.mjs` — varre `MaterialCliente`, classifica por `kindFromName`,
resolve a competência e sobe. Idempotente pelo hash do arquivo: um arquivo já presente na
mesma competência e tipo não entra de novo.

`scripts/import-orphan-docs.mjs` — para os 15 arquivos que têm tipo de documento de job mas
nenhuma invoice correspondente, cria um job placeholder por arquivo, status `proposal`,
nome `Sem especificação — <pista do arquivo>`, e anexa o PDF. Ficam visíveis no histórico
para serem renomeados e agrupados aos poucos.

## Verificação

- Testes vitest para `accounting-documents.ts`, com os nomes reais da tabela acima.
- `--dry` nos dois scripts antes de gravar.
- `tsc --noEmit`, `next build`, e smoke test das páginas novas com sessão real.
