-- Per-user settings: which sections Home shows and in what order, and the language.

create table public.user_settings (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  home_layout jsonb,
  language    text check (language in ('en', 'ko')),
  updated_at  timestamptz not null default now()
);

create trigger user_settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();

alter table public.user_settings enable row level security;

create policy "users manage their own settings" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on public.user_settings to authenticated;

-- Reminder timing, stated once so the app and the sending function agree:
comment on column public.reminder_rules.anchor is
  'due: fires offset BEFORE the due date at at_time. opened: fires offset AFTER the opening date at at_time. fixed: fires at fixed_at.';
