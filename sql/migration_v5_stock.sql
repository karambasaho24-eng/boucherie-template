-- ============================================================
-- MIGRATION v5 — Gestion complète des stocks au kilo
-- À exécuter dans Supabase SQL Editor
-- Idempotente : peut être rejouée sans danger
-- ============================================================

-- ============================================================
-- 1. EXTENSION DES PRODUITS
--    Ajout des colonnes de gestion des stocks et disponibilité
-- ============================================================

-- Mode de disponibilité : remplace le booléen is_available
alter table public.products
  add column if not exists availability_mode text not null default 'available'
  check (availability_mode in (
    'available',          -- Disponible (achat direct)
    'pickup_only',        -- Retrait boutique uniquement
    'reservation_only',   -- Réservation uniquement
    'out_of_stock',       -- Rupture de stock
    'disabled'            -- Désactivé temporairement
  ));

-- Gestion des stocks au kilo
alter table public.products
  add column if not exists stock_enabled     boolean not null default false;

alter table public.products
  add column if not exists stock_kg          numeric(10,3) not null default 0
  check (stock_kg >= 0);

alter table public.products
  add column if not exists stock_alert_kg    numeric(10,3) not null default 1
  check (stock_alert_kg >= 0);

-- Stock réservé (calculé automatiquement, mis à jour par trigger)
alter table public.products
  add column if not exists stock_reserved_kg numeric(10,3) not null default 0
  check (stock_reserved_kg >= 0);

-- Rétrocompatibilité : synchroniser is_available avec availability_mode
-- (le front public utilise encore is_available dans certains endroits)
update public.products
  set availability_mode = case
    when is_available = true  then 'available'
    when is_available = false then 'disabled'
    else 'available'
  end
  where availability_mode = 'available' and is_available = false;


-- ============================================================
-- 2. TABLE DES RÉSERVATIONS
-- ============================================================

