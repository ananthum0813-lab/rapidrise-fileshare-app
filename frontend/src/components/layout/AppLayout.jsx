import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '@/store/authSlice'
import ThemeToggle from '@/components/ui/ThemeToggle'
import BrandLogo from '@/components/ui/BrandLogo'

const NAV_SECTIONS = [
  {
    title: 'General',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'fa-table-cells-large', tint: 'indigo', showStatus: true },
      { to: '/files', label: 'Files', icon: 'fa-folder-open', tint: 'violet' },
      { to: '/folders', label: 'Folders', icon: 'fa-folder-tree', tint: 'violet', end: true },
      { to: '/sharing', label: 'Shares', icon: 'fa-share-from-square', tint: 'sky' },
      { to: '/storage', label: 'Storage', icon: 'fa-hard-drive', tint: 'cyan' },
      { to: '/starred', label: 'Starred', icon: 'fa-star', tint: 'amber' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/trash', label: 'Trash', icon: 'fa-trash-can', tint: 'rose' },
      { to: '/settings', label: 'Settings', icon: 'fa-gear', tint: 'slate' },
    ],
  },
]

const navLinkClass = (isActive, to) =>
  `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
    isActive ? `nav-link-active${to === '/dashboard' ? ' nav-link-dashboard' : ''}` : 'nav-link-idle'
  }`

export default function AppLayout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user } = useSelector((s) => s.auth)
  const fileCount = useSelector((s) => s.files.storage?.file_count ?? 0)
  const usedBytes = useSelector((s) => s.files.storage?.used_bytes ?? 0)
  const totalBytes = useSelector((s) => s.files.storage?.total_bytes ?? 1)
  const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0
  const [signingOut, setSigningOut] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const renderNavItem = (to, label, icon, tint, showStatus, end, onNavigate) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => navLinkClass(isActive, to)}
    >
      {({ isActive }) => (
        <>
          <span className={`nav-item-icon icon-tint icon-tint-${tint}`}>
            <i className={`fas ${icon}`} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{label}</span>
            {showStatus && isActive && (
              <span className="nav-status-meta">
                Active · {fileCount} file{fileCount !== 1 ? 's' : ''}
              </span>
            )}
          </span>
        </>
      )}
    </NavLink>
  )

  const renderNavSections = (onNavigate) =>
    NAV_SECTIONS.map((section) => (
      <div key={section.title}>
        <p className="nav-section-header">{section.title}</p>
        <div className="space-y-0.5">
          {section.items.map(({ to, label, icon, tint, showStatus, end }) =>
            renderNavItem(to, label, icon, tint, showStatus, end, onNavigate)
          )}
        </div>
      </div>
    ))

  const handleLogout = async () => {
    setSigningOut(true)
    await dispatch(logout())
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell dark:dark-page-bg">
      <div className="mobile-chrome md:hidden">
        <div className="flex min-w-0 flex-shrink-0 items-center gap-2.5">
          <BrandLogo size="sm" />
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="chrome-icon-btn"
          >
            <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-lg`} aria-hidden />
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 top-14 z-20 bg-gray-900/25 backdrop-blur-[2px] md:hidden dark:bg-black/60"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {mobileMenuOpen && (
        <div className="mobile-menu-panel">
          {renderNavSections(() => setMobileMenuOpen(false))}
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2.5 rounded-xl border-t border-gray-100 px-3 py-3 text-sm font-medium text-gray-600 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900 dark:border-midnight-500 dark:text-gray-400 dark:hover:bg-midnight-700 dark:hover:text-red-400"
          >
            <i className="fas fa-arrow-right-from-bracket w-5 flex-shrink-0 text-base" aria-hidden />
            Logout
          </button>
        </div>
      )}

      <aside className="app-sidebar">
        <div className="mb-5 flex flex-shrink-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandLogo size="sm" />
          </div>
          <ThemeToggle />
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="space-y-0.5 overflow-y-auto pr-1">{renderNavSections()}</div>
        </nav>

        <div className="widget-card mt-5 flex-shrink-0 rounded-xl border border-gray-200 bg-white p-3.5 dark:border-midnight-500">
          <div className="mb-3 flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <img
                src={
                  user?.avatar
                  || `https://ui-avatars.com/api/?name=${user?.first_name || 'User'}&background=6366f1&color=e8ecf4`
                }
                className="h-9 w-9 rounded-lg border border-gray-200 object-cover dark:border-indigo-500/25"
                alt=""
              />
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-midnight-700" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium leading-tight text-gray-900 dark:text-gray-100">
                {user?.first_name || 'User'}
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 dark:border-midnight-500 dark:text-gray-300 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <i
              className={`fas ${signingOut ? 'fa-circle-notch fa-spin' : 'fa-arrow-right-from-bracket'}`}
              aria-hidden
            />
            {signingOut ? 'Wait...' : 'Sign Out'}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto flex flex-col">
        {usagePercent >= 95 && (
          <div className="flex-shrink-0 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-500/30 p-3 sm:px-6 flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center gap-3">
              <i className="fas fa-triangle-exclamation text-red-500 dark:text-red-400 text-lg"></i>
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300 leading-tight">Storage Almost Full</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  You have used {usagePercent.toFixed(1)}% of your storage. Please delete files or empty your trash.
                </p>
              </div>
            </div>
            <NavLink to="/trash" className="text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 hover:bg-red-200 dark:bg-red-800/50 dark:hover:bg-red-800 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ml-4">
              Empty Trash
            </NavLink>
          </div>
        )}
        <div className="page-container flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
