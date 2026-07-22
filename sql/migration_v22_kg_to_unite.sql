-- ============================================================
-- migration_v22_kg_to_unite.sql
-- Conversion du système de stock kg -> unité/portion
-- (le restaurant vend des plats à l'unité, pas au poids)
-- Ne change pas la logique métier : décrémentation, réservation,
-- alertes fonctionnent à l'identique, seule l'unité change.
-- ============================================================

-- ---------- Renommage des colonnes ----------
alter table public.products     rename column stock_kg          to stock_qty;
alter table public.products     rename column stock_alert_kg    to stock_alert_qty;
alter table public.products     rename column stock_reserved_kg to stock_reserved_qty;
alter table public.reservations rename column quantity_kg       to quantity;
alter table public.stock_movements rename column delta_kg       to delta_qty;

-- ---------- Vues (recréées avec les nouveaux noms) ----------
drop view if exists public.v_stock_dashboard;
create view public.v_stock_dashboard as
 select id,
    name,
    category,
    availability_mode,
    stock_enabled,
    stock_qty,
    stock_reserved_qty,
    greatest(stock_qty - stock_reserved_qty, 0::numeric) as stock_available_qty,
    stock_alert_qty,
        case
            when stock_enabled and greatest(stock_qty - stock_reserved_qty, 0::numeric) <= stock_alert_qty then true
            else false
        end as alert_triggered,
    ( select count(*) as count
           from reservations r
          where r.product_id = p.id and r.status = 'pending'::text) as pending_reservations
   from products p
  where stock_enabled = true
  order by (
        case
            when stock_enabled and greatest(stock_qty - stock_reserved_qty, 0::numeric) <= stock_alert_qty then true
            else false
        end) desc, name;

drop view if exists public.v_top_products;
create view public.v_top_products as
 select (item.value ->> 'id'::text)::uuid as product_id,
    item.value ->> 'name'::text as product_name,
    sum((item.value ->> 'qty'::text)::numeric) as total_qty,
    sum(((item.value ->> 'price'::text)::numeric) * ((item.value ->> 'qty'::text)::numeric)) as total_revenue,
    count(distinct o.id) as order_count
   from orders o,
    lateral jsonb_array_elements(o.items) item(value)
  where o.status <> all (array['refused'::text, 'cancelled'::text])
  group by (item.value ->> 'id'::text), (item.value ->> 'name'::text)
  order by (sum((item.value ->> 'qty'::text)::numeric)) desc;

-- ---------- Fonctions (corps mis à jour, même signature) ----------
create or replace function public.get_available_stock(p_product_id uuid)
 returns numeric
 language sql stable security definer
as $function$
  select greatest(coalesce(stock_qty, 0) - coalesce(stock_reserved_qty, 0), 0)
  from public.products
  where id = p_product_id and stock_enabled = true;
$function$;

create or replace function public.sync_reserved_stock()
 returns trigger
 language plpgsql security definer
as $function$
declare
  v_product_id uuid;
  v_reserved   numeric(10,3);
begin
  if tg_op = 'DELETE' then
    v_product_id := old.product_id;
  else
    v_product_id := new.product_id;
    if tg_op = 'UPDATE' and old.product_id <> new.product_id then
      select coalesce(sum(quantity), 0) into v_reserved
        from public.reservations
        where product_id = old.product_id and status = 'pending';
      update public.products set stock_reserved_qty = v_reserved where id = old.product_id;
    end if;
  end if;
  select coalesce(sum(quantity), 0) into v_reserved
    from public.reservations
    where product_id = v_product_id and status = 'pending';
  update public.products set stock_reserved_qty = v_reserved where id = v_product_id;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$function$;

create or replace function public.decrement_stock_for_order(p_order_id uuid)
 returns void
 language plpgsql security definer
as $function$
declare
  v_already   boolean;
  v_item      jsonb;
  v_product   record;
  v_qty       numeric(10,3);
  v_new_stock numeric(10,3);
begin
  select stock_decremented into v_already
    from public.orders where id = p_order_id;

  if v_already then
    return;
  end if;

  for v_item in
    select jsonb_array_elements(items) from public.orders where id = p_order_id
  loop
    v_qty := (v_item->>'qty')::numeric;

    select * into v_product
      from public.products
      where id = (v_item->>'id')::uuid and stock_enabled = true;

    if not found then continue; end if;

    v_new_stock := greatest(v_product.stock_qty - v_qty, 0);

    update public.products
      set stock_qty = v_new_stock
      where id = v_product.id;

    insert into public.stock_movements
      (product_id, delta_qty, stock_after, reason, reference_id, note)
    values
      (v_product.id, -v_qty, v_new_stock, 'order', p_order_id,
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
$function$;

create or replace function public.restock_order(p_order_id uuid)
 returns void
 language plpgsql security definer
as $function$
declare
  v_already   boolean;
  v_item      jsonb;
  v_product   record;
  v_qty       numeric(10,3);
  v_new_stock numeric(10,3);
begin
  select stock_decremented into v_already
    from public.orders where id = p_order_id;

  if not v_already then
    return;
  end if;

  for v_item in
    select jsonb_array_elements(items) from public.orders where id = p_order_id
  loop
    v_qty := (v_item->>'qty')::numeric;

    select * into v_product
      from public.products
      where id = (v_item->>'id')::uuid and stock_enabled = true;

    if not found then continue; end if;

    v_new_stock := v_product.stock_qty + v_qty;

    update public.products
      set stock_qty = v_new_stock
      where id = v_product.id;

    insert into public.stock_movements
      (product_id, delta_qty, stock_after, reason, reference_id, note)
    values
      (v_product.id, v_qty, v_new_stock, 'order_revert', p_order_id,
       'Restauration stock — commande #' || left(p_order_id::text, 8) || ' repassée en attente');

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
$function$;

-- ---------- Fonctions dont le type de retour change (drop + create requis) ----------
drop function if exists public.top_products(date, date, integer);
create function public.top_products(p_start date, p_end date, p_limit integer default 10)
 returns table(product_id uuid, product_name text, total_qty numeric, total_revenue numeric, order_count bigint)
 language sql stable security definer
as $function$
  select
    (item->>'id')::uuid as product_id,
    item->>'name' as product_name,
    sum((item->>'qty')::numeric) as total_qty,
    sum((item->>'price')::numeric * (item->>'qty')::numeric) as total_revenue,
    count(distinct o.id) as order_count
  from public.orders o,
       jsonb_array_elements(o.items) as item
  where o.status not in ('refused', 'cancelled')
    and o.created_at::date between p_start and p_end
  group by item->>'id', item->>'name'
  order by total_qty desc
  limit p_limit;
$function$;

drop function if exists public.revenue_by_category(date, date);
create function public.revenue_by_category(p_start date, p_end date)
 returns table(category text, total_revenue numeric, total_qty numeric)
 language sql stable security definer
as $function$
  select
    coalesce(p.category, 'Autre') as category,
    sum((item->>'price')::numeric * (item->>'qty')::numeric) as total_revenue,
    sum((item->>'qty')::numeric) as total_qty
  from public.orders o,
       jsonb_array_elements(o.items) as item
  left join public.products p on p.id = (item->>'id')::uuid
  where o.status not in ('refused', 'cancelled')
    and o.created_at::date between p_start and p_end
  group by coalesce(p.category, 'Autre')
  order by total_revenue desc;
$function$;

-- ---------- Nettoyage : arrondir les valeurs existantes à l'entier ----------
update public.products set
  stock_qty = round(stock_qty),
  stock_alert_qty = round(stock_alert_qty),
  stock_reserved_qty = round(stock_reserved_qty)
where stock_enabled = true;
