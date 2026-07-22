-- ============================================================
-- migration_v18_stripe_config.sql
-- Stocke les clés Stripe directement dans site_config
-- ============================================================

alter table public.site_config
  add column if not exists stripe_secret_key     text default '',
  add column if not exists stripe_publishable_key text default '',
  add column if not exists stripe_webhook_secret  text default '',
  add column if not exists stripe_mode            text default 'test'; -- 'test' ou 'live'

-- Seuls les admins authentifiés peuvent lire/modifier ces colonnes
-- (la RLS existante sur site_config couvre déjà ça)
