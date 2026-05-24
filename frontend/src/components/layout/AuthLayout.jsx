import { Link } from 'react-router-dom'
import ThemeToggle from '@/components/ui/ThemeToggle'

const Logo = () => (
  <div className="flex items-center gap-2.5">
    <div className="brand-chip w-8 h-8 flex items-center justify-center">
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    </div>
    <span className="font-display font-semibold text-gray-900 dark:text-gray-100 text-lg tracking-tight">
      FileShare
    </span>
  </div>
)

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col dark:dark-page-bg">
      <header className="auth-chrome">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link to="/" className="inline-block">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md">
          <div className="mb-8 animate-fade-up">
            <h1 className="font-display text-2xl sm:text-[1.625rem] font-semibold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{subtitle}</p>
            )}
          </div>

          <div className="card p-7 sm:p-8 animate-fade-up delay-1">
            {children}
          </div>
        </div>
      </main>

      <footer className="text-center py-5 text-xs text-gray-400 dark:text-gray-500">
        © {new Date().getFullYear()} FileShare. All rights reserved.
      </footer>
    </div>
  )
}
