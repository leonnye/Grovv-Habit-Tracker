-- Email-based Pro approval.
--
-- Payment is intentionally disabled in the app. To grant someone Pro, add a
-- row here with their account email (the email they sign in with). When that
-- user signs in, the app reads their own row and unlocks Pro features.
--
-- Manage approvals from the Supabase dashboard (Table editor / SQL editor):
--   insert into public.premium_access (email) values ('person@example.com');
--   update public.premium_access set approved = false where email = 'person@example.com';

create table if not exists public.premium_access (
  email text primary key,
  approved boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

-- Store/compare emails case-insensitively so approvals are robust.
create or replace function public.lowercase_premium_email()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists premium_access_lowercase on public.premium_access;
create trigger premium_access_lowercase
  before insert or update on public.premium_access
  for each row execute function public.lowercase_premium_email();

alter table public.premium_access enable row level security;

-- A signed-in user may read ONLY their own approval row (matched on the email
-- in their JWT). No insert/update/delete policies exist, so only the service
-- role (dashboard / admin) can change approvals.
drop policy if exists "read own premium access" on public.premium_access;
create policy "read own premium access"
  on public.premium_access
  for select
  to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
