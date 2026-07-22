-- ============================================================
-- migration_v24_ubereats_link.sql
-- Ajoute un lien Uber Eats activable/désactivable depuis l'admin
-- ============================================================
alter table public.site_config
  add column if not exists ubereats_enabled boolean not null default false,
  add column if not exists ubereats_url text default '';
