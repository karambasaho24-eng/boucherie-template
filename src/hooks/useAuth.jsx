import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getCurrentProfile } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function refreshProfile() {
    try {
      const p = await getCurrentProfile()
      setProfile(p)
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => {
    refreshProfile().finally(() => setLoading(false))

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      refreshProfile()
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
