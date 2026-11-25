-- "Remind me later": an item can be hidden from the reminders list until a chosen moment.
alter table public.items add column snoozed_until timestamptz;

-- Each person chooses how dates are typed and shown (Korea: 2026.12.13, Russia: 13.12.2026, …).
alter table public.user_settings add column date_format text
  check (date_format in ('ymd.', 'ymd-', 'dmy.', 'dmy/', 'mdy/'));

-- An item with nothing left is removed by the app, so zero is no longer a valid quantity.
delete from public.items where quantity = 0;
alter table public.items drop constraint items_quantity_check;
alter table public.items add constraint items_quantity_check check (quantity > 0);
