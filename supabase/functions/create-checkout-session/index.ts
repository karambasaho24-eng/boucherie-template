// ============================================================
// supabase/functions/create-checkout-session/index.ts
// Lit les clés Stripe depuis site_config (plus depuis les secrets)
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import Stripe from 'https://esm.sh/stripe@16?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { order_id } = await req.json()
    if (!order_id) return json({ error: 'order_id manquant' }, 400)

    const { data: config, error: configErr } = await supabase
      .from('site_config')
      .select('stripe_enabled, stripe_secret_key, stripe_mode')
      .eq('id', 1)
      .single()

    if (configErr) return json({ error: 'Configuration introuvable' }, 500)
    if (!config.stripe_enabled) return json({ error: 'Le paiement par carte est désactivé.' }, 403)

    const secretKey = config.stripe_secret_key?.trim()
    if (!secretKey) {
      return json({ error: 'Clé Stripe non configurée. Contactez le gérant.' }, 500)
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderErr || !order) return json({ error: 'Commande introuvable' }, 404)

    if (order.status === 'refused')      return json({ error: 'Cette commande a été refusée.' }, 400)
    if (order.status === 'cancelled')    return json({ error: 'Cette commande a été annulée.' }, 400)
    if (order.payment_status === 'paid') return json({ error: 'Cette commande est déjà payée.' }, 400)
    if (order.status !== 'confirmed')    return json({ error: 'La commande doit être confirmée avant paiement.' }, 400)

    if (order.stripe_session_id) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(order.stripe_session_id)
        if (existing.status === 'open' && existing.url) {
          return json({ url: existing.url })
        }
      } catch { /* session expirée, on en recrée une */ }
    }

    const { data: fullConfig } = await supabase
      .from('site_config')
      .select('site_url')
      .eq('id', 1)
      .single()

    const siteUrl = fullConfig?.site_url?.trim() || Deno.env.get('SITE_URL') || ''
    const items   = order.items || []

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: items.map((i: any) => ({
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(i.price * 100),
          product_data: { name: i.name },
        },
        quantity: i.qty,
      })),
      metadata: { order_id: order.id },
      success_url: `${siteUrl}/commande/${order.id}?paiement=succes`,
      cancel_url:  `${siteUrl}/commande/${order.id}?paiement=annule`,
    })

    await supabase
      .from('orders')
      .update({ stripe_session_id: session.id, payment_status: 'pending', payment_method: 'card' })
      .eq('id', order.id)

    return json({ url: session.url })

  } catch (err) {
    console.error(err)
    return json({ error: 'Erreur serveur lors de la création du paiement.' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
