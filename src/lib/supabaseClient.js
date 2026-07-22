import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Ce message apparaît dans la console du SITE EN LIGNE (pas juste en local)
  // si les variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ne sont pas
  // correctement injectées au moment du build (ex : oubli sur Netlify, ou
  // déploiement non relancé après leur ajout).
  console.error(
    '[Supabase] Configuration manquante : VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY est vide. ' +
    'Sur Netlify : Site configuration > Environment variables, puis redéployer avec "Clear cache and deploy site".'
  )
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
