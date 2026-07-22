-- ============================================================
-- migration_v19_business_type.sql
-- Rend le site générique : type de commerce + favicon personnalisable
-- ============================================================

alter table public.site_config
  add column if not exists business_type text default 'restaurant', -- 'boucherie' | 'poissonnerie' | 'epicerie' | 'restaurant' | 'autre'
  add column if not exists favicon_url   text default '';

-- business_type pilote automatiquement :
--   - le sous-titre affiché sous le nom dans la navbar ("Restaurant africain", "Poissonnerie", etc.)
--   - le libellé affiché ou non selon le commerce
--   - l'unité de mesure par défaut suggérée à la création d'un produit (kg / unité)
