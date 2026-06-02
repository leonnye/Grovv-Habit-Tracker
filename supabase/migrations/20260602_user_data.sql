-- Full Grovv data backup per user (habits, check-ins, wellness, journal, profile).
-- One row per account; the app upserts the entire local snapshot as JSON.

create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists user_data_updated_idx on public.user_data (updated_at desc);

create or replace function public.touch_user_data_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_data_updated on public.user_data;
create trigger user_data_updated
  before update on public.user_data
  for each row execute function public.touch_user_data_updated_at();

alter table public.user_data enable row level security;

drop policy if exists "User data: owner select" on public.user_data;
create policy "User data: owner select"
  on public.user_data for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "User data: owner insert" on public.user_data;
create policy "User data: owner insert"
  on public.user_data for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "User data: owner update" on public.user_data;
create policy "User data: owner update"
  on public.user_data for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "User data: owner delete" on public.user_data;
create policy "User data: owner delete"
  on public.user_data for delete
  to authenticated
  using (auth.uid() = user_id);
