import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { verifySession } from '@/store/authSlice'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'

// Auth Pages
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'

// App Pages
import Dashboard from '@/pages/Dashboard'
import Files from '@/pages/Files'
import Sharing from '@/pages/Sharing'
import Settings from '@/pages/Settings'
import Starred from '@/pages/Starred'   // ← ADD THIS
import Trash from '@/pages/Trash'       // ← ADD THIS
import NotFound from '@/pages/NotFound'

// Handles the root "/" — redirects based on auth state
function RootRedirect() {
  const { isAuthenticated, sessionChecked } = useSelector((s) => s.auth)
  if (!sessionChecked) return null // Wait for session check
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
}

// Inner component that runs session verification on mount
function AppRoutes() {
  const dispatch = useDispatch()
  const { accessToken, sessionChecked } = useSelector((s) => s.auth)

  useEffect(() => {
    // Only verify if there's a stored token — otherwise mark as checked immediately
    if (accessToken) {
      dispatch(verifySession())
    } else {
      // No token at all — mark session as checked (not authenticated)
      dispatch({ type: 'auth/verifySession/rejected', payload: 'No token' })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public auth pages */}
      <Route path="/login"           element={<Login />} />
      <Route path="/register"        element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password"  element={<ResetPassword />} />

      {/* Protected app pages */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/files"     element={<Files />} />
          <Route path="/sharing"   element={<Sharing />} />
          <Route path="/starred"   element={<Starred />} />  {/* ← ADD THIS */}
          <Route path="/trash"     element={<Trash />} />    {/* ← ADD THIS */}
          <Route path="/settings"  element={<Settings />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}