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
  const [showPassword,        setShowPassword]        = useState(false)
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
    <div
      className="min-h-screen flex"
      style={{ backgroundColor: 'var(--bg-page)', backgroundImage: 'var(--bg-page-gradient)', backgroundAttachment: 'fixed' }}
    >

      {/* ── Left Panel ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-8">

        {/* Base background — matches --surface-sidebar */}
        <div
          className="absolute inset-0"
          style={{ background: 'var(--surface-sidebar)', backgroundColor: 'var(--bg-sidebar)' }}
        />

        {/* Subtle radial accents */}
        <div
          className="absolute inset-0 pointer-events-none"
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
          className="absolute inset-0 pointer-events-none"
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
            <div className="brand-chip w-10 h-10 rounded-xl flex items-center justify-center">
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
          <div
            className="w-2.5 h-2.5 rounded-full bg-emerald-400"
            style={{ boxShadow: '0 0 10px rgba(52,211,153,0.6)' }}
          />
        </div>

        {/* ── Center content ── */}
        <div className="relative z-10 flex flex-col justify-center flex-1 gap-10 py-6">

                {/* Hero heading */}



     <div>
  <h1
    className="text-[33px] font-extrabold leading-tight tracking-tight"
    style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
  >
    Create your<br />
    <span
      style={{
        background:
          'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      secure workspace.
    </span>
  </h1>

  <p
    className="mt-3 text-[13px] leading-relaxed max-w-[280px]"
    style={{ color: 'var(--text-secondary)' }}
  >
    Upload, organize and share files with a fast and modern experience.
  </p>
</div>

          {/* Feature cards — no heading above, cards stand alone */}
          <div className="flex flex-col gap-3">
            {[
              {
    icon: 'fa-mobile-screen',
    title: 'Access anywhere',
    sub: 'Works on every device',
  },
              { icon: 'fa-link',           title: 'Expiring share links',   sub: 'Set it, share it, forget it'         },
              { icon: 'fa-cloud-arrow-up', title: 'Fast uploads',      sub: 'No storage limits on free plan'      },
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
                <div className="brand-chip w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0">
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

          {/* Stats row — icon + label only, no big numbers */}
          <div className="flex gap-2.5">
            {[
             { icon: 'fa-shield-halved', label: 'Protected', sub: 'Secure files' },
              { icon: 'fa-share-nodes', label: 'Easy Share', sub: 'Quick access' },
              { icon: 'fa-folder-tree', label: 'Organized', sub: 'Smart storage' },
            ].map((s) => (
              <div
                key={s.label}
                className="flex-1 rounded-xl py-3 px-3 flex flex-col items-center justify-center gap-1.5 text-center"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div
                  className="brand-chip w-8 h-8 rounded-xl flex items-center justify-center"
                >
                  <i className={`fas ${s.icon} text-white text-xs`} />
                </div>
                <div className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  {s.sub}
                </div>
                <div
                  className="text-[9px] font-semibold tracking-wide uppercase leading-tight"
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
      <div
        className="flex-1 flex flex-col relative"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        {/* Top accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px] z-10"
          style={{ background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary), var(--accent-highlight))' }}
        />

        {/* Subtle radial */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(ellipse 60% 40% at 90% 5%, rgba(91,91,214,0.07) 0%, transparent 55%)' }}
        />

        {/* Vertical divider (desktop) */}
        <div
          className="hidden lg:block absolute left-0 top-8 bottom-8 w-px pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--border-default), transparent)' }}
        />

        {/* ThemeToggle — sticky top-right */}
        <div className="sticky top-0 z-30 flex justify-between items-center px-5 pt-4 pb-0 pointer-events-none">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 pointer-events-auto">
            <div className="brand-chip w-8 h-8 rounded-xl flex items-center justify-center">
              <i className="fas fa-cloud-arrow-up text-white text-xs" />
            </div>
            <span className="font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>VShare</span>
          </div>
          <div className="hidden lg:block" />
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </div>

        {/* Scrollable form content */}
        <div className="relative z-10 flex flex-col items-center px-6 sm:px-10 pb-8 pt-4 overflow-y-auto flex-1">
          <div className="w-full max-w-sm">

            {/* Heading */}
            <div className="mb-5">
              <h1
                className="text-[22px] font-extrabold tracking-tight"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
              >
                Create your account
              </h1>
              <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
                Start sharing files securely in minutes.
              </p>
            </div>

            {/* Error alert */}
            {error && (
              <div
                className="mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl text-[13px]"
                style={{
                  background: 'var(--color-danger-bg)',
                  border: '1px solid var(--color-danger-border)',
                  color: 'var(--color-danger)',
                }}
              >
                <i className="fas fa-circle-exclamation flex-shrink-0 text-xs" />
                <span>{error}</span>
              </div>
            )}

            {/* ── Form ── */}
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">

              {/* Name row */}
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

              {/* Email */}
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

              {/* Date of birth */}
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

              {/* Password */}
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
                  <EyeToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
                </div>
              </FieldGroup>

              {/* Confirm password */}
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
                  <EyeToggle show={showConfirmPassword} onToggle={() => setShowConfirmPassword(v => !v)} />
                </div>
              </FieldGroup>

              {/* Submit — btn-primary from design system */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-1 py-3 rounded-xl text-[14px] font-bold tracking-wide
                           flex items-center justify-center gap-2.5"
              >
                {loading ? (
                  <><i className="fas fa-circle-notch fa-spin text-xs" />Creating account…</>
                ) : (
                  <><i className="fas fa-user-plus text-xs" />Create account</>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
              <span
                className="text-[10px] font-semibold tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                HAVE AN ACCOUNT?
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
            </div>

            {/* Sign in CTA */}
            <Link
              to="/login"
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
                className="fas fa-arrow-right-to-bracket text-xs"
                style={{ color: 'var(--accent-primary)' }}
              />
              Sign in instead
            </Link>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-5 mt-5">
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
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function IconLeft({ icon }) {
  return (
    <div
      className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
      style={{ color: 'var(--text-muted)' }}
    >
      <i className={`fas ${icon} text-xs`} />
    </div>
  )
}

function EyeToggle({ show, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors focus:outline-none"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      aria-label={show ? 'Hide password' : 'Show password'}
    >
      <i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'} text-xs`} />
    </button>
  )
}

function inputCls(fieldError) {
  return `field w-full px-4 py-2.5 ${fieldError ? 'field-error' : ''}`
}

function FieldGroup({ label, required, hint, error, children }) {
  return (
    <div className="space-y-1">
      <label
        className="block text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
        {required && (
          <span style={{ color: 'var(--color-danger)', marginLeft: '2px' }}>*</span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{hint}</p>
      )}
      {error && (
        <p className="field-msg flex items-center gap-1.5">
          <i className="fas fa-circle-exclamation text-[10px]" />
          {error}
        </p>
      )}
    </div>
  )
}