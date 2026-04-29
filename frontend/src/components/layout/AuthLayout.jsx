import { Link } from 'react-router-dom'

const Logo = () => (
  <div className="flex items-center gap-2.5">
    <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    </div>
    <span className="font-display font-semibold text-gray-900 text-lg tracking-tight">
      FileShare
    </span>
  </div>
)

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top nav */}
      <header className="px-6 py-4 border-b border-gray-100 bg-white">
        <Link to="/" className="inline-block">
          <Logo />
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Header text */}
          <div className="mb-8 animate-fade-up">
            <h1 className="font-display text-2xl font-semibold text-gray-900 mb-1.5">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-gray-500">{subtitle}</p>
            )}
          </div>

          {/* Card */}
          <div className="card p-8 animate-fade-up delay-1">
            {children}
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-xs text-gray-400">
        © {new Date().getFullYear()} FileShare. All rights reserved.
      </footer>
    </div>
  )
}