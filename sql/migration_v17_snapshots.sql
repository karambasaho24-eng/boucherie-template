create table if not exists public.dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  period_start date not null,
  period_end date not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.dashboard_snapshots enable row level security;

drop policy if exists "snapshots_admin_all" on public.dashboard_snapshots;
create policy "snapshots_admin_all"
  on public.dashboard_snapshots for all
  to authenticated
  using (true)
  with check (true);

revoke all on public.dashboard_snapshots from anon;
