import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'react-hot-toast'
import { login, clearError } from '@/store/authSlice'
import { emailRules } from '@/utils/validators'
import ThemeToggle from '@/components/ui/ThemeToggle'

export default function Login() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { loading, error, isAuthenticated } = useSelector((s) => s.auth)

  const [showPassword, setShowPassword] = useState(false)

  const successMessage = location.state?.successMessage || null
  const from           = location.state?.from?.pathname || '/dashboard'

  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm({ mode: 'onTouched' })

  useEffect(() => { dispatch(clearError()) }, [dispatch])

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true })
  }, [isAuthenticated, navigate, from])

  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage, { id: 'login-success' })
      window.history.replaceState({}, document.title)
    }
  }, [successMessage])

  useEffect(() => {
    if (error) toast.error(error, { id: 'login-error' })
  }, [error])



  const onSubmit = async (formData) => {
    const result = await dispatch(login(formData))
    if (login.fulfilled.match(result)) navigate(from, { replace: true })
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg-page)', backgroundImage: 'var(--bg-page-gradient)', backgroundAttachment: 'fixed' }}>

      {/* ── Left Panel ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-8">

        {/* Base background — matches --bg-sidebar / --surface-sidebar */}
        <div
          className="absolute inset-0"
          style={{ background: 'var(--surface-sidebar)', backgroundColor: 'var(--bg-sidebar)' }}
        />

        {/* Subtle top radial — same as --bg-page-gradient but toned down */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 100% 50% at 70% -5%, rgba(91,91,214,0.10) 0%, transparent 55%),
              radial-gradient(ellipse 60% 40% at 100% 10%, rgba(124,58,237,0.07) 0%, transparent 50%),
              radial-gradient(ellipse 50% 40% at 0% 85%, rgba(99,102,241,0.06) 0%, transparent 50%)
            `,
          }}
        />

        {/* Subtle grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(91,91,214,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(91,91,214,0.06) 1px, transparent 1px)
            `,
            backgroundSize: '52px 52px',
            opacity: 0.9,
          }}
        />

        {/* ── Brand header ── */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo chip — uses brand-chip class from your CSS */}
            <div
              className="brand-chip w-10 h-10 rounded-xl flex items-center justify-center"
            >
              <i className="fas fa-cloud-arrow-up text-white text-sm" />
            </div>
            <div>
              <h2
                className="text-[17px] font-bold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                VShare
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--accent-primary)' }}>
                Secure workspace
              </p>
            </div>
          </div>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 10px rgba(52,211,153,0.6)' }} />
        </div>

        {/* ── Center content ── */}
        <div className="relative z-10 flex flex-col justify-center flex-1 gap-5 py-6">

          {/* Hero heading */}
          <div>
            <h1
              className="text-[33px] font-extrabold leading-tight tracking-tight"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              Share files<br />
              <span style={{
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                smarter.
              </span>
            </h1>
            <p
              className="mt-3 text-[13px] leading-relaxed max-w-[280px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Modern workspace built for speed, security and seamless collaboration.
            </p>
          </div>

          {/* Feature cards */}
          <div className="flex flex-col gap-2.5">
            {[
              { icon: 'fa-shield-halved', title: 'Encrypted sharing',  sub: 'End-to-end protected'   },
              { icon: 'fa-link',          title: 'Secure links',        sub: 'Controlled access'      },
              { icon: 'fa-folder-tree',   title: 'Organized storage',   sub: 'Smart file management'  },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 backdrop-blur-sm"
                style={{
                  background: 'var(--surface-card)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {/* Icon chip — brand-chip gradient */}
                <div
                  className="brand-chip w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs"
                >
                  <i className={`fas ${item.icon} text-white text-xs`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {item.title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {item.sub}
                  </p>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
              </div>
            ))}
          </div>

          {/* Stats row */}
      <div className="flex gap-2.5">
  {[
    { value: '1GB',     label: 'Per User', icon: 'fa-hard-drive' },
    { value: 'Instant', label: 'Sharing',  icon: 'fa-share-nodes' },
    { value: 'Secure',  label: 'Storage',  icon: 'fa-shield-halved' },
  ].map((s) => (
    <div
      key={s.label}
      className="flex-1 rounded-xl py-3 px-3 text-center"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        className="w-9 h-9 mx-auto mb-2 rounded-lg flex items-center justify-center"
        style={{
          background: 'rgba(124, 58, 237, 0.12)',
          color: '#7c3aed',
        }}
      >
        <i className={`fas ${s.icon} text-sm`} />
      </div>

      <div
        className="text-[17px] font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        {s.value}
      </div>

      <div
        className="text-[10px] font-medium mt-0.5 tracking-wide uppercase"
        style={{ color: 'var(--text-muted)' }}
      >
        {s.label}
      </div>
    </div>
  ))}
</div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} VShare · All rights reserved
        </p>
      </div>

      {/* ── Right Panel ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">

        {/* White/dark surface background */}
        <div
          className="absolute inset-0"
          style={{ background: 'var(--bg-surface)', backgroundColor: 'var(--bg-surface)' }}
        />

        {/* Top accent bar — uses --accent-primary → --accent-secondary */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary), var(--accent-highlight))' }}
        />

        {/* Subtle radial accent */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(ellipse 60% 40% at 90% 5%, rgba(91,91,214,0.07) 0%, transparent 55%)' }}
        />

        {/* Vertical divider (desktop) */}
        <div
          className="hidden lg:block absolute left-0 top-8 bottom-8 w-px"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--border-default), transparent)' }}
        />

        <div className="relative z-10 w-full max-w-sm">

          {/* Top bar: mobile logo + ThemeToggle */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex lg:hidden items-center gap-2.5">
              <div className="brand-chip w-8 h-8 rounded-xl flex items-center justify-center">
                <i className="fas fa-cloud-arrow-up text-white text-xs" />
              </div>
              <span className="font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>VShare</span>
            </div>
            <div className="hidden lg:block" />
            <ThemeToggle />
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1
              className="text-[22px] font-extrabold tracking-tight"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              Welcome back
            </h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Sign in to your VShare account to continue.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label
                className="block text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                Email address
              </label>
              <div className="relative">
                <div
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <i className="fas fa-envelope text-xs" />
                </div>
                <input
                  type="email"
                  placeholder="jane@example.com"
                  autoComplete="email"
                  {...field('email', emailRules)}
                  className={`field w-full pl-9 pr-4 ${
                    errors.email ? 'field-error' : ''
                  }`}
                  style={errors.email ? {
                    borderColor: 'var(--color-danger-border)',
                    backgroundColor: 'var(--color-danger-bg)',
                  } : {}}
                />
              </div>
              {errors.email && (
                <p className="field-msg flex items-center gap-1.5">
                  <i className="fas fa-circle-exclamation text-[10px]" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  className="block text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="widget-link text-[12px]"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <i className="fas fa-lock text-xs" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  autoComplete="current-password"
                  {...field('password', { required: 'Password is required.' })}
                  className={`field w-full pl-9 pr-10 ${
                    errors.password ? 'field-error' : ''
                  }`}
                  style={errors.password ? {
                    borderColor: 'var(--color-danger-border)',
                    backgroundColor: 'var(--color-danger-bg)',
                  } : {}}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors focus:outline-none"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`} />
                </button>
              </div>
              {errors.password && (
                <p className="field-msg flex items-center gap-1.5">
                  <i className="fas fa-circle-exclamation text-[10px]" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit — btn-primary uses your exact CSS gradient + shadow */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 py-3 rounded-xl text-[14px] font-bold tracking-wide
                         flex items-center justify-center gap-2.5"
            >
              {loading ? (
                <>
                  <i className="fas fa-circle-notch fa-spin text-xs" />
                  Signing in…
                </>
              ) : (
                <>
                  <i className="fas fa-arrow-right-to-bracket text-xs" />
                  Sign in
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
            <span
              className="text-[10px] font-semibold tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              NEW HERE?
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
          </div>

          {/* Register CTA — btn-secondary style with accent tint */}
          <Link
            to="/register"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[13.5px] font-medium
                       transition-all duration-200"
            style={{
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-muted)',
              color: 'var(--text-secondary)',
              boxShadow: 'var(--shadow-btn)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-hover)'
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)'
              e.currentTarget.style.backgroundColor = 'var(--bg-muted)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            <i
              className="fas fa-user-plus text-xs"
              style={{ color: 'var(--accent-primary)' }}
            />
            Create an account
          </Link>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-5 mt-6">
            {[
              { icon: 'fa-shield-halved', label: 'Encrypted' },
              { icon: 'fa-lock',          label: 'Private'   },
              { icon: 'fa-bolt',          label: 'Fast'      },
            ].map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                <i
                  className={`fas ${b.icon} text-[10px]`}
                  style={{ color: 'var(--accent-primary)' }}
                />
                <span className="text-[11px] font-medium">{b.label}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}