-- ============================================================
-- MIGRATION v3 — Mode de commande configurable + WhatsApp
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- Ajout des colonnes nécessaires (sans danger si déjà présentes)
alter table public.site_config
  add column if not exists whatsapp_number text default '';

alter table public.site_config
  add column if not exists order_mode text default 'both'
  check (order_mode in ('site', 'whatsapp', 'both'));

-- Valeur initiale recommandée (à adapter si besoin)
update public.site_config
  set whatsapp_number = coalesce(whatsapp_number, '') 
  where whatsapp_number is null or whatsapp_number = '';

update public.site_config
  set order_mode = 'both'
  where order_mode is null;

-- ============================================================
-- Policy manquante qui causait l'erreur 401 lors de la commande
-- (insert().select() nécessite un droit de lecture juste après l'insertion)
-- ============================================================

drop policy if exists "orders_insert_select_own" on public.orders;

create policy "orders_insert_select_own"
  on public.orders for select
  using (true);
