-- One branding kit per Clerk user. Primary key is the Clerk user id (text).
create table if not exists public.branding_kits (
  user_id text primary key,
  version int not null default 2,
  brand_name text not null default '',
  tagline text not null default '',
  primary_color text not null default '',
  secondary_color text not null default '',
  accent_color text not null default '',
  voice_tone text not null default '',
  extra_notes text not null default '',
  heading_typography jsonb not null default '{}'::jsonb,
  body_typography jsonb not null default '{}'::jsonb,
  logo_path text,
  logo_media_type text,
  heading_font_path text,
  heading_font_media_type text,
  body_font_path text,
  body_font_media_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.tg_branding_kits_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists branding_kits_set_updated_at on public.branding_kits;
create trigger branding_kits_set_updated_at
  before update on public.branding_kits
  for each row execute function public.tg_branding_kits_set_updated_at();

-- RLS is defense-in-depth: server uses the service-role key (which bypasses RLS),
-- but if the anon key is ever used directly, callers must present a verified
-- Clerk JWT (third-party auth) and can only see their own row.
alter table public.branding_kits enable row level security;

drop policy if exists "branding_kits_owner_all" on public.branding_kits;
create policy "branding_kits_owner_all"
  on public.branding_kits
  for all
  to authenticated
  using (user_id = (auth.jwt() ->> 'sub'))
  with check (user_id = (auth.jwt() ->> 'sub'));

-- Private bucket holding logo + custom font files at `<userId>/<asset>`.
insert into storage.buckets (id, name, public)
values ('branding-assets', 'branding-assets', false)
on conflict (id) do nothing;

drop policy if exists "branding_assets_owner_select" on storage.objects;
create policy "branding_assets_owner_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'branding-assets'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

drop policy if exists "branding_assets_owner_insert" on storage.objects;
create policy "branding_assets_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'branding-assets'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

drop policy if exists "branding_assets_owner_update" on storage.objects;
create policy "branding_assets_owner_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'branding-assets'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  )
  with check (
    bucket_id = 'branding-assets'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

drop policy if exists "branding_assets_owner_delete" on storage.objects;
create policy "branding_assets_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'branding-assets'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );
