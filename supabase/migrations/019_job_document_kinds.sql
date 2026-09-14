-- Two changes to the paperwork a job can hold:
--   * a seventh kind, the email sent to the accountant asking for the NF;
--   * das_received becomes das_issued, because the note is issued by the accountant and
--     "DAS emitido" is what it is called in practice.

alter table job_documents drop constraint if exists job_documents_kind_check;

update job_documents set kind = 'das_issued' where kind = 'das_received';

alter table job_documents add constraint job_documents_kind_check check (kind in (
  'contract', 'invoice', 'accountant_email', 'nf', 'das_issued', 'das_paid', 'payment_proof'
));
