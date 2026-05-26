import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { login, clearError } from '@/store/authSlice'
import { emailRules } from '@/utils/validators'
import ThemeToggle from '@/components/ui/ThemeToggle'

export default function Login() {
  const dispatch  = useDispatch()
  const navigate  = useNavigate()
  const location  = useLocation()
  const { loading, error, isAuthenticated } = useSelector((s) => s.auth)

  const successMessage = location.state?.successMessage || null
  const from           = location.state?.from?.pathname || '/dashboard'

  const { register: field, handleSubmit, formState: { errors } } = useForm({ mode: 'onTouched' })

  useEffect(() => { dispatch(clearError()) }, [dispatch])
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true })
  }, [isAuthenticated, navigate, from])

  const onSubmit = async (formData) => {
    const result = await dispatch(login(formData))
    if (login.fulfilled.match(result)) navigate(from, { replace: true })
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-[#0d1117]">

      {/* ── Left panel — branding ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-12">

        {/* backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-blue-50 to-violet-50 dark:from-[#0d1117] dark:via-[#0f1a2e] dark:to-[#0d1117]" />
        <div className="absolute inset-0 opacity-60 dark:opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 20%, #3b82f618 0%, transparent 50%),
                              radial-gradient(circle at 80% 75%, #7c3aed12 0%, transparent 50%)`,
          }}
        />
        <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(#3b82f6 1px, transparent 1px),
                              linear-gradient(90deg, #3b82f6 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full opacity-[0.06] dark:opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
        />

        {/* ── brand (no ThemeToggle here — single toggle lives on the right panel) ── */}
        <div className="relative z-10 flex items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <i className="fas fa-cloud text-white text-sm" />
            </div>
            <span className="text-gray-900 dark:text-white font-semibold text-lg tracking-tight">FileShare</span>
          </div>
        </div>

        {/* hero content */}
        <div className="relative z-10 space-y-8">
          {/* floating file preview cards */}
          <div className="space-y-3 mb-10">
            {[
              { icon: 'fa-file-pdf',   color: '#ef4444', name: 'Q4_Report_2025.pdf',        size: '2.4 MB',  shared: '3 recipients' },
              { icon: 'fa-file-image', color: '#7c3aed', name: 'Brand_Assets_v2.zip',        size: '18.7 MB', shared: 'Team link'    },
              { icon: 'fa-file-word',  color: '#3b82f6', name: 'Product_Roadmap_Final.docx', size: '540 KB',  shared: '1 recipient' },
            ].map((f, i) => (
              <div
                key={f.name}
                className="flex items-center gap-3 px-4 py-3 rounded-xl
                           border border-gray-200/80 bg-white/70 backdrop-blur-sm shadow-sm
                           dark:border-white/[0.06] dark:bg-white/[0.03] dark:shadow-none"
                style={{ transform: `translateX(${i * 12}px)`, opacity: 1 - i * 0.15 }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: f.color + '22' }}>
                  <i className={`fas ${f.icon} text-sm`} style={{ color: f.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{f.name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{f.size}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-gray-400">{f.shared}</span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white leading-snug tracking-tight">
              Secure file sharing,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-500 dark:from-blue-400 dark:to-violet-400">
                built for teams.
              </span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-3 leading-relaxed max-w-sm">
              Upload, organise, and share files with expiring links, folder access controls, and real-time storage insights.
            </p>
          </div>

          {/* stats */}
          <div className="flex items-center gap-6">
            {[
              { value: '256-bit', label: 'Encryption'  },
              { value: 'Auto',    label: 'Expiry links' },
              { value: '∞',       label: 'File types'  },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-base font-bold text-gray-900 dark:text-white">{s.value}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-[11px] text-gray-400 dark:text-gray-600">
          © {new Date().getFullYear()} FileShare · All rights reserved
        </p>
      </div>

      {/* ── Right panel — form ────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">

        <div className="absolute inset-0 bg-white dark:bg-[#0f1623]" />
        <div className="absolute inset-0 opacity-30 dark:opacity-20"
          style={{ backgroundImage: `radial-gradient(circle at 80% 10%, #3b82f610 0%, transparent 45%)` }}
        />
        {/* vertical divider */}
        <div className="hidden lg:block absolute left-0 top-8 bottom-8 w-px bg-gradient-to-b from-transparent via-gray-200 dark:via-white/[0.06] to-transparent" />

        <div className="relative z-10 w-full max-w-sm">

          {/* ── Top bar: logo (mobile only) + single ThemeToggle (always) ── */}
          <div className="flex items-center justify-between mb-8">
            {/* logo — visible only on mobile (desktop has it in the left panel) */}
            <div className="flex lg:hidden items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-md shadow-blue-500/25">
                <i className="fas fa-cloud text-white text-xs" />
              </div>
              <span className="text-gray-900 dark:text-white font-semibold tracking-tight">FileShare</span>
            </div>
            {/* invisible spacer on desktop so ThemeToggle stays right-aligned */}
            <div className="hidden lg:block" />
            {/* THE single ThemeToggle — always rendered here, always visible */}
            <ThemeToggle />
          </div>

          {/* heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Welcome back</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">Sign in to your FileShare account.</p>
          </div>

          {/* success alert */}
          {successMessage && (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl text-sm
                            bg-emerald-50 border border-emerald-200 text-emerald-700
                            dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400">
              <i className="fas fa-circle-check flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* error alert */}
          {error && (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl text-sm
                            bg-red-50 border border-red-200 text-red-600
                            dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
              <i className="fas fa-circle-exclamation flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

            {/* email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Email address
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                  <i className="fas fa-envelope text-xs" />
                </div>
                <input
                  type="email"
                  placeholder="jane@example.com"
                  autoComplete="email"
                  {...field('email', emailRules)}
                  className={`w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none transition-all
                    text-gray-900 placeholder-gray-400
                    dark:text-gray-100 dark:placeholder-gray-600
                    focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
                    dark:focus:ring-blue-500/40 dark:focus:border-blue-500/60
                    ${errors.email
                      ? 'border border-red-400 bg-red-50 dark:border-red-500/50 dark:bg-red-500/5'
                      : 'border border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-white/[0.08] dark:bg-white/[0.05] dark:hover:border-white/[0.14]'
                    }`}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1.5">
                  <i className="fas fa-circle-exclamation text-[10px]" />{errors.email.message}
                </p>
              )}
            </div>

            {/* password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                  <i className="fas fa-lock text-xs" />
                </div>
                <input
                  type="password"
                  placeholder="Your password"
                  autoComplete="current-password"
                  {...field('password', { required: 'Password is required.' })}
                  className={`w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none transition-all
                    text-gray-900 placeholder-gray-400
                    dark:text-gray-100 dark:placeholder-gray-600
                    focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
                    dark:focus:ring-blue-500/40 dark:focus:border-blue-500/60
                    ${errors.password
                      ? 'border border-red-400 bg-red-50 dark:border-red-500/50 dark:bg-red-500/5'
                      : 'border border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-white/[0.08] dark:bg-white/[0.05] dark:hover:border-white/[0.14]'
                    }`}
                />
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1.5">
                  <i className="fas fa-circle-exclamation text-[10px]" />{errors.password.message}
                </p>
              )}
            </div>

            {/* submit — blue dominant → violet accent */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl text-sm font-bold tracking-wide
                         bg-gradient-to-r from-blue-500 to-violet-500
                         hover:from-blue-400 hover:to-violet-400
                         text-white
                         shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35
                         transition-all duration-200
                         disabled:opacity-60 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2.5"
            >
              {loading
                ? <><i className="fas fa-circle-notch fa-spin text-xs" />Signing in…</>
                : <><i className="fas fa-arrow-right-to-bracket text-xs" />Sign in</>
              }
            </button>
          </form>

          {/* divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.06]" />
            <span className="text-[11px] font-medium tracking-wider text-gray-400 dark:text-gray-600">NEW HERE?</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.06]" />
          </div>

          {/* register CTA */}
          <Link
            to="/register"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium
                       transition-all duration-200
                       border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 text-gray-700
                       dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06] dark:hover:border-white/[0.14] dark:text-gray-300"
          >
            <i className="fas fa-user-plus text-xs text-blue-500 dark:text-blue-400" />
            Create an account
          </Link>

          {/* trust badges */}
          <div className="flex items-center justify-center gap-5 mt-8">
            {[
              { icon: 'fa-shield-halved', label: 'Encrypted' },
              { icon: 'fa-lock',          label: 'Private'   },
              { icon: 'fa-bolt',          label: 'Fast'      },
            ].map((b) => (
              <div key={b.label} className="flex items-center gap-1.5 text-gray-400 dark:text-gray-600">
                <i className={`fas ${b.icon} text-[10px]`} />
                <span className="text-[11px] font-medium">{b.label}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}