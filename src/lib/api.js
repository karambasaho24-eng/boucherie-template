import { supabase } from './supabaseClient'

// ---------- PRODUCTS ----------

export async function fetchProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchAvailableProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .neq('availability_mode', 'disabled')
    .order('created_at', { ascending: false })
  if (error) {
    const { data: fallback, error: e2 } = await supabase
      .from('products')
      .select('*')
      .eq('is_available', true)
      .order('created_at', { ascending: false })
    if (e2) throw e2
    return fallback
  }
  return data
}

export async function createProduct(product) {
  const { data, error } = await supabase.from('products').insert(product).select().single()
  if (error) throw error
  return data
}

export async function updateProduct(id, updates) {
  const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function uploadProductImage(file) {
  const ext = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('product-images').upload(fileName, file)
  if (error) throw error
  const { data } = supabase.storage.from('product-images').getPublicUrl(fileName)
  return data.publicUrl
}

// ---------- ORDERS ----------

export async function createOrder(order) {
  const { data, error } = await supabase.from('orders').insert(order).select().single()
  if (error) throw error
  return data
}

export async function fetchOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function updateOrderStatus(id, status, extraUpdates = {}) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status, ...extraUpdates })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchOrderById(id) {
  const { data, error } = await supabase.from('orders').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function updateOrderItems(id, { items, total_price }) {
  const { data, error } = await supabase
    .from('orders')
    .update({ items, total_price })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single()
  if (error) throw error
  return data
}

export async function cancelOwnOrder(id) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteOrder(id) {
  const { error } = await supabase.from('orders').delete().eq('id', id)
  if (error) throw error
}

// ---------- PAIEMENT STRIPE ----------

export async function createCheckoutSession(orderId) {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { order_id: orderId },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

// ---------- DASHBOARD (paramétré par période) ----------

export async function fetchDashboardStats(start, end) {
  const { data, error } = await supabase.rpc('dashboard_stats', { p_start: start, p_end: end })
  if (error) throw error
  return data?.[0] || null
}

export async function fetchTopProducts(start, end, limit = 10) {
  const { data, error } = await supabase.rpc('top_products', { p_start: start, p_end: end, p_limit: limit })
  if (error) throw error
  return data
}

export async function fetchRevenueByDay(start, end) {
  const { data, error } = await supabase.rpc('revenue_by_day', { p_start: start, p_end: end })
  if (error) throw error
  return data
}

export async function fetchTopCustomers(start, end, limit = 10) {
  const { data, error } = await supabase.rpc('top_customers', { p_start: start, p_end: end, p_limit: limit })
  if (error) throw error
  return data
}

export async function fetchRevenueByCategory(start, end) {
  const { data, error } = await supabase.rpc('revenue_by_category', { p_start: start, p_end: end })
  if (error) throw error
  return data
}

export async function fetchOrdersByWeekday(start, end) {
  const { data, error } = await supabase.rpc('orders_by_weekday', { p_start: start, p_end: end })
  if (error) throw error
  return data
}

export async function fetchOrdersByHour(start, end) {
  const { data, error } = await supabase.rpc('orders_by_hour', { p_start: start, p_end: end })
  if (error) throw error
  return data
}

// ---------- SNAPSHOTS DE PERFORMANCE ----------

export async function saveSnapshot({ title, description, periodStart, periodEnd, data }) {
  const { data: row, error } = await supabase
    .from('dashboard_snapshots')
    .insert({
      title,
      description: description || null,
      period_start: periodStart,
      period_end: periodEnd,
      data,
    })
    .select()
    .single()
  if (error) throw error
  return row
}

export async function fetchSnapshots() {
  const { data, error } = await supabase
    .from('dashboard_snapshots')
    .select('id, title, description, period_start, period_end, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchSnapshotById(id) {
  const { data, error } = await supabase
    .from('dashboard_snapshots')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function deleteSnapshot(id) {
  const { error } = await supabase.from('dashboard_snapshots').delete().eq('id', id)
  if (error) throw error
}

// ---------- SITE CONFIG ----------

export async function fetchSiteConfig() {
  const { data, error } = await supabase.from('site_config').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

export async function updateSiteConfig(updates) {
  const { data, error } = await supabase.from('site_config').update(updates).eq('id', 1).select().single()
  if (error) throw error
  return data
}

export async function uploadSiteImage(file) {
  const ext = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('site-images').upload(fileName, file)
  if (error) throw error
  const { data } = supabase.storage.from('site-images').getPublicUrl(fileName)
  return data.publicUrl
}

// ---------- AUTH ----------

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentProfile() {
  const { data: sessionData } = await supabase.auth.getSession()
  const user = sessionData?.session?.user
  if (!user) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (error) throw error
  return { ...data, email: user.email }
}
