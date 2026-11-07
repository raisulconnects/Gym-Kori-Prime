-- Gym Kori: backup and sync for each user's own data, plus optional body details.
-- Paste this into the Supabase SQL editor and run it once, after 0001_profiles.sql.

-- Optional details about the person. Weight has its own table so its history is kept.
alter table public.profiles
  add column gender text check (gender in ('male', 'female', 'prefer_not_to_say')),
  add column height_cm numeric(4, 1) check (height_cm between 50 and 280);

-- Accounts made before 0001_profiles.sql was run have no profile, so their details
-- would have nowhere to save. New accounts get one automatically.
insert into public.profiles (id, display_name)
select id, left(raw_user_meta_data ->> 'display_name', 60)
from auth.users
on conflict (id) do nothing;

-- Every table below follows the same pattern:
--   user_id + id    IDs are made on the phone, so records can be created offline.
--   updated_at      When the change was made on the device. The most recent change wins.
--   deleted_at      Deletes are recorded rather than erased, so they reach other devices.
--   synced_at       When the server received the change. Devices use this to ask what's new.
-- Child tables have no foreign keys to each other, so rows can arrive in any order.

create table public.routines (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create table public.routine_exercises (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  routine_id text not null,
  exercise_id text not null,
  position integer not null,
  sets integer not null,
  reps integer not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create table public.custom_exercises (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create table public.weekly_schedules (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  effective_from date not null,
  -- Seven entries, Sunday first. Each is a routine ID, or null for a rest day.
  days jsonb not null check (jsonb_typeof(days) = 'array' and jsonb_array_length(days) = 7),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create table public.workouts (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  local_date date not null,
  routine_id text,
  routine_name text not null,
  status text not null check (status in ('active', 'finished')),
  started_at timestamptz not null,
  last_activity_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer,
  note text not null default '',
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create table public.workout_exercises (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  workout_id text not null,
  exercise_id text not null,
  position integer not null,
  skipped boolean not null default false,
  extra boolean not null default false,
  note text not null default '',
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create table public.workout_sets (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  workout_id text not null,
  workout_exercise_id text not null,
  position integer not null,
  weight_kg numeric(7, 3),
  reps integer,
  done boolean not null default false,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create table public.body_weights (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  local_date date not null,
  weight_kg numeric(7, 3) not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

-- Applies "the most recent change wins" on the server, so a device that was offline
-- for days can't overwrite a newer change when it finally reconnects.
create function public.apply_synced_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at <= old.updated_at then
    return null;
  end if;
  new.synced_at = clock_timestamp();
  return new;
end;
$$;

-- Protect every table the same way.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'routines', 'routine_exercises', 'custom_exercises', 'weekly_schedules',
    'workouts', 'workout_exercises', 'workout_sets', 'body_weights'
  ]
  loop
    -- Row-level security: people can only reach their own rows.
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy "Users can read their own rows" on public.%I
         for select to authenticated using ((select auth.uid()) = user_id)',
      table_name
    );
    execute format(
      'create policy "Users can add their own rows" on public.%I
         for insert to authenticated with check ((select auth.uid()) = user_id)',
      table_name
    );
    execute format(
      'create policy "Users can change their own rows" on public.%I
         for update to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      table_name
    );

    -- Rows are only erased when the account is deleted.
    execute format('revoke all on public.%I from anon', table_name);
    execute format(
      'revoke delete, truncate, references, trigger on public.%I from authenticated',
      table_name
    );

    execute format(
      'create trigger apply_synced_change before insert or update on public.%I
         for each row execute function public.apply_synced_change()',
      table_name
    );

    -- Lets a device quickly ask for what changed since it last looked.
    execute format(
      'create index on public.%I (user_id, synced_at)',
      table_name
    );
  end loop;
end;
$$;

-- Makes the new tables available to the app straight away.
notify pgrst, 'reload schema';
