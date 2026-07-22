-- ============================================================
-- migration_v23_security_hardening.sql
-- Corrige les failles critiques trouvées par l'audit :
-- 1) Policies "admin" qui ne vérifiaient pas is_admin()
-- 2) Fonctions RPC admin appelables par n'importe qui
-- 3) search_path non fixé sur les fonctions (bonne pratique)
-- ============================================================

-- ---------- 1) Policies RLS : vérifier is_admin(), pas juste "authenticated" ----------
drop policy if exists orders_admin_all on public.orders;
create policy orders_admin_all on public.orders
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists snapshots_admin_all on public.dashboard_snapshots;
create policy snapshots_admin_all on public.dashboard_snapshots
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- 2) Fonctions admin : garde is_admin() + search_path fixé ----------
create or replace function public.dashboard_stats(p_start date, p_end date)
 returns table(total_orders bigint, valid_orders bigint, paid_orders bigint, total_revenue numeric, avg_order_value numeric, unique_customers bigint, pending_orders bigint, confirmed_orders bigint)
 language plpgsql stable security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'Accès refusé'; end if;
  return query
  select
    count(*) as total_orders,
    count(*) filter (where status not in ('refused','cancelled')) as valid_orders,
    count(*) filter (where payment_status = 'paid') as paid_orders,
    coalesce(sum(total_price) filter (where payment_status = 'paid'), 0) as total_revenue,
    coalesce(avg(total_price) filter (where payment_status = 'paid'), 0) as avg_order_value,
    count(distinct phone) as unique_customers,
    count(*) filter (where status = 'pending') as pending_orders,
    count(*) filter (where status = 'confirmed') as confirmed_orders
  from public.orders
  where created_at::date between p_start and p_end;
end;
$function$;

create or replace function public.orders_by_hour(p_start date, p_end date)
 returns table(hour_of_day integer, order_count bigint)
 language plpgsql stable security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'Accès refusé'; end if;
  return query
  select extract(hour from created_at)::int as hour_of_day, count(*) as order_count
  from public.orders
  where created_at::date between p_start and p_end
  group by extract(hour from created_at)
  order by hour_of_day;
end;
$function$;

create or replace function public.orders_by_weekday(p_start date, p_end date)
 returns table(weekday integer, order_count bigint, revenue numeric)
 language plpgsql stable security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'Accès refusé'; end if;
  return query
  select extract(isodow from created_at)::int as weekday, count(*) as order_count,
    coalesce(sum(total_price) filter (where payment_status = 'paid'), 0) as revenue
  from public.orders
  where created_at::date between p_start and p_end
  group by extract(isodow from created_at)
  order by weekday;
end;
$function$;

create or replace function public.revenue_by_day(p_start date, p_end date)
 returns table(day date, revenue numeric, orders_count bigint)
 language plpgsql stable security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'Accès refusé'; end if;
  return query
  select d.day::date as day, coalesce(sum(o.total_price), 0) as revenue, coalesce(count(o.id), 0) as orders_count
  from generate_series(p_start, p_end, interval '1 day') as d(day)
  left join public.orders o on date_trunc('day', o.paid_at) = d.day and o.payment_status = 'paid'
  group by d.day
  order by d.day asc;
end;
$function$;

create or replace function public.top_customers(p_start date, p_end date, p_limit integer default 10)
 returns table(phone text, customer_name text, order_count bigint, total_spent numeric, last_order_at timestamp with time zone)
 language plpgsql stable security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'Accès refusé'; end if;
  return query
  select phone, max(customer_name) as customer_name, count(*) as order_count,
    coalesce(sum(total_price) filter (where payment_status = 'paid'), 0) as total_spent,
    max(created_at) as last_order_at
  from public.orders
  where created_at::date between p_start and p_end
  group by phone
  order by total_spent desc
  limit p_limit;
end;
$function$;

