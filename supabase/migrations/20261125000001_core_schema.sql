-- Household Tracker: core schema (step 1 of the move off Apps Script).
--
-- Replaces the Google Sheets storage where one typed ID was one inventory with no password.
-- Here an inventory belongs to a household, and only signed-in members can read or change it.
--
-- The project was created with "Grant API access to new tables automatically" off,
-- so every table gets explicit GRANTs below. Row-level security is on for every table.

-- ---------------------------------------------------------------------------
-- Households and members
-- ---------------------------------------------------------------------------

create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  timezone    text not null default 'Asia/Seoul',
  -- Shared with family members so they can join the same inventory.
  join_code   text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 18),
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

-- Membership check used by every policy. SECURITY DEFINER so the policy on
-- household_members does not recurse into itself.
create function public.is_household_member(target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = target and m.user_id = (select auth.uid())
  );
$$;

create function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Categories and items
-- ---------------------------------------------------------------------------

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  icon         text not null default 'box',
  color        text not null default '#3182f6' check (color ~* '^#[0-9a-f]{6}$'),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index categories_name_idx on public.categories (household_id, lower(name));

create table public.items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  -- NULL means "Uncategorized"; deleting a category keeps its items.
  category_id   uuid references public.categories (id) on delete set null,
  name          text not null check (char_length(name) between 1 and 120),
  quantity      numeric(9, 2) not null default 1 check (quantity >= 0),
  unit          text not null default '' check (char_length(unit) <= 20),
  location      text not null default '' check (char_length(location) <= 80),
  notes         text not null default '' check (char_length(notes) <= 1000),

  date_type     text not null default 'expiration'
                check (date_type in ('expiration', 'sellBy', 'bestBefore', 'replaceBy', 'none')),
  -- The date printed on the package (or the planned replacement date).
  printed_date  date,
  estimated     boolean not null default false,
  manufactured_on date,
  acquired_on   date not null default current_date,

  -- "Use within N days of opening" is copied from the package when the item is added.
  -- opened_on is filled in later, on the day the package is actually opened;
  -- the countdown only starts then. Neither field requires the other.
  after_opening_days integer check (after_opening_days between 1 and 3650),
  opened_on     date,
  interval_days integer check (interval_days between 1 and 3650),

  running_out   boolean not null default false,

  -- Earliest of the printed date and the after-opening deadline.
  due_date      date generated always as (
                  least(
                    case when date_type = 'none' then null else printed_date end,
                    opened_on + after_opening_days
                  )
                ) stored,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index items_household_idx on public.items (household_id, due_date);
create index items_category_idx on public.items (category_id);

-- ---------------------------------------------------------------------------
-- Reminders
-- ---------------------------------------------------------------------------
-- An item can have any number of reminder rules. A rule with item_id NULL is a
-- household default, applied to every item that has no rules of its own.
--
-- First firing = anchor moment - offset, where the anchor moment is
--   'due'    : the item's due_date at at_time (household time zone)
--   'opened' : the item's opened_on at at_time
--   'fixed'  : fixed_at (an exact moment chosen by the user)
-- Then it repeats every repeat_every_amount repeat_every_unit, repeat_count more
-- times, or until the reminder is handled when repeat_count is NULL.

create table public.reminder_rules (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  item_id       uuid references public.items (id) on delete cascade,
  anchor        text not null default 'due' check (anchor in ('due', 'opened', 'fixed')),
  offset_amount integer not null default 0 check (offset_amount between 0 and 10000),
  offset_unit   text not null default 'days' check (offset_unit in ('minutes', 'hours', 'days', 'weeks')),
  at_time       time not null default '09:00',
  fixed_at      timestamptz,
  repeat_every_amount integer check (repeat_every_amount between 1 and 10000),
  repeat_every_unit   text check (repeat_every_unit in ('minutes', 'hours', 'days', 'weeks')),
  repeat_count  integer check (repeat_count between 1 and 100),
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check ((anchor = 'fixed') = (fixed_at is not null)),
  check ((repeat_every_amount is null) = (repeat_every_unit is null)),
  check (repeat_count is null or repeat_every_amount is not null),
  -- Repeats closer together than 5 minutes are refused.
  check (repeat_every_unit is distinct from 'minutes' or repeat_every_amount >= 5)
);
create index reminder_rules_item_idx on public.reminder_rules (item_id);
create index reminder_rules_household_idx on public.reminder_rules (household_id) where item_id is null;

-- One row per reminder that fired. Written by the scheduled server function (step 4).
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  item_id      uuid not null references public.items (id) on delete cascade,
  rule_id      uuid references public.reminder_rules (id) on delete set null,
  fire_at      timestamptz not null,
  sent_at      timestamptz,
  handled_at   timestamptz,
  snoozed_until timestamptz,
  created_at   timestamptz not null default now(),
  unique (item_id, rule_id, fire_at)
);
create index notifications_household_idx on public.notifications (household_id, fire_at desc);

-- Web Push endpoints, one per browser/device of a user.
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth_key   text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- Shopping list and activity log
-- ---------------------------------------------------------------------------

