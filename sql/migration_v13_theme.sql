alter table public.site_config
  add column if not exists theme_color text not null default 'red'
  check (theme_color in ('red', 'green', 'blue', 'gold', 'purple', 'teal', 'orange'));
