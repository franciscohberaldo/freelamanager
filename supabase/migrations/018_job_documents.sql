-- Job paperwork: contract, invoice, issued NF, DAS received, DAS paid and proof of payment.
-- One file per kind per job; uploading again replaces what was there.

create table if not exists job_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  job_id      uuid not null references jobs(id) on delete cascade,
  kind        text not null check (kind in (
                'contract', 'invoice', 'nf', 'das_received', 'das_paid', 'payment_proof'
              )),
  path        text not null,
  file_name   text not null,
  mime_type   text,
  size_bytes  bigint,
  uploaded_at timestamptz not null default now(),
  unique (job_id, kind)
);

create index if not exists idx_job_documents_job on job_documents(job_id);

alter table job_documents enable row level security;

drop policy if exists "Users manage own job documents" on job_documents;
create policy "Users manage own job documents"
  on job_documents for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A private bucket, unlike job-thumbnails: a contract, a DAS and a payment receipt must not
-- be readable by URL, random file name or not. Reading goes through a signed URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-documents',
  'job-documents',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Every operation is confined to the folder named after the caller's own user id.
drop policy if exists "Users read own job documents" on storage.objects;
create policy "Users read own job documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'job-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users upload own job documents" on storage.objects;
create policy "Users upload own job documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'job-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own job documents" on storage.objects;
create policy "Users update own job documents" on storage.objects
  for update to authenticated
  using (bucket_id = 'job-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own job documents" on storage.objects;
create policy "Users delete own job documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'job-documents' and (storage.foldername(name))[1] = auth.uid()::text);