create table public.shopping_entries (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  item_id      uuid references public.items (id) on delete set null,
  name         text not null check (char_length(name) between 1 and 120),
  quantity     numeric(9, 2) not null default 1 check (quantity > 0),
  unit         text not null default '' check (char_length(unit) <= 20),
  checked      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index shopping_entries_household_idx on public.shopping_entries (household_id, checked);

create table public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  item_id      uuid references public.items (id) on delete set null,
  shopping_entry_id uuid references public.shopping_entries (id) on delete set null,
  item_name    text not null,
  kind         text not null check (kind in ('consumed', 'wasted', 'purchased', 'opened')),
  quantity     numeric(9, 2) not null default 0,
  unit         text not null default '',
  happened_at  timestamptz not null default now()
);
create index activity_log_household_idx on public.activity_log (household_id, happened_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger households_touch before update on public.households
  for each row execute function public.touch_updated_at();
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();
create trigger reminder_rules_touch before update on public.reminder_rules
  for each row execute function public.touch_updated_at();
create trigger shopping_entries_touch before update on public.shopping_entries
  for each row execute function public.touch_updated_at();

-- A category, rule, notification or shopping entry must stay in the household of the item it points to.
create function public.check_same_household()
returns trigger language plpgsql set search_path = ''
as $$
declare
  other uuid;
begin
  if tg_table_name = 'items' then
    if new.category_id is not null then
      select household_id into other from public.categories where id = new.category_id;
      if other is distinct from new.household_id then
        raise exception 'Category belongs to another household' using errcode = '23514';
      end if;
    end if;
  elsif new.item_id is not null then
    select household_id into other from public.items where id = new.item_id;
    if other is distinct from new.household_id then
      raise exception 'Item belongs to another household' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger items_same_household before insert or update on public.items
  for each row execute function public.check_same_household();
create trigger reminder_rules_same_household before insert or update on public.reminder_rules
  for each row execute function public.check_same_household();
create trigger notifications_same_household before insert or update on public.notifications
  for each row execute function public.check_same_household();
create trigger shopping_entries_same_household before insert or update on public.shopping_entries
  for each row execute function public.check_same_household();
create trigger activity_log_same_household before insert or update on public.activity_log
  for each row execute function public.check_same_household();

-- ---------------------------------------------------------------------------
-- Creating and joining a household (the only way to become a member)
-- ---------------------------------------------------------------------------

create function public.create_household(household_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  new_id uuid;
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if (select count(*) from public.household_members where user_id = uid) >= 5 then
    raise exception 'You can belong to at most 5 households' using errcode = '23514';
  end if;
  insert into public.households (name, created_by)
    values (btrim(household_name), uid) returning id into new_id;
  insert into public.household_members (household_id, user_id, role)
    values (new_id, uid, 'owner');
  -- Default reminders: a week before at 09:00, then every morning from the due day until handled.
  insert into public.reminder_rules (household_id, offset_amount, offset_unit)
    values (new_id, 7, 'days');
  insert into public.reminder_rules (household_id, offset_amount, offset_unit, repeat_every_amount, repeat_every_unit)
    values (new_id, 0, 'days', 1, 'days');
  return new_id;
end;
$$;

create function public.join_household(code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target uuid;
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select id into target from public.households where join_code = lower(btrim(code));
  if target is null then
    raise exception 'No household has this code' using errcode = 'P0002';
  end if;
  if (select count(*) from public.household_members where household_id = target) >= 12 then
    raise exception 'This household is full' using errcode = '23514';
  end if;
  insert into public.household_members (household_id, user_id)
    values (target, uid) on conflict do nothing;
  return target;
end;
$$;

-- Owners can replace the code if it leaks.
create function public.rotate_join_code(target uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  fresh text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 18);
begin
  if not exists (
    select 1 from public.household_members
    where household_id = target and user_id = (select auth.uid()) and role = 'owner'
  ) then
    raise exception 'Only an owner can change the code' using errcode = '42501';
  end if;
  update public.households set join_code = fresh where id = target;
  return fresh;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.categories        enable row level security;
alter table public.items             enable row level security;
alter table public.reminder_rules    enable row level security;
alter table public.notifications     enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.shopping_entries  enable row level security;
alter table public.activity_log      enable row level security;

create policy "members read their household" on public.households
  for select to authenticated using (public.is_household_member(id));
create policy "owners rename their household" on public.households
  for update to authenticated
  using (exists (select 1 from public.household_members m
                 where m.household_id = households.id and m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (true);
create policy "owners delete their household" on public.households
  for delete to authenticated
  using (exists (select 1 from public.household_members m
                 where m.household_id = households.id and m.user_id = (select auth.uid()) and m.role = 'owner'));

create policy "members see fellow members" on public.household_members
  for select to authenticated using (public.is_household_member(household_id));
create policy "members can leave" on public.household_members
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "members manage categories" on public.categories
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "members manage items" on public.items
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "members manage reminder rules" on public.reminder_rules
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "members manage shopping" on public.shopping_entries
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Notifications and the activity log are written by the server; members read them
-- and may mark a notification handled or snoozed.
create policy "members read notifications" on public.notifications
  for select to authenticated using (public.is_household_member(household_id));
create policy "members handle notifications" on public.notifications
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "members read activity" on public.activity_log
  for select to authenticated using (public.is_household_member(household_id));
create policy "members add activity" on public.activity_log
  for insert to authenticated with check (public.is_household_member(household_id));

create policy "users manage their own push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants (nothing for anon: the app is unusable without signing in)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;

grant select on public.households to authenticated;
grant update (name, timezone) on public.households to authenticated;
grant delete on public.households to authenticated;
grant select, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.categories, public.items, public.reminder_rules,
  public.shopping_entries, public.push_subscriptions to authenticated;
grant select on public.notifications to authenticated;
grant update (handled_at, snoozed_until) on public.notifications to authenticated;
grant select, insert on public.activity_log to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.rotate_join_code(uuid) to authenticated;
