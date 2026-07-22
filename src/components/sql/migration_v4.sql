-- ============================================================
-- MIGRATION v4 — Le client peut consulter, modifier et annuler
-- sa propre commande tant qu'elle est encore "en attente"
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- Remarque importante :
-- La policy SELECT publique sur "orders" existe déjà depuis la migration v3
-- (nécessaire pour que insert().select() fonctionne après une commande).
-- Elle permet aussi techniquement à n'importe qui connaissant un id de
-- commande d'en consulter le détail. C'est un compromis assumé : il n'y a
-- pas de compte client, donc le lien (id de commande) joue le rôle de clé
-- d'accès. Les ids Supabase (UUID) ne sont pas devinables au hasard.

-- Nouvelle policy : autoriser la modification d'une commande par
-- n'importe quel visiteur, MAIS UNIQUEMENT si elle est encore "pending".
-- Dès que le statut passe à confirmed/preparing/ready/completed/cancelled,
-- cette policy ne matche plus l'ancienne ligne et la modification est refusée.

drop policy if exists "orders_public_update_while_pending" on public.orders;

create policy "orders_public_update_while_pending"
  on public.orders for update
  using (status = 'pending')
  with check (status in ('pending', 'cancelled'));

-- Explication :
-- - "using (status = 'pending')" : la ligne ciblée doit être actuellement en attente
-- - "with check (...)" : après modification, le nouveau statut ne peut être
--   que 'pending' (édition d'articles) ou 'cancelled' (annulation) — jamais
--   'confirmed', 'preparing', etc. Seul l'admin (policy orders_admin_update,
--   déjà existante) peut faire avancer une commande dans le vrai workflow.
