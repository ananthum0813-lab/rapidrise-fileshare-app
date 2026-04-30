import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '@/store/authSlice'

const NAV = [
  {
    to: '/dashboard', label: 'Dashboard',
    icon: <i className="fas fa-home w-5"></i>,
  },
  {
    to: '/files', label: 'Files',
    icon: <i className="fas fa-folder w-5"></i>,
  },
  {
    to: '/sharing', label: 'Shares',
    icon: <i className="fas fa-share-nodes w-5"></i>,
  },
  {
    to: '/settings', label: 'Settings',
    icon: <i className="fas fa-cog w-5"></i>,
  },
]

export default function AppLayout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user } = useSelector((s) => s.auth)
  const [signingOut, setSigningOut] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    setSigningOut(true)
    await dispatch(logout())
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc] font-sans">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b-2 border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <i className="fas fa-cloud text-lg"></i>
          </div>
          <h1 className="text-xl font-bold text-slate-800">CloudShare</h1>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-500"
        >
          <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b-2 border-slate-200 px-6 py-4 space-y-2">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 p-3 rounded-xl font-medium transition-all
                ${isActive ? 'bg-[#eef2ff] text-[#4f46e5]' : 'text-gray-500 hover:text-indigo-600'}`
              }
            >
              {icon} {label}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 text-slate-600 font-medium border-t border-slate-100 mt-2"
          >
            <i className="fas fa-arrow-right-from-bracket"></i> Logout
          </button>
        </div>
      )}

      {/* Desktop Sidebar - Defined with border-r-2 */}
      <aside className="hidden md:flex w-64 bg-white border-r-2 border-slate-200 flex-col p-6 h-screen sticky top-0">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-sm">
            <i className="fas fa-cloud text-xl"></i>
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">CloudShare</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 p-3 transition-all font-bold rounded-xl
                ${isActive 
                  ? 'bg-indigo-50 text-indigo-600' 
                  : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Subtle vertical indicator bar for active state */}
                  {isActive && (
                    <div className="absolute left-[-24px] w-1.5 h-6 bg-indigo-600 rounded-r-full" />
                  )}
                  {icon} {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Profile Card - Defined with border-2 */}
        <div className="mt-auto bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <img 
                src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.first_name || 'User'}&background=6366f1&color=fff`} 
                className="w-10 h-10 rounded-xl object-cover border border-slate-200" 
                alt="User" 
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-black text-slate-800 truncate leading-tight">
                {user?.first_name || 'User'}
              </p>
              <p className="text-[10px] text-slate-500 font-bold truncate italic">
                {user?.email}
              </p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            disabled={signingOut}
            className="w-full bg-white border-2 border-slate-200 text-slate-700 py-2.5 rounded-xl text-[11px] font-black hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm uppercase tracking-wider"
          >
            <i className={`fas ${signingOut ? 'fa-circle-notch fa-spin' : 'fa-arrow-right-from-bracket'}`}></i> 
            {signingOut ? 'Wait...' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Main Content Area - Borderless for a modern feel */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}