alter table public.site_config drop constraint if exists site_config_theme_color_check;
alter table public.site_config
  add constraint site_config_theme_color_check
  check (theme_color in ('original', 'red', 'green', 'blue', 'gold', 'purple', 'teal', 'orange', 'rose', 'slate', 'terracotta'));
