-- Project thumbnails on jobs, stored in a public bucket under each user's own folder.

alter table jobs
  add column if not exists thumbnail_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-thumbnails',
  'job-thumbnails',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read (the bucket is public and file names are random); writing is confined
-- to the folder named after the caller's own user id.
drop policy if exists "Job thumbnails are publicly readable" on storage.objects;
create policy "Job thumbnails are publicly readable" on storage.objects
  for select using (bucket_id = 'job-thumbnails');

drop policy if exists "Users upload own job thumbnails" on storage.objects;
create policy "Users upload own job thumbnails" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'job-thumbnails' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own job thumbnails" on storage.objects;
create policy "Users update own job thumbnails" on storage.objects
  for update to authenticated
  using (bucket_id = 'job-thumbnails' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own job thumbnails" on storage.objects;
create policy "Users delete own job thumbnails" on storage.objects
  for delete to authenticated
  using (bucket_id = 'job-thumbnails' and (storage.foldername(name))[1] = auth.uid()::text);
