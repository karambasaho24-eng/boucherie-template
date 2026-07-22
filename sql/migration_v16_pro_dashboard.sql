-- ============================================================
-- MIGRATION v16 — Dashboard professionnel
-- ============================================================

create or replace function public.dashboard_stats(p_start date, p_end date)
returns table (
  total_orders bigint,
  valid_orders bigint,
  paid_orders bigint,
  total_revenue numeric,
  avg_order_value numeric,
  unique_customers bigint,
  pending_orders bigint,
  confirmed_orders bigint
)
language sql stable security definer as $$
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
$$;

revoke all on function public.dashboard_stats from anon;
grant execute on function public.dashboard_stats to authenticated;

create or replace function public.revenue_by_day(p_start date, p_end date)
returns table (day date, revenue numeric, orders_count bigint)
language sql stable security definer as $$
  select
    d.day::date as day,
    coalesce(sum(o.total_price), 0) as revenue,
    coalesce(count(o.id), 0) as orders_count
  from generate_series(p_start, p_end, interval '1 day') as d(day)
  left join public.orders o
    on date_trunc('day', o.paid_at) = d.day
    and o.payment_status = 'paid'
  group by d.day
  order by d.day asc;
$$;

revoke all on function public.revenue_by_day from anon;
grant execute on function public.revenue_by_day to authenticated;

create or replace function public.top_products(p_start date, p_end date, p_limit int default 10)
returns table (
  product_id uuid,
  product_name text,
  total_qty_kg numeric,
  total_revenue numeric,
  order_count bigint
)
language sql stable security definer as $$
  select
    (item->>'id')::uuid as product_id,
    item->>'name' as product_name,
    sum((item->>'qty')::numeric) as total_qty_kg,
    sum((item->>'price')::numeric * (item->>'qty')::numeric) as total_revenue,
    count(distinct o.id) as order_count
  from public.orders o,
       jsonb_array_elements(o.items) as item
  where o.status not in ('refused', 'cancelled')
    and o.created_at::date between p_start and p_end
  group by item->>'id', item->>'name'
  order by total_qty_kg desc
  limit p_limit;
$$;

revoke all on function public.top_products from anon;
grant execute on function public.top_products to authenticated;

create or replace function public.top_customers(p_start date, p_end date, p_limit int default 10)
returns table (
  phone text,
  customer_name text,
  order_count bigint,
  total_spent numeric,
  last_order_at timestamptz
)
language sql stable security definer as $$
  select
    phone,
    max(customer_name) as customer_name,
    count(*) as order_count,
    coalesce(sum(total_price) filter (where payment_status = 'paid'), 0) as total_spent,
    max(created_at) as last_order_at
  from public.orders
  where created_at::date between p_start and p_end
  group by phone
  order by total_spent desc
  limit p_limit;
$$;

revoke all on function public.top_customers from anon;
grant execute on function public.top_customers to authenticated;

create or replace function public.revenue_by_category(p_start date, p_end date)
returns table (category text, total_revenue numeric, total_qty_kg numeric)
language sql stable security definer as $$
  select
    coalesce(p.category, 'Autre') as category,
    sum((item->>'price')::numeric * (item->>'qty')::numeric) as total_revenue,
    sum((item->>'qty')::numeric) as total_qty_kg
  from public.orders o,
       jsonb_array_elements(o.items) as item
  left join public.products p on p.id = (item->>'id')::uuid
  where o.status not in ('refused', 'cancelled')
    and o.created_at::date between p_start and p_end
  group by coalesce(p.category, 'Autre')
  order by total_revenue desc;
$$;

revoke all on function public.revenue_by_category from anon;
grant execute on function public.revenue_by_category to authenticated;

create or replace function public.orders_by_weekday(p_start date, p_end date)
returns table (weekday int, order_count bigint, revenue numeric)
language sql stable security definer as $$
  select
    extract(isodow from created_at)::int as weekday,
    count(*) as order_count,
    coalesce(sum(total_price) filter (where payment_status = 'paid'), 0) as revenue
  from public.orders
  where created_at::date between p_start and p_end
  group by extract(isodow from created_at)
  order by weekday;
$$;

create or replace function public.orders_by_hour(p_start date, p_end date)
returns table (hour_of_day int, order_count bigint)
language sql stable security definer as $$
  select
    extract(hour from created_at)::int as hour_of_day,
    count(*) as order_count
  from public.orders
  where created_at::date between p_start and p_end
  group by extract(hour from created_at)
  order by hour_of_day;
$$;

revoke all on function public.orders_by_weekday from anon;
revoke all on function public.orders_by_hour from anon;
grant execute on function public.orders_by_weekday to authenticated;
grant execute on function public.orders_by_hour to authenticated;