create table if not exists public.reservations (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  customer_name text not null,
  phone         text not null,
  quantity_kg   numeric(10,3) not null check (quantity_kg > 0),
  note          text,
  status        text not null default 'pending'
    check (status in ('pending', 'accepted', 'refused', 'cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index pour les requêtes fréquentes
create index if not exists reservations_product_id_idx on public.reservations(product_id);
create index if not exists reservations_status_idx     on public.reservations(status);
create index if not exists reservations_created_at_idx on public.reservations(created_at desc);


-- ============================================================
-- 3. TABLE DE L'HISTORIQUE DES MOUVEMENTS DE STOCK
-- ============================================================

create table if not exists public.stock_movements (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  delta_kg     numeric(10,3) not null,        -- positif = entrée, négatif = sortie
  stock_after  numeric(10,3) not null,        -- stock immédiatement après le mouvement
  reason       text not null,                 -- 'order', 'reservation_accept', 'manual_adjust', 'refund', ...
  reference_id uuid,                          -- id de la commande ou réservation liée (optionnel)
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists stock_movements_product_id_idx  on public.stock_movements(product_id);
create index if not exists stock_movements_created_at_idx  on public.stock_movements(created_at desc);


-- ============================================================
-- 4. TRIGGER : updated_at automatique sur les réservations
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reservations_set_updated_at on public.reservations;
create trigger reservations_set_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();


-- ============================================================
-- 5. TRIGGER : recalcul du stock_reserved_kg
--    Appelé à chaque insert/update/delete sur reservations
--    pour maintenir le compteur en temps réel
-- ============================================================

create or replace function public.sync_reserved_stock()
returns trigger language plpgsql security definer as $$
declare
  v_product_id uuid;
  v_reserved   numeric(10,3);
begin
  -- Détermine quel produit est concerné
  if tg_op = 'DELETE' then
    v_product_id := old.product_id;
  else
    v_product_id := new.product_id;
    -- Si le produit a changé (update), recalculer l'ancien aussi
    if tg_op = 'UPDATE' and old.product_id <> new.product_id then
      select coalesce(sum(quantity_kg), 0) into v_reserved
        from public.reservations
        where product_id = old.product_id and status = 'pending';
      update public.products set stock_reserved_kg = v_reserved where id = old.product_id;
    end if;
  end if;

  -- Recalcule la somme des réservations actives (pending uniquement)
  select coalesce(sum(quantity_kg), 0) into v_reserved
    from public.reservations
    where product_id = v_product_id and status = 'pending';

  update public.products
    set stock_reserved_kg = v_reserved
    where id = v_product_id;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists reservations_sync_stock on public.reservations;
create trigger reservations_sync_stock
  after insert or update or delete on public.reservations
  for each row execute function public.sync_reserved_stock();


-- ============================================================
-- 6. FONCTION : décrémenter le stock après une commande validée
--    Appelée depuis le front-end admin (ou via webhook/edge fn)
-- ============================================================

create or replace function public.decrement_stock_for_order(
  p_order_id uuid
)
returns void language plpgsql security definer as $$
declare
  v_item      jsonb;
  v_product   record;
  v_qty_kg    numeric(10,3);
  v_new_stock numeric(10,3);
begin
  -- Récupère les articles de la commande
  for v_item in
    select jsonb_array_elements(items) from public.orders where id = p_order_id
  loop
    v_qty_kg := (v_item->>'qty')::numeric;

    -- Récupère le produit
    select * into v_product
      from public.products
      where id = (v_item->>'id')::uuid and stock_enabled = true;

    if not found then continue; end if; -- pas de gestion de stock pour ce produit

    v_new_stock := greatest(v_product.stock_kg - v_qty_kg, 0);

    -- Met à jour le stock
    update public.products
      set stock_kg = v_new_stock
      where id = v_product.id;

    -- Enregistre le mouvement
    insert into public.stock_movements
      (product_id, delta_kg, stock_after, reason, reference_id, note)
    values
      (v_product.id, -v_qty_kg, v_new_stock, 'order', p_order_id,
       'Déduction automatique après commande #' || left(p_order_id::text, 8));

    -- Passe en rupture si stock épuisé et gestion active
    if v_new_stock = 0 and v_product.availability_mode = 'available' then
      update public.products
        set availability_mode = 'out_of_stock'
        where id = v_product.id;
    end if;
  end loop;
end;
$$;


-- ============================================================
-- 7. FONCTION : vérifier la disponibilité d'un produit
--    Renvoie la quantité réellement disponible à la commande
-- ============================================================

create or replace function public.get_available_stock(p_product_id uuid)
returns numeric language sql stable security definer as $$
  select greatest(
    coalesce(stock_kg, 0) - coalesce(stock_reserved_kg, 0),
    0
  )
  from public.products
  where id = p_product_id and stock_enabled = true;
$$;


-- ============================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================

-- Réservations : tout le monde peut créer, seul l'admin peut lire/modifier/supprimer
alter table public.reservations enable row level security;

drop policy if exists "reservations_public_insert" on public.reservations;
create policy "reservations_public_insert"
  on public.reservations for insert
  with check (true);

drop policy if exists "reservations_public_select_own" on public.reservations;
create policy "reservations_public_select_own"
  on public.reservations for select
  using (true);   -- les ids UUID sont impossibles à deviner, on garde la même logique que orders

drop policy if exists "reservations_admin_all" on public.reservations;
create policy "reservations_admin_all"
  on public.reservations for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Mouvements de stock : lecture admin uniquement
alter table public.stock_movements enable row level security;

drop policy if exists "stock_movements_admin_read" on public.stock_movements;
create policy "stock_movements_admin_read"
  on public.stock_movements for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "stock_movements_admin_insert" on public.stock_movements;
create policy "stock_movements_admin_insert"
  on public.stock_movements for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );


-- ============================================================
-- 9. VUE ADMIN : résumé des stocks avec alertes
-- ============================================================

create or replace view public.v_stock_dashboard as
select
  p.id,
  p.name,
  p.category,
  p.availability_mode,
  p.stock_enabled,
  p.stock_kg,
  p.stock_reserved_kg,
  greatest(p.stock_kg - p.stock_reserved_kg, 0) as stock_available_kg,
  p.stock_alert_kg,
  case
    when p.stock_enabled and greatest(p.stock_kg - p.stock_reserved_kg, 0) <= p.stock_alert_kg
      then true
    else false
  end as alert_triggered,
  (select count(*) from public.reservations r
   where r.product_id = p.id and r.status = 'pending') as pending_reservations
from public.products p
where p.stock_enabled = true
order by alert_triggered desc, p.name;

-- Droits de lecture sur la vue (admin via RLS sur les tables sources)
grant select on public.v_stock_dashboard to authenticated;
