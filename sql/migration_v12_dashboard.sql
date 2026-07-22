create or replace view public.v_dashboard_stats as
select
  count(*) as total_orders,
  count(*) filter (where status not in ('refused','cancelled')) as valid_orders,
  count(*) filter (where payment_status = 'paid') as paid_orders,
  coalesce(sum(total_price) filter (where payment_status = 'paid'), 0) as total_revenue,
  coalesce(avg(total_price) filter (where payment_status = 'paid'), 0) as avg_order_value,
  count(distinct phone) as unique_customers,
  count(*) filter (where status = 'pending') as pending_orders,
  count(*) filter (where status = 'confirmed') as confirmed_orders,
  count(*) filter (where created_at >= current_date) as orders_today,
  coalesce(sum(total_price) filter (where payment_status = 'paid' and created_at >= current_date), 0) as revenue_today
from public.orders;

create or replace view public.v_top_products as
select
  (item->>'id')::uuid as product_id,
  item->>'name' as product_name,
  sum((item->>'qty')::numeric) as total_qty_kg,
  sum((item->>'price')::numeric * (item->>'qty')::numeric) as total_revenue,
  count(distinct o.id) as order_count
from public.orders o,
     jsonb_array_elements(o.items) as item
where o.status not in ('refused', 'cancelled')
group by item->>'id', item->>'name'
order by total_qty_kg desc;

create or replace view public.v_revenue_by_day as
select
  date_trunc('day', paid_at)::date as day,
  sum(total_price) as revenue,
  count(*) as orders_count
from public.orders
where payment_status = 'paid'
  and paid_at >= current_date - interval '30 days'
group by date_trunc('day', paid_at)
order by day asc;

create or replace view public.v_top_customers as
select
  phone,
  max(customer_name) as customer_name,
  count(*) as order_count,
  coalesce(sum(total_price) filter (where payment_status = 'paid'), 0) as total_spent,
  max(created_at) as last_order_at
from public.orders
group by phone
order by total_spent desc;

revoke all on public.v_dashboard_stats   from anon;
revoke all on public.v_top_products      from anon;
revoke all on public.v_revenue_by_day    from anon;
revoke all on public.v_top_customers     from anon;

grant select on public.v_dashboard_stats to authenticated;
grant select on public.v_top_products    to authenticated;
grant select on public.v_revenue_by_day  to authenticated;
grant select on public.v_top_customers   to authenticated;
