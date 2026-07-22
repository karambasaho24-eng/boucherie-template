-- ============================================================
-- MIGRATION v10 — Activation Supabase Realtime
-- Permet aux pages client (suivi de commande, accueil, boutique)
-- de se mettre à jour automatiquement sans recharger la page.
-- À exécuter dans Supabase SQL Editor
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'site_config'
  ) then
    alter publication supabase_realtime add table public.site_config;
  end if;
end $$;

alter table public.orders replica identity full;
