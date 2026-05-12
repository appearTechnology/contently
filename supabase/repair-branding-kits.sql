-- Fix "Could not find column ... branding_kits" / schema cache errors.
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run (IF NOT EXISTS). Then retry saving branding in the app.
--
-- Prefer long-term: `supabase link` + `supabase db push` so migrations apply automatically.

-- 0002_voice_tone_tags.sql
alter table public.branding_kits
  add column if not exists voice_tone_tags jsonb not null default '[]'::jsonb;

-- 0003_branding_logo_variants.sql
alter table public.branding_kits
  add column if not exists secondary_logo_path text,
  add column if not exists secondary_logo_media_type text,
  add column if not exists icon_path text,
  add column if not exists icon_media_type text;

-- 0004_palette_extras.sql
alter table public.branding_kits
  add column if not exists palette_extras jsonb not null default '[]'::jsonb;

-- Tell PostgREST to reload its schema cache so REST/API sees new columns immediately.
-- If you still see "schema cache" errors, wait ~30s or use Dashboard → Settings → API → restart.
notify pgrst, 'reload schema';
