-- "Remind me later": an item can be hidden from the reminders list until a chosen moment.
alter table public.items add column snoozed_until timestamptz;

-- Each person chooses how dates are typed and shown (Korea: 2026.12.13, Russia: 13.12.2026, …).
alter table public.user_settings add column date_format text
  check (date_format in ('ymd.', 'ymd-', 'dmy.', 'dmy/', 'mdy/'));
