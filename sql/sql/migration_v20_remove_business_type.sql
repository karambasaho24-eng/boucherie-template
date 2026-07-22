-- migration_v20_remove_business_type.sql
-- À exécuter dans l'éditeur SQL de Supabase

alter table public.site_config
  drop column if exists business_type;
