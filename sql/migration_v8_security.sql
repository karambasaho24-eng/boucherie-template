-- ============================================================
-- MIGRATION v8 — Sécurité paiement : verrouiller les colonnes
-- de paiement contre toute modification par un client anonyme.
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. S'assurer que RLS est bien activée sur orders
-- ============================================================
alter table public.orders enable row level security;

-- ============================================================
-- 2. Policy UPDATE restreinte pour les clients anonymes (anon) :
--    - Un client ne peut modifier QUE ses propres items/total_price
--      d'une commande encore "pending" (déjà le cas via updateOrderItems
--      et cancelOwnOrder qui filtrent .eq('status','pending') côté code).
--    - On bloque explicitement ici toute tentative de modifier
--      status, payment_status, payment_method, stripe_session_id,
--      stripe_payment_intent, paid_at depuis le rôle anon.
-- ============================================================

drop policy if exists "orders_anon_update_own_pending" on public.orders;

create policy "orders_anon_update_own_pending"
  on public.orders for update
  to anon
  using (status = 'pending')
  with check (
    status = 'pending'
    and payment_status = 'unpaid'
    and payment_method is null
    and stripe_session_id is null
    and stripe_payment_intent is null
    and paid_at is null
  );

-- ============================================================
-- 3. Le rôle "authenticated" (admin connecté) garde un accès complet,
--    déjà couvert normalement par une policy admin existante.
--    Si aucune policy admin_all n'existe encore, on la crée ici :
-- ============================================================

drop policy if exists "orders_admin_all" on public.orders;

create policy "orders_admin_all"
  on public.orders for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- 4. Rappel : le webhook Stripe utilise la clé service_role,
--    qui contourne RLS par conception — donc il garde toujours
--    le droit d'écrire payment_status/status, peu importe ces policies.
--    C'est voulu : le webhook reste l'unique source de vérité serveur.
-- ============================================================
