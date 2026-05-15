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
import Starred from '@/pages/Starred'
import Trash from '@/pages/Trash'
import NotFound from '@/pages/NotFound'
// Public Pages — TWO separate pages, one per use-case
import PublicSharePage    from '@/pages/PublicSharePage'    // view/download a shared file link
import PublicUploadPage   from '@/pages/PublicUploadPage'   // recipient uploads files via request link
import PublicZipSharePage from '@/pages/PublicZipSharePage' // view/download a shared ZIP link

function RootRedirect() {
  const { isAuthenticated, sessionChecked } = useSelector((s) => s.auth)
  if (!sessionChecked) return null
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
}

function AppRoutes() {
  const dispatch = useDispatch()
  const { accessToken, sessionChecked } = useSelector((s) => s.auth)

  useEffect(() => {
    if (accessToken) {
      dispatch(verifySession())
    } else {
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

      {/*
        Public share view — /share/:token
        Used when a file owner shares a file → recipient gets /share/<share_token>
        Calls GET /api/sharing/public/<token>/ to fetch file info + download
      */}
      <Route path="/share/:token" element={<PublicSharePage />} />

      {/*
        Public upload page — /shared/:token (legacy) and /request/upload/:token
        Used when a file request owner sends recipients an upload link.
        Calls GET /api/sharing/requests/upload/<token>/ to validate token.
      */}
      <Route path="/shared/:token"          element={<PublicUploadPage />} />
      <Route path="/request/upload/:token"  element={<PublicUploadPage />} />

      {/*
        Public ZIP share page — /zip-share/:token
        Used when a file owner shares a ZIP bundle → recipient gets /zip-share/<token>
        Calls GET /api/sharing/public/zip/<token>/ to fetch ZIP info + download
      */}
      <Route path="/zip-share/:token" element={<PublicZipSharePage />} />

      {/* Protected app pages */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/files"     element={<Files />} />
          <Route path="/sharing"   element={<Sharing />} />
          <Route path="/starred"   element={<Starred />} />
          <Route path="/trash"     element={<Trash />} />
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