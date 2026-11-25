-- Archive: an item that is used up, thrown away or removed is kept in an archive, not deleted.
-- Deleting for good is a separate, confirmed action in the app.
alter table public.items add column archived_at timestamptz;
alter table public.items add column archive_reason text check (archive_reason in ('used', 'wasted', 'removed'));
create index items_archived_idx on public.items (household_id, archived_at);
-- Items left at quantity 0 by earlier versions go to the archive. Nothing is deleted.
update public.items set archived_at = now(), archive_reason = 'used' where quantity = 0 and archived_at is null;

-- Reminder defaults ("templates").
--   template_id : on an item's reminder, the home default it is linked to. Editing the reminder
--                 lets the app ask whether the default (and its other copies) should change too.
--   applies_from: on a home default, "only for items added from this moment on". NULL = every
--                 item that has no reminders of its own.
alter table public.reminder_rules add column template_id uuid references public.reminder_rules (id) on delete set null;
alter table public.reminder_rules add column applies_from timestamptz;
create index reminder_rules_template_idx on public.reminder_rules (template_id);

-- What happens when a reminder is made a default: NULL = ask every time.
alter table public.user_settings add column template_scope text
  check (template_scope in ('all', 'new', 'new_and_empty'));
