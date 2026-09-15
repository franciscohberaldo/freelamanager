-- The invoice's recipient block shows how to reach the issuer: an e-mail and a phone
-- printed next to the legal name, like the model invoice does.
alter table user_settings
  add column if not exists invoice_contact_email text,
  add column if not exists invoice_contact_phone text;
