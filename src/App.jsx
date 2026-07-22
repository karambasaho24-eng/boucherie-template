import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { CartProvider } from './hooks/useCart'
import { AuthProvider } from './hooks/useAuth'
import { fetchSiteConfig } from './lib/api'
import { supabase } from './lib/supabaseClient'

import Navbar from './components/Navbar'
import Footer from './components/Footer'
import WhatsAppButton from './components/WhatsAppButton'
import ProtectedRoute from './components/ProtectedRoute'
import CartToast from './components/CartToast'
import OrderReminder from './components/OrderReminder'

import Home from './pages/Home'
import Shop from './pages/Shop'
import Product from './pages/Product'
import Cart from './pages/Cart'
import OrderStatus from './pages/OrderStatus'
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'

function PublicLayout({ config }) {
  return (
    <>
      <OrderReminder />
      <Navbar siteTitle={config?.site_title} logoUrl={config?.logo_url} />
      <main className="main-content">
        <Outlet />
      </main>
      <Footer config={config} />
      <WhatsAppButton phone={config?.phone} />
      <CartToast />
    </>
  )
}

export default function App() {
  const [config, setConfig] = useState(null)

  useEffect(() => {
    fetchSiteConfig().then(setConfig).catch(console.error)
  }, [])

  useEffect(() => {
    if (!config?.theme_color || config.theme_color === 'original') {
      document.documentElement.removeAttribute('data-color-theme')
    } else {
      document.documentElement.setAttribute('data-color-theme', config.theme_color)
    }
  }, [config?.theme_color])

  useEffect(() => {
    if (!config?.favicon_url) return
    let link = document.querySelector("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = config.favicon_url
  }, [config?.favicon_url])

  useEffect(() => {
    if (config?.site_title) {
      document.title = config.site_title
    }
  }, [config?.site_title])

  useEffect(() => {
    const channel = supabase
      .channel('public-site-config-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'site_config', filter: 'id=eq.1' },
        (payload) => setConfig((prev) => ({ ...prev, ...payload.new }))
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            {/* Admin */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Site public — layout commun */}
            <Route element={<PublicLayout config={config} />}>
              <Route path="/" element={<Home config={config} />} />
              <Route path="/boutique" element={<Shop />} />
              <Route path="/produit/:id" element={<Product />} />
              <Route path="/panier" element={<Cart config={config} />} />
              <Route path="/commande/:id" element={<OrderStatus />} />
            </Route>
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
