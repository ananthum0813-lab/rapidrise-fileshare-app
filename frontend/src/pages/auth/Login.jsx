import { useEffect, useState } from 'react'
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

  // ── NEW: password visibility toggle ───────────────────────────────────
  const [showPassword, setShowPassword] = useState(false)

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

        {/* ── brand ── */}
        <div className="relative z-10 flex items-center pt-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <i className="fas fa-cloud text-white text-sm" />
            </div>
            <span className="text-gray-900 dark:text-white font-semibold text-lg tracking-tight">FileShare</span>
          </div>
        </div>

        {/* hero content */}
        <div className="relative z-10 flex flex-col gap-20">

          {/* ── file preview cards (compact) ── */}
          <div className="space-y-2">
            {[
              { icon: 'fa-file-pdf',   color: '#ef4444', name: 'Q4_Report_2025.pdf',        size: '2.4 MB',  shared: '3 recipients' },
              { icon: 'fa-file-image', color: '#7c3aed', name: 'Brand_Assets_v2.zip',        size: '18.7 MB', shared: 'Team link'    },
              { icon: 'fa-file-word',  color: '#3b82f6', name: 'Product_Roadmap_Final.docx', size: '540 KB',  shared: '1 recipient' },
            ].map((f, i) => (
              <div
                key={f.name}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl
                           border border-gray-200/80 bg-white/70 backdrop-blur-sm shadow-sm
                           dark:border-white/[0.06] dark:bg-white/[0.03] dark:shadow-none"
                style={{ transform: `translateX(${i * 10}px)`, opacity: 1 - i * 0.15 }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: f.color + '22' }}>
                  <i className={`fas ${f.icon} text-xs`} style={{ color: f.color }} />
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

          {/* ── text + illustration side by side ── */}
          <div className="flex items-end gap-3">

            {/* text */}
            <div className="flex-1 min-w-0">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white leading-snug tracking-tight">
                Your files, always
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-500 dark:from-blue-400 dark:to-violet-400">
                  within reach.
                </span>
              </h2>
              <p className="text-gray-700 dark:text-gray-400 text-sm mt-3 leading-relaxed">
                Upload once, access anywhere. Share with anyone using secure expiring links and full control over who sees what.
              </p>
            </div>

            {/* illustration — constrained so it fits beside the text */}
            <div className="w-[172px] flex-shrink-0">
              <svg
                viewBox="0 0 300 222"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full"
                aria-hidden="true"
              >
            <defs>
              <style>{`
                /* ── light mode (default) ── */
                .il-cloud        { fill:#dbeafe; stroke:#3b82f6; stroke-width:1.5; }
                .il-cloud-hi     { stroke:#93c5fd; stroke-width:1; fill:none; }
                .il-arrow        { stroke:#7c3aed; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
                .il-arrow-dash   { stroke:#7c3aed; stroke-width:1.5; stroke-dasharray:4 3; }
                .il-folder-tab   { fill:#1e40af; }
                .il-folder-body  { fill:#2563eb; }
                .il-folder-shine { fill:#ffffff; fill-opacity:0.14; }
                .il-folder-line  { fill:#ffffff; fill-opacity:0.35; }
                .il-folder-linem { fill:#ffffff; fill-opacity:0.22; }
                .il-share-dot    { fill:#ffffff; fill-opacity:0.75; }
                .il-share-line   { stroke:#ffffff; stroke-width:1.2; stroke-opacity:0.5; }
                .il-dash-r       { stroke:#dc2626; stroke-width:1.5; stroke-dasharray:4 3; stroke-opacity:0.7; }
                .il-dash-v       { stroke:#7c3aed; stroke-width:1.5; stroke-dasharray:4 3; stroke-opacity:0.7; }
                .il-dash-c       { stroke:#0891b2; stroke-width:1.5; stroke-dasharray:4 3; stroke-opacity:0.7; }
                .il-card         { fill:#ffffff; stroke-width:1.8; }
                .il-card-r       { stroke:#ef4444; }
                .il-card-v       { stroke:#7c3aed; }
                .il-card-c       { stroke:#06b6d4; }
                .il-fold-r       { fill:#ef4444; fill-opacity:0.2; stroke:#ef4444; stroke-width:1; stroke-opacity:0.7; }
                .il-fold-c       { fill:#06b6d4; fill-opacity:0.2; stroke:#06b6d4; stroke-width:1; stroke-opacity:0.7; }
                .il-badge-r      { fill:#ef4444; }
                .il-badge-c      { fill:#06b6d4; }
                .il-imgbox       { fill:#7c3aed; fill-opacity:0.12; stroke:#7c3aed; stroke-width:0.8; stroke-opacity:0.4; }
                .il-sun          { fill:#7c3aed; fill-opacity:0.35; }
                .il-hill         { fill:#7c3aed; fill-opacity:0.22; }
                .il-ln           { fill:#64748b; fill-opacity:0.55; }
                .il-dot-b        { fill:#2563eb; fill-opacity:0.4; }
                .il-dot-v        { fill:#7c3aed; fill-opacity:0.35; }
                .il-dot-c        { fill:#0891b2; fill-opacity:0.4; }

                /* ── dark mode ── */
                .dark .il-cloud        { fill:rgba(59,130,246,0.14); stroke:rgba(59,130,246,0.42); }
                .dark .il-cloud-hi     { stroke:rgba(59,130,246,0.22); }
                .dark .il-folder-tab   { fill:#1d4ed8; }
                .dark .il-folder-body  { fill:#3b82f6; }
                .dark .il-folder-shine { fill-opacity:0.1; }
                .dark .il-folder-line  { fill-opacity:0.22; }
                .dark .il-folder-linem { fill-opacity:0.14; }
                .dark .il-share-dot    { fill-opacity:0.5; }
                .dark .il-share-line   { stroke-opacity:0.3; }
                .dark .il-dash-r       { stroke-opacity:0.45; }
                .dark .il-dash-v       { stroke-opacity:0.45; }
                .dark .il-dash-c       { stroke-opacity:0.45; }
                .dark .il-card         { fill:rgba(255,255,255,0.07); }
                .dark .il-ln           { fill:rgba(148,163,184,0.45); }
                .dark .il-imgbox       { fill-opacity:0.1; stroke-opacity:0.28; }
                .dark .il-sun          { fill-opacity:0.28; }
                .dark .il-hill         { fill-opacity:0.15; }
                .dark .il-dot-b        { fill-opacity:0.22; }
                .dark .il-dot-v        { fill-opacity:0.18; }
                .dark .il-dot-c        { fill-opacity:0.22; }
              `}</style>
            </defs>

            {/* ── Cloud ──────────────────────────────────────────────────── */}
            <path className="il-cloud"
              d="M108 44 C108 31 117 22 130 23 C133 14 142 8 153 8 C166 8 175 17 176 28
                 C185 28 194 35 194 45 C194 55 186 62 176 62 L120 62
                 C112 62 108 54 108 44 Z"/>
            <path className="il-cloud-hi"
              d="M120 44 C120 37 126 32 133 33 C135 27 140 24 147 24
                 C154 24 159 29 160 35 C166 35 171 39 171 44"/>

            {/* ── Upload arrow ─────────────────────────────────────────── */}
            <line className="il-arrow-dash" x1="150" y1="64" x2="150" y2="95"/>
            <path className="il-arrow" d="M143 70 L150 63 L157 70"/>

            {/* ── Folder ───────────────────────────────────────────────── */}
            <rect className="il-folder-tab"  x="46"  y="128" width="76"  height="18" rx="6"/>
            <rect className="il-folder-body" x="26"  y="144" width="248" height="70" rx="11"/>
            <rect className="il-folder-shine" x="26"  y="144" width="248" height="14" rx="11"/>
            <rect className="il-folder-line"  x="44"  y="172" width="52" height="5"  rx="2.5"/>
            <rect className="il-folder-linem" x="44"  y="183" width="38" height="5"  rx="2.5"/>
            <rect className="il-folder-line"  x="104" y="172" width="60" height="5"  rx="2.5"/>
            <rect className="il-folder-linem" x="104" y="183" width="44" height="5"  rx="2.5"/>
            <circle className="il-share-dot" cx="246" cy="162" r="3.5"/>
            <circle className="il-share-dot" cx="261" cy="154" r="3.5"/>
            <circle className="il-share-dot" cx="261" cy="170" r="3.5"/>
            <line className="il-share-line" x1="249.5" y1="160" x2="257.5" y2="155.5"/>
            <line className="il-share-line" x1="249.5" y1="164" x2="257.5" y2="168.5"/>

            {/* ── Dashed drop lines ─────────────────────────────────────── */}
            <line className="il-dash-r" x1="76"  y1="116" x2="76"  y2="144"/>
            <line className="il-dash-v" x1="150" y1="105" x2="150" y2="128"/>
            <line className="il-dash-c" x1="224" y1="116" x2="224" y2="144"/>

            {/* ── FILE 1 — PDF (left, –13°) ────────────────────────────── */}
            <g transform="rotate(-13 76 86)">
              <rect className="il-card il-card-r" x="48" y="50" width="56" height="72" rx="7"/>
              <path className="il-fold-r" d="M90 50 L104 64 L90 64 Z"/>
              <path fill="none" stroke="#ef4444" strokeWidth="1" strokeOpacity="0.7" d="M90 50 L104 64"/>
              <rect className="il-badge-r" x="54" y="68" width="26" height="9" rx="2.5"/>
              <text x="67" y="76" textAnchor="middle" fontSize="5.5" fontWeight="700"
                    fill="white" fontFamily="system-ui, sans-serif">PDF</text>
              <rect className="il-ln" x="54" y="84"  width="34" height="3" rx="1.5"/>
              <rect className="il-ln" x="54" y="91"  width="26" height="3" rx="1.5"/>
              <rect className="il-ln" x="54" y="98"  width="38" height="3" rx="1.5"/>
              <rect className="il-ln" x="54" y="105" width="20" height="3" rx="1.5"/>
            </g>

            {/* ── FILE 2 — Image (center, upright) ─────────────────────── */}
            <g>
              <rect className="il-card il-card-v" x="122" y="33" width="56" height="72" rx="7"/>
              <rect className="il-imgbox" x="128" y="40" width="44" height="34" rx="4"/>
              <circle className="il-sun"  cx="138" cy="50" r="5"/>
              <path  className="il-hill"  d="M128 70 L138 56 L148 65 L158 52 L172 70 Z"/>
              <rect className="il-ln" x="128" y="82" width="38" height="3" rx="1.5"/>
              <rect className="il-ln" x="128" y="89" width="28" height="3" rx="1.5"/>
              <rect className="il-ln" x="128" y="96" width="34" height="3" rx="1.5"/>
            </g>

            {/* ── FILE 3 — Doc (right, +13°) ───────────────────────────── */}
            <g transform="rotate(13 224 86)">
              <rect className="il-card il-card-c" x="196" y="50" width="56" height="72" rx="7"/>
              <path className="il-fold-c" d="M238 50 L252 64 L238 64 Z"/>
              <path fill="none" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.7" d="M238 50 L252 64"/>
              <rect className="il-badge-c" x="202" y="68" width="28" height="9" rx="2.5"/>
              <text x="216" y="76" textAnchor="middle" fontSize="5.5" fontWeight="700"
                    fill="white" fontFamily="system-ui, sans-serif">DOC</text>
              <rect className="il-ln" x="202" y="84"  width="36" height="3" rx="1.5"/>
              <rect className="il-ln" x="202" y="91"  width="26" height="3" rx="1.5"/>
              <rect className="il-ln" x="202" y="98"  width="34" height="3" rx="1.5"/>
              <rect className="il-ln" x="202" y="105" width="18" height="3" rx="1.5"/>
              <rect className="il-ln" x="202" y="112" width="30" height="3" rx="1.5"/>
            </g>

            {/* ── Decorative orbit dots ─────────────────────────────────── */}
            <circle className="il-dot-b" cx="28"  cy="90"  r="3"/>
            <circle className="il-dot-v" cx="18"  cy="110" r="2"/>
            <circle className="il-dot-c" cx="272" cy="88"  r="3"/>
            <circle className="il-dot-b" cx="284" cy="112" r="2"/>
          </svg>
            </div>{/* end illustration wrapper */}
          </div>{/* end text + illustration row */}
        </div>{/* end hero content */}

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
            <div className="flex lg:hidden items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-md shadow-blue-500/25">
                <i className="fas fa-cloud text-white text-xs" />
              </div>
              <span className="text-gray-900 dark:text-white font-semibold tracking-tight">FileShare</span>
            </div>
            <div className="hidden lg:block" />
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
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  autoComplete="current-password"
                  {...field('password', { required: 'Password is required.' })}
                  className={`w-full pl-9 pr-10 py-3 rounded-xl text-sm outline-none transition-all
                    text-gray-900 placeholder-gray-400
                    dark:text-gray-100 dark:placeholder-gray-600
                    focus:ring-2 focus:ring-blue-500/30  focus:border-blue-500
                    dark:focus:ring-blue-500/40 dark:focus:border-blue-500/60
                    ${errors.password
                      ? 'border border-red-400 bg-red-50 dark:border-red-500/50 dark:bg-red-500/5'
                      : 'border border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-white/[0.08] dark:bg-white/[0.05] dark:hover:border-white/[0.14]'
                    }`}
                />
                {/* ── NEW: eye toggle button ─────────────────────────────── */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2
                             text-gray-400 hover:text-gray-600
                             dark:text-gray-500 dark:hover:text-gray-300
                             transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`} />
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1.5">
                  <i className="fas fa-circle-exclamation text-[10px]" />{errors.password.message}
                </p>
              )}
            </div>

            {/* submit */}
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