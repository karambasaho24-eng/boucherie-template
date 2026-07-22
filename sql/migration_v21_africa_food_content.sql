-- ============================================================
-- migration_v21_africa_food_content.sql
-- Contenu métier : Africa Food Chez Mama Goundo
-- N'ajoute que des colonnes optionnelles (email, siret, business_type
-- au cas où v19 n'a pas été appliquée) + données.
-- Ne touche à aucune logique métier, Stripe, commandes ou admin.
-- ============================================================

-- ---------- Colonnes optionnelles (idempotent, sans risque si déjà présentes) ----------
alter table public.site_config
  add column if not exists email text default '',
  add column if not exists siret text default '',
  add column if not exists business_type text default 'restaurant';

-- ---------- Nettoyage des anciens produits de l'ex-boucherie ----------
delete from public.products where category ilike 'boeuf' or category ilike 'agneau';

-- ---------- Contenu du site ----------
update public.site_config
set
  site_title    = 'Africa Food Chez Mama Goundo',
  hero_title    = 'Chez Mama Goundo',
  hero_subtitle = 'Cuisine ouest-africaine traditionnelle, faite maison chaque jour.',
  about_title   = 'Notre histoire',
  about_text    = 'Africa Food Chez Mama Goundo vous accueille à Le Mans pour vous faire découvrir toute la richesse de la cuisine ouest-africaine. Tous les plats sont préparés selon des recettes traditionnelles avec des ingrédients soigneusement sélectionnés, afin d''offrir une cuisine généreuse, authentique et familiale — à déguster sur place, à emporter ou en livraison.',
  phone         = '06 62 42 85 96',
  address       = '77 Rue Voltaire, 72000 Le Mans',
  opening_hours = '',
  whatsapp_number = '0662428596',
  email         = 'camara.goundoba@icloud.com',
  siret         = '84176547200011',
  business_type = 'restaurant'
where id = 1;

-- ---------- Carte : Entrées ----------
insert into public.products (name, description, price, category, is_available, is_featured)
values
  ('7 Pastels au poulet', 'Sept pastels généreusement garnis de poulet et de légumes, croustillants à souhait.', 10.00, 'Entrées', true, true),
  ('6 Nems', 'Six nems croustillants au poulet et légumes.', 5.00, 'Entrées', true, false);

-- ---------- Carte : Plats ----------
insert into public.products (name, description, price, category, is_available, is_featured)
values
  ('Thieb rouge poulet', 'Un grand classique de la cuisine sénégalaise : riz rouge parfumé mijoté dans une sauce tomate, légumes fondants et généreux morceau de poulet assaisonné.', 13.50, 'Plats', true, true),
  ('Thieb rouge poisson', 'Riz rouge à la sauce tomate, légumes fondants et poisson mijoté.', 13.50, 'Plats', true, true),
  ('Mafé au poulet', 'Recette traditionnelle à base d''une onctueuse sauce à l''arachide, servie avec du riz blanc et un poulet tendre aux épices africaines.', 13.50, 'Plats', true, true),
  ('Yassa', 'Poulet mariné puis mijoté dans une sauce aux oignons, citron et moutarde, accompagné de riz blanc. Une spécialité emblématique d''Afrique de l''Ouest.', 13.50, 'Plats', true, true),
  ('Attiéké poisson', 'Semoule de manioc, poisson frit, sauce aux oignons, tomates et concombre.', 13.50, 'Plats', true, false),
  ('Attiéké poulet', 'Semoule de manioc, poulet frit, sauce aux oignons, tomates et concombre.', 13.50, 'Plats', true, false),
  ('Riz sauce gombo', 'Riz blanc accompagné d''une sauce gombo traditionnelle, mijotée avec soin.', 13.50, 'Plats', true, false),
  ('Foutou banane sauce graine', 'Foutou de banane plantain accompagné d''une généreuse sauce graine.', 13.50, 'Plats', true, false);

-- ---------- Carte : Grillades ----------
insert into public.products (name, description, price, category, is_available, is_featured)
values
  ('Agneau grillé', 'Agneau grillé, tendre et généreusement assaisonné.', 15.00, 'Grillades', true, false),
  ('Brochette de poulet', 'Brochette de poulet grillée à la braise.', 2.50, 'Grillades', true, false);

-- ---------- Carte : Boissons ----------
insert into public.products (name, description, price, category, is_available, is_featured)
values
  ('Jus de bissap', 'Boisson maison rafraîchissante à base de fleurs d''hibiscus, légèrement sucrée et très parfumée.', 2.50, 'Boissons', true, false),
  ('Jus de gingembre', 'Boisson maison au gingembre, faite maison.', 2.50, 'Boissons', true, false);
