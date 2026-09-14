-- The company's monthly paperwork, which belongs to a month rather than to a job:
-- DAS guides and their payments, the accountant's fees, TFE, DASN and bank statements.
--
-- Everything is keyed on competência, the month the work was done. The DAS guide for a
-- month is issued at the end of the month after it, so filing the guide and its receipt
-- under the same competência is what puts them together.

create table if not exists accounting_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  competencia date not null,
  scope       text not null default 'month' check (scope in ('month', 'year')),
  kind        text not null check (kind in (
                'das_guide', 'das_payment', 'fee_receipt', 'fee_payment',
                'tfe', 'dasn_guide', 'dasn_payment', 'statement'
              )),
  path        text not null,
  file_name   text not null,
  mime_type   text,
  size_bytes  bigint,
  amount      numeric(12,2),
  uploaded_at timestamptz not null default now()
);

-- Deliberately no unique (competencia, kind): a month can hold two or three bank
-- statements, and a recalculated DAS guide lives alongside the original. The one-file-per
-- slot rule in job_documents is what left 28 historical PDFs unfiled.
create index if not exists idx_accounting_documents_competencia
  on accounting_documents(user_id, competencia desc);

create unique index if not exists idx_accounting_documents_path
  on accounting_documents(path);

alter table accounting_documents enable row level security;

drop policy if exists "Users manage own accounting documents" on accounting_documents;
create policy "Users manage own accounting documents"
  on accounting_documents for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Private, like job-documents: a DAS guide carries the CNPJ and the amounts owed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'accounting-documents',
  'accounting-documents',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read own accounting documents" on storage.objects;
create policy "Users read own accounting documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'accounting-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users upload own accounting documents" on storage.objects;
create policy "Users upload own accounting documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'accounting-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own accounting documents" on storage.objects;
create policy "Users update own accounting documents" on storage.objects
  for update to authenticated
  using (bucket_id = 'accounting-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own accounting documents" on storage.objects;
create policy "Users delete own accounting documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'accounting-documents' and (storage.foldername(name))[1] = auth.uid()::text);
