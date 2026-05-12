-- Structured tone-of-voice tags for prompt steering (import + manual edit).
alter table public.branding_kits
  add column if not exists voice_tone_tags jsonb not null default '[]'::jsonb;
