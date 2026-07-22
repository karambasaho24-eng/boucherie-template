alter table public.site_config
  add column if not exists logo_url text;

alter table public.site_config
  add column if not exists about_title text not null default 'Notre histoire';

alter table public.site_config
  add column if not exists about_text text not null default
    'Chez Mama Goundo, nous préparons chaque plat avec exigence et à la main, dans le respect des traditions culinaires africaines.';
