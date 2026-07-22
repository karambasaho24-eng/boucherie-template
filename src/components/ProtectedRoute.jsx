import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children }) {
  const { profile, loading } = useAuth()

  if (loading) return <div className="container" style={{ padding: '40px 0' }}>Chargement...</div>

  if (!profile || !profile.is_admin) {
    return <Navigate to="/admin/login" replace />
  }

  return children
}
