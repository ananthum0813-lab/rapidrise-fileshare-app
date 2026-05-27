import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { register, clearError } from '@/store/authSlice'
import {
  emailRules, passwordRules,
  firstNameRules, lastNameRules, dateOfBirthRules,
} from '@/utils/validators'
import ThemeToggle from '@/components/ui/ThemeToggle'

export default function Register() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading, error, isAuthenticated } = useSelector((s) => s.auth)
  const [showPassword, setShowPassword]        = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register: field, handleSubmit, watch, setError,
    formState: { errors },
  } = useForm({ mode: 'onTouched' })

  const password = watch('password')

  useEffect(() => { dispatch(clearError()) }, [dispatch])
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  const onSubmit = async (formData) => {
    const result = await dispatch(register(formData))
    if (register.rejected.match(result)) {
      const fieldErrors = result.payload?.errors
      if (fieldErrors && typeof fieldErrors === 'object') {
        Object.entries(fieldErrors).forEach(([key, msgs]) => {
          if (key !== 'non_field_errors') {
            setError(key, {
              type: 'server',
              message: Array.isArray(msgs) ? msgs[0] : String(msgs),
            })
          }
        })
      }
      return
    }
    navigate('/login', {
      replace: true,
      state: { successMessage: 'Account created! Please sign in.' },
    })
  }

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-[#0d1117]">

      {/* ── Left panel ───────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] h-full relative overflow-hidden flex-col justify-between py-8 px-12">

        {/* backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-blue-50 to-violet-50 dark:from-[#0d1117] dark:via-[#0f1a2e] dark:to-[#0d1117]" />
        <div className="absolute inset-0 opacity-60 dark:opacity-30" style={{
          backgroundImage: `radial-gradient(circle at 25% 20%, #3b82f618 0%, transparent 50%),
                            radial-gradient(circle at 80% 75%, #7c3aed12 0%, transparent 50%)`,
        }} />
        <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.04]" style={{
          backgroundImage: `linear-gradient(#3b82f6 1px, transparent 1px),
                            linear-gradient(90deg, #3b82f6 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full opacity-[0.06] dark:opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
        />

        {/* brand */}
        <div className="relative z-10 flex items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <i className="fas fa-cloud text-white text-sm" />
            </div>
            <span className="text-gray-900 dark:text-white font-semibold text-lg tracking-tight">FileShare</span>
          </div>
        </div>

        {/* hero content */}
        <div className="relative z-10 flex flex-col gap-8">
          <div className="space-y-2">
            {[
              { icon: 'fa-lock',  color: '#3b82f6', title: 'End-to-end encrypted',  desc: 'Your files never leave your control' },
              { icon: 'fa-link',  color: '#7c3aed', title: 'Expiring share links',   desc: 'Set it, share it, forget it'         },
              { icon: 'fa-users', color: '#0891b2', title: 'Team collaboration',      desc: 'Invite, manage, revoke access'       },
            ].map((f, i) => (
              <div key={f.title}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-gray-200/80 bg-white/70 backdrop-blur-sm shadow-sm dark:border-white/[0.06] dark:bg-white/[0.03] dark:shadow-none"
                style={{ transform: `translateX(${i * 10}px)`, opacity: 1 - i * 0.15 }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: f.color + '22' }}>
                  <i className={`fas ${f.icon} text-xs`} style={{ color: f.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{f.title}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{f.desc}</p>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              </div>
            ))}
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-snug tracking-tight">
                Join thousands who<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-500 dark:from-blue-400 dark:to-violet-400">
                  share smarter.
                </span>
              </h2>
              <p className="text-gray-700 dark:text-gray-400 text-sm mt-2 leading-relaxed">
                Free account in seconds. No credit card required.
              </p>
            </div>
            <div className="w-[140px] flex-shrink-0">
              <svg viewBox="0 0 300 222" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" aria-hidden="true">
                <defs>
                  <style>{`
                    .rg-bg{fill:#dbeafe;stroke:#3b82f6;stroke-width:1.5}.rg-bg-hi{stroke:#93c5fd;stroke-width:1;fill:none}
                    .rg-card{fill:#ffffff}.rg-card-b{stroke:#3b82f6;stroke-width:1.8}
                    .rg-head{fill:#3b82f6;fill-opacity:.45}.rg-body{fill:#3b82f6;fill-opacity:.28}
                    .rg-check{stroke:#10b981;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
                    .rg-check-bg{fill:#10b981;fill-opacity:.15;stroke:#10b981;stroke-width:1.2;stroke-opacity:.6}
                    .rg-ln{fill:#64748b;fill-opacity:.55}.rg-ln-s{fill:#64748b;fill-opacity:.3}
                    .rg-field{fill:#3b82f6;fill-opacity:.09;stroke:#3b82f6;stroke-width:.8;stroke-opacity:.35}
                    .rg-cursor{fill:#7c3aed;fill-opacity:.7}
                    .rg-dot-b{fill:#2563eb;fill-opacity:.4}.rg-dot-v{fill:#7c3aed;fill-opacity:.35}.rg-dot-c{fill:#0891b2;fill-opacity:.4}
                    .rg-arrow{stroke:#7c3aed;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
                    .rg-dash{stroke:#7c3aed;stroke-width:1.5;stroke-dasharray:4 3}
                    .rg-shield{fill:#7c3aed;fill-opacity:.14;stroke:#7c3aed;stroke-width:1.2;stroke-opacity:.5}
                    .rg-lock{fill:#7c3aed;fill-opacity:.55}
                    .dark .rg-bg{fill:rgba(59,130,246,.12);stroke:rgba(59,130,246,.4)}
                    .dark .rg-card{fill:rgba(255,255,255,.06)}
                    .dark .rg-head{fill-opacity:.35}.dark .rg-body{fill-opacity:.2}
                    .dark .rg-ln{fill:rgba(148,163,184,.45)}.dark .rg-ln-s{fill:rgba(148,163,184,.2)}
                    .dark .rg-field{fill-opacity:.07;stroke-opacity:.25}
                    .dark .rg-shield{fill-opacity:.1;stroke-opacity:.35}
                  `}</style>
                  <linearGradient id="rg-btn-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#7c3aed"/>
                  </linearGradient>
                </defs>
                <circle className="rg-bg" cx="150" cy="42" r="30"/>
                <path className="rg-bg-hi" d="M128 42 C128 28 138 20 150 20 C162 20 172 28 172 42"/>
                <circle className="rg-head" cx="150" cy="34" r="9"/>
                <ellipse className="rg-body" cx="150" cy="56" rx="14" ry="9"/>
                <line className="rg-dash" x1="150" y1="73" x2="150" y2="96"/>
                <path className="rg-arrow" d="M144 88 L150 95 L156 88"/>
                <rect className="rg-card rg-card-b" x="56" y="98" width="188" height="110" rx="11"/>
                <rect className="rg-field" x="66" y="110" width="78" height="12" rx="3"/>
                <rect className="rg-field" x="154" y="110" width="78" height="12" rx="3"/>
                <rect className="rg-cursor" x="69" y="114" width="1.5" height="5" rx="0.5"/>
                <rect className="rg-field" x="66" y="128" width="166" height="12" rx="3"/>
                <rect className="rg-ln-s" x="70" y="132" width="60" height="3" rx="1.5"/>
                <rect className="rg-field" x="66" y="146" width="166" height="12" rx="3"/>
                {[0,1,2,3,4,5].map(i => <circle key={i} className="rg-ln" cx={72 + i * 9} cy="152" r="1.8"/>)}
                <rect rx="5" x="66" y="164" width="166" height="16" fill="url(#rg-btn-grad)" opacity="0.9"/>
                <rect x="110" y="169" width="48" height="3" rx="1.5" fill="white" fillOpacity="0.7"/>
                <circle className="rg-check-bg" cx="244" cy="208" r="14"/>
                <path className="rg-check" d="M237 208 L242 213 L251 203"/>
                <path className="rg-shield" d="M72 192 C72 192 62 188 62 180 L62 170 L82 165 L102 170 L102 180 C102 188 82 197 72 192 Z" strokeLinejoin="round"/>
                <rect className="rg-lock" x="67" y="177" width="10" height="7" rx="1.5"/>
                <circle className="rg-dot-b" cx="28" cy="90" r="3"/>
                <circle className="rg-dot-v" cx="18" cy="110" r="2"/>
                <circle className="rg-dot-c" cx="272" cy="88" r="3"/>
                <circle className="rg-dot-b" cx="284" cy="112" r="2"/>
              </svg>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-[11px] text-gray-400 dark:text-gray-600">
          © {new Date().getFullYear()} FileShare · All rights reserved
        </p>
      </div>

      {/* ── Right panel ──────────────────────────────────────────────────────
          Key layout: h-full overflow-y-auto so the panel fills the viewport
          but scrolls internally if validation errors push content taller.
          ThemeToggle is sticky/absolute at top-right so it never moves.
      ────────────────────────────────────────────────────────────────────── */}
     <div className="flex-1 h-full overflow-y-auto relative bg-white dark:bg-[#0f1623]">

  {/* panel bg layers */}
  <div className="absolute inset-0 opacity-30 dark:opacity-20 pointer-events-none"
    style={{ backgroundImage: `radial-gradient(circle at 80% 10%, #3b82f610 0%, transparent 45%)` }}
  />
        <div className="hidden lg:block absolute left-0 top-8 bottom-8 w-px bg-gradient-to-b from-transparent via-gray-200 dark:via-white/[0.06] to-transparent pointer-events-none" />

        {/* ThemeToggle — sticky top-right, always in view even when scrolling */}
        <div className="sticky top-0 z-30 flex justify-end px-5 pt-4 pb-0 pointer-events-none">
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </div>

        {/* scrollable form content — negative margin to pull it up under the toggle bar */}
        <div className="relative z-10 flex flex-col items-center px-6 sm:px-10 pb-8 -mt-2">
          <div className="w-full max-w-sm">

            {/* mobile brand */}
            <div className="flex lg:hidden items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-md shadow-blue-500/25">
                <i className="fas fa-cloud text-white text-xs" />
              </div>
              <span className="text-gray-900 dark:text-white font-semibold tracking-tight">FileShare</span>
            </div>

            {/* heading */}
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Create your account</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Start sharing files securely in minutes.</p>
            </div>

            {/* error alert */}
            {error && (
              <div className="mb-3 flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm
                              bg-red-50 border border-red-200 text-red-600
                              dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
                <i className="fas fa-circle-exclamation flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* ── Form ── */}
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">

              {/* name row */}
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="First name" required error={errors.first_name?.message}>
                  <input
                    type="text" placeholder="Jane" autoComplete="given-name"
                    {...field('first_name', firstNameRules)}
                    className={inputCls(errors.first_name)}
                  />
                </FieldGroup>
                <FieldGroup label="Last name" required error={errors.last_name?.message}>
                  <input
                    type="text" placeholder="Doe" autoComplete="family-name"
                    {...field('last_name', lastNameRules)}
                    className={inputCls(errors.last_name)}
                  />
                </FieldGroup>
              </div>

              {/* email */}
              <FieldGroup label="Email address" required error={errors.email?.message}>
                <div className="relative">
                  <IconLeft icon="fa-envelope" />
                  <input
                    type="email" placeholder="jane@example.com" autoComplete="email"
                    {...field('email', emailRules)}
                    className={`${inputCls(errors.email)} pl-9`}
                  />
                </div>
              </FieldGroup>

              {/* date of birth */}
              <FieldGroup label="Date of birth" required error={errors.date_of_birth?.message}>
                <div className="relative">
                  <IconLeft icon="fa-calendar" />
                  <input
                    type="date" autoComplete="bday"
                    {...field('date_of_birth', dateOfBirthRules)}
                    className={`${inputCls(errors.date_of_birth)} pl-9`}
                  />
                </div>
              </FieldGroup>

              {/* password */}
              <FieldGroup
                label="Password" required
                error={errors.password?.message}
                hint={!errors.password ? 'Letter, number & special character.' : undefined}
              >
                <div className="relative">
                  <IconLeft icon="fa-lock" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 chars with number & symbol"
                    autoComplete="new-password"
                    {...field('password', passwordRules)}
                    className={`${inputCls(errors.password)} pl-9 pr-10`}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`} />
                  </button>
                </div>
              </FieldGroup>

              {/* confirm password */}
              <FieldGroup label="Confirm password" required error={errors.confirm_password?.message}>
                <div className="relative">
                  <IconLeft icon="fa-lock" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    {...field('confirm_password', {
                      required: 'Please confirm your password.',
                      validate: (v) => v === password || 'Passwords do not match.',
                    })}
                    className={`${inputCls(errors.confirm_password)} pl-9 pr-10`}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors focus:outline-none"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                    <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`} />
                  </button>
                </div>
              </FieldGroup>

              {/* submit */}
              <button
                type="submit" disabled={loading}
                className="w-full mt-1 py-2.5 rounded-xl text-sm font-bold tracking-wide
                           bg-gradient-to-r from-blue-500 to-violet-500
                           hover:from-blue-400 hover:to-violet-400
                           text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35
                           transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2.5"
              >
                {loading
                  ? <><i className="fas fa-circle-notch fa-spin text-xs" />Creating account…</>
                  : <><i className="fas fa-user-plus text-xs" />Create account</>
                }
              </button>
            </form>

            {/* divider */}
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.06]" />
              <span className="text-[11px] font-medium tracking-wider text-gray-400 dark:text-gray-600">HAVE AN ACCOUNT?</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.06]" />
            </div>

            {/* sign in CTA */}
            <Link to="/login"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium
                         transition-all duration-200
                         border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 text-gray-700
                         dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06] dark:hover:border-white/[0.14] dark:text-gray-300"
            >
              <i className="fas fa-arrow-right-to-bracket text-xs text-blue-500 dark:text-blue-400" />
              Sign in instead
            </Link>

            {/* trust badges */}
            <div className="flex items-center justify-center gap-5 mt-3">
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
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function IconLeft({ icon }) {
  return (
    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
      <i className={`fas ${icon} text-xs`} />
    </div>
  )
}

function inputCls(fieldError) {
  return `w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all
    text-gray-900 placeholder-gray-400
    dark:text-gray-100 dark:placeholder-gray-600
    focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
    dark:focus:ring-blue-500/40 dark:focus:border-blue-500/60
    ${fieldError
      ? 'border border-red-400 bg-red-50 dark:border-red-500/50 dark:bg-red-500/5'
      : 'border border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-white/[0.08] dark:bg-white/[0.05] dark:hover:border-white/[0.14]'
    }`
}

function FieldGroup({ label, required, hint, error, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1.5">
          <i className="fas fa-circle-exclamation text-[10px]" />{error}
        </p>
      )}
    </div>
  )
}