-- Some clients want more than one person on the invoice email. A contact now says whether
-- it is copied, so a creative director can be on file without receiving the finance mail.

alter table client_contacts
  add column if not exists cc_invoices boolean not null default false;
