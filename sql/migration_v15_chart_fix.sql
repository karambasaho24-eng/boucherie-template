create or replace view public.v_revenue_by_day as
select
  d.day::date as day,
  coalesce(sum(o.total_price), 0) as revenue,
  coalesce(count(o.id), 0) as orders_count
from generate_series(
       current_date - interval '29 days',
       current_date,
       interval '1 day'
     ) as d(day)
left join public.orders o
  on date_trunc('day', o.paid_at) = d.day
  and o.payment_status = 'paid'
group by d.day
order by d.day asc;

grant select on public.v_revenue_by_day to authenticated;
revoke all on public.v_revenue_by_day from anon;
