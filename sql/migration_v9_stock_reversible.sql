-- ============================================================
-- MIGRATION v9 — Stock réversible
-- Permet de restaurer le stock si une commande confirmée est
-- repassée en "En attente" (ou tout statut antérieur à la
-- décrémentation), et empêche tout double-décrément.
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. Colonne de suivi : le stock a-t-il déjà été décrémenté
--    pour cette commande ?
-- ============================================================
alter table public.orders
  add column if not exists stock_decremented boolean not null default false;

-- ============================================================
-- 2. Fonction de décrément, sécurisée contre le double-appel
-- ============================================================
create or replace function public.decrement_stock_for_order(
  p_order_id uuid
)
returns void language plpgsql security definer as $$
declare
  v_already   boolean;
  v_item      jsonb;
  v_product   record;
  v_qty_kg    numeric(10,3);
  v_new_stock numeric(10,3);
begin
  select stock_decremented into v_already
    from public.orders where id = p_order_id;

  -- Déjà décrémenté pour cette commande : ne rien refaire.
  if v_already then
    return;
  end if;

  for v_item in
    select jsonb_array_elements(items) from public.orders where id = p_order_id
  loop
    v_qty_kg := (v_item->>'qty')::numeric;

    select * into v_product
      from public.products
      where id = (v_item->>'id')::uuid and stock_enabled = true;

    if not found then continue; end if;

    v_new_stock := greatest(v_product.stock_kg - v_qty_kg, 0);

    update public.products
      set stock_kg = v_new_stock
      where id = v_product.id;

    insert into public.stock_movements
      (product_id, delta_kg, stock_after, reason, reference_id, note)
    values
      (v_product.id, -v_qty_kg, v_new_stock, 'order', p_order_id,
       'Déduction automatique après commande #' || left(p_order_id::text, 8));

    if v_new_stock = 0 and v_product.availability_mode = 'available' then
      update public.products
        set availability_mode = 'out_of_stock'
        where id = v_product.id;
    end if;
  end loop;

  update public.orders
    set stock_decremented = true
    where id = p_order_id;
end;
$$;

-- ============================================================
-- 3. Fonction inverse : restaure le stock d'une commande dont
--    le stock avait été décrémenté (ex: retour en "En attente").
--    Sécurisée contre le double-restock.
-- ============================================================
create or replace function public.restock_order(
  p_order_id uuid
)
returns void language plpgsql security definer as $$
declare
  v_already   boolean;
  v_item      jsonb;
  v_product   record;
  v_qty_kg    numeric(10,3);
  v_new_stock numeric(10,3);
begin
  select stock_decremented into v_already
    from public.orders where id = p_order_id;

  -- Rien à restaurer si le stock n'avait pas été décrémenté.
  if not v_already then
    return;
  end if;

  for v_item in
    select jsonb_array_elements(items) from public.orders where id = p_order_id
  loop
    v_qty_kg := (v_item->>'qty')::numeric;

    select * into v_product
      from public.products
      where id = (v_item->>'id')::uuid and stock_enabled = true;

    if not found then continue; end if;

    v_new_stock := v_product.stock_kg + v_qty_kg;

    update public.products
      set stock_kg = v_new_stock
      where id = v_product.id;

    insert into public.stock_movements
      (product_id, delta_kg, stock_after, reason, reference_id, note)
    values
      (v_product.id, v_qty_kg, v_new_stock, 'order_revert', p_order_id,
       'Restauration stock — commande #' || left(p_order_id::text, 8) || ' repassée en attente');

    -- Si le produit était en rupture et qu'il y a de nouveau du stock,
    -- on le repasse disponible automatiquement.
    if v_new_stock > 0 and v_product.availability_mode = 'out_of_stock' then
      update public.products
        set availability_mode = 'available'
        where id = v_product.id;
    end if;
  end loop;

  update public.orders
    set stock_decremented = false
    where id = p_order_id;
end;
$$;
