-- A NF can be asked for straight from a job: the tomador, the description and the PO are
-- the job's, and a closed price carries its own amount and date. The request then points
-- at the job instead of an invoice, and must still point at one of the two.
alter table nf_requests alter column invoice_id drop not null;
alter table nf_requests add column if not exists job_id uuid references jobs(id) on delete cascade;

alter table nf_requests drop constraint if exists nf_requests_target;
alter table nf_requests add constraint nf_requests_target
  check (invoice_id is not null or job_id is not null);

create index if not exists idx_nf_requests_job on nf_requests(job_id);
