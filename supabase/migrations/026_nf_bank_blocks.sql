-- The NF prints a different account depending on where the tomador is. A Brazilian one
-- pays into the account here; a foreign one wires abroad, through an intermediary, and the
-- money lands in reais at the bank that closes the exchange. Neither was recorded: the
-- existing bank_* fields are the account that receives the wire, and PIX stood alone.
alter table user_settings
  add column if not exists br_bank_name    text,
  add column if not exists br_bank_agency  text,
  add column if not exists br_bank_account text,
  add column if not exists fx_bank_name    text,
  add column if not exists fx_bank_agency  text,
  add column if not exists fx_bank_account text,
  add column if not exists fx_bank_swift   text;
