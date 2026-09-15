-- Replies written in the inbox. Outbound messages live in the same table as the inbound
-- ones so a conversation reads as one thread: `direction` tells them apart and
-- `in_reply_to` points a reply at the message it answers.
alter table inbound_emails
  add column if not exists direction text not null default 'in'
    check (direction in ('in', 'out')),
  add column if not exists in_reply_to uuid references inbound_emails(id) on delete set null;

create index if not exists idx_inbound_emails_in_reply_to on inbound_emails(in_reply_to);
