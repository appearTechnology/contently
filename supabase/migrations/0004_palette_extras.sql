alter table public.branding_kits
  add column if not exists palette_extras jsonb not null default '[]'::jsonb;
