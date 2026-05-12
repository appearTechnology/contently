-- Alternate brand marks (optional): secondary lockup + square/icon, alongside existing primary logo_path.
alter table public.branding_kits
  add column if not exists secondary_logo_path text,
  add column if not exists secondary_logo_media_type text,
  add column if not exists icon_path text,
  add column if not exists icon_media_type text;
