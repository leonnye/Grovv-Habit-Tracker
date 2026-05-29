-- Grovv — auth & photo storage migration
--
-- Run this once against your Supabase project (SQL editor) to enable
-- progress-photo uploads. Sign-in is fully optional; the app keeps
-- working in local-only mode if you skip this.

-- Storage bucket for habit photos. Bucket is PRIVATE — RLS controls
-- who can read each object. The convention is one folder per user:
--   photos/<auth.uid()>/<photo_id>.<ext>
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Owner-only read/write on the storage object's first path segment.
drop policy if exists "Photos owner read" on storage.objects;
create policy "Photos owner read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Photos owner write" on storage.objects;
create policy "Photos owner write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Photos owner delete" on storage.objects;
create policy "Photos owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Metadata table — one row per uploaded photo. Lets us attach a caption,
-- a habit reference, and a logged date without round-tripping storage.
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  caption text,
  habit_id text,
  logged_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists photos_user_created_idx
  on public.photos (user_id, created_at desc);

alter table public.photos enable row level security;

drop policy if exists "Photos: owner select" on public.photos;
create policy "Photos: owner select"
  on public.photos for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Photos: owner insert" on public.photos;
create policy "Photos: owner insert"
  on public.photos for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Photos: owner update" on public.photos;
create policy "Photos: owner update"
  on public.photos for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Photos: owner delete" on public.photos;
create policy "Photos: owner delete"
  on public.photos for delete
  to authenticated
  using (auth.uid() = user_id);