drop function if exists public.top_products(date, date, integer);
create function public.top_products(p_start date, p_end date, p_limit integer default 10)
 returns table(product_id uuid, product_name text, total_qty numeric, total_revenue numeric, order_count bigint)
 language plpgsql stable security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'Accès refusé'; end if;
  return query
  select (item->>'id')::uuid as product_id, item->>'name' as product_name,
    sum((item->>'qty')::numeric) as total_qty,
    sum((item->>'price')::numeric * (item->>'qty')::numeric) as total_revenue,
    count(distinct o.id) as order_count
  from public.orders o, jsonb_array_elements(o.items) as item
  where o.status not in ('refused', 'cancelled') and o.created_at::date between p_start and p_end
  group by item->>'id', item->>'name'
  order by total_qty desc
  limit p_limit;
end;
$function$;

drop function if exists public.revenue_by_category(date, date);
create function public.revenue_by_category(p_start date, p_end date)
 returns table(category text, total_revenue numeric, total_qty numeric)
 language plpgsql stable security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'Accès refusé'; end if;
  return query
  select coalesce(p.category, 'Autre') as category,
    sum((item->>'price')::numeric * (item->>'qty')::numeric) as total_revenue,
    sum((item->>'qty')::numeric) as total_qty
  from public.orders o, jsonb_array_elements(o.items) as item
  left join public.products p on p.id = (item->>'id')::uuid
  where o.status not in ('refused', 'cancelled') and o.created_at::date between p_start and p_end
  group by coalesce(p.category, 'Autre')
  order by total_revenue desc;
end;
$function$;

create or replace function public.decrement_stock_for_order(p_order_id uuid)
 returns void language plpgsql security definer set search_path = public
as $function$
declare
  v_already boolean; v_item jsonb; v_product record; v_qty numeric(10,3); v_new_stock numeric(10,3);
begin
  if not public.is_admin() then raise exception 'Accès refusé'; end if;
  select stock_decremented into v_already from public.orders where id = p_order_id;
  if v_already then return; end if;
  for v_item in select jsonb_array_elements(items) from public.orders where id = p_order_id loop
    v_qty := (v_item->>'qty')::numeric;
    select * into v_product from public.products where id = (v_item->>'id')::uuid and stock_enabled = true;
    if not found then continue; end if;
    v_new_stock := greatest(v_product.stock_qty - v_qty, 0);
    update public.products set stock_qty = v_new_stock where id = v_product.id;
    insert into public.stock_movements (product_id, delta_qty, stock_after, reason, reference_id, note)
    values (v_product.id, -v_qty, v_new_stock, 'order', p_order_id, 'Déduction automatique après commande #' || left(p_order_id::text, 8));
    if v_new_stock = 0 and v_product.availability_mode = 'available' then
      update public.products set availability_mode = 'out_of_stock' where id = v_product.id;
    end if;
  end loop;
  update public.orders set stock_decremented = true where id = p_order_id;
end;
$function$;

create or replace function public.restock_order(p_order_id uuid)
 returns void language plpgsql security definer set search_path = public
as $function$
declare
  v_already boolean; v_item jsonb; v_product record; v_qty numeric(10,3); v_new_stock numeric(10,3);
begin
  if not public.is_admin() then raise exception 'Accès refusé'; end if;
  select stock_decremented into v_already from public.orders where id = p_order_id;
  if not v_already then return; end if;
  for v_item in select jsonb_array_elements(items) from public.orders where id = p_order_id loop
    v_qty := (v_item->>'qty')::numeric;
    select * into v_product from public.products where id = (v_item->>'id')::uuid and stock_enabled = true;
    if not found then continue; end if;
    v_new_stock := v_product.stock_qty + v_qty;
    update public.products set stock_qty = v_new_stock where id = v_product.id;
    insert into public.stock_movements (product_id, delta_qty, stock_after, reason, reference_id, note)
    values (v_product.id, v_qty, v_new_stock, 'order_revert', p_order_id, 'Restauration stock — commande #' || left(p_order_id::text, 8) || ' repassée en attente');
    if v_new_stock > 0 and v_product.availability_mode = 'out_of_stock' then
      update public.products set availability_mode = 'available' where id = v_product.id;
    end if;
  end loop;
  update public.orders set stock_decremented = false where id = p_order_id;
end;
$function$;

-- ---------- 3) search_path sur les fonctions restantes (bonne pratique) ----------
alter function public.is_admin() set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.get_available_stock(uuid) set search_path = public;
alter function public.sync_reserved_stock() set search_path = public;
