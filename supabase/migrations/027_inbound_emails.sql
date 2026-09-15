-- What comes back from the accountant. Every reply is recorded, whether or not it could be
-- matched to a request, so an NF that arrives is never lost in a mailbox nobody reads.
create table if not exists inbound_emails (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  nf_request_id    uuid references nf_requests(id) on delete set null,
  invoice_id       uuid references invoices(id) on delete set null,
  job_id           uuid references jobs(id) on delete set null,
  resend_email_id  text not null,
  from_email       text not null,
  to_email         text,
  subject          text,
  body             text,
  attachments      jsonb not null default '[]'::jsonb,
  /** Whether an attachment was filed as the job's NF. */
  filed            boolean not null default false,
  note             text,
  created_at       timestamptz not null default now()
);

create unique index if not exists idx_inbound_emails_resend on inbound_emails(resend_email_id);
create index if not exists idx_inbound_emails_request on inbound_emails(nf_request_id);
create index if not exists idx_inbound_emails_job on inbound_emails(job_id);

alter table inbound_emails enable row level security;
drop policy if exists "Users read own inbound_emails" on inbound_emails;
create policy "Users read own inbound_emails" on inbound_emails
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
