-- ============================================================
-- migration_v25_site_url.sql
-- Corrige la redirection Stripe (pointait vers localhost)
-- ============================================================
alter table public.site_config add column if not exists site_url text default '';
update public.site_config set site_url = 'https://boucheriedes24h-halal.netlify.app' where id = 1;
