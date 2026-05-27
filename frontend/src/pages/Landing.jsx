import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import ThemeToggle from '@/components/ui/ThemeToggle'
import BrandLogo from '@/components/ui/BrandLogo'

const features = [
  { icon: 'fa-shield-halved', title: 'Secure by default', desc: 'Protected sharing links, OTP flows, and safe upload checks.' },
  { icon: 'fa-folder-tree', title: 'Organized workspace', desc: 'Manage files with folders, favorites, storage analytics, and trash recovery.' },
  { icon: 'fa-bolt', title: 'Fast sharing', desc: 'Share single files or full ZIP bundles with expiry controls in seconds.' },
]

export default function Landing() {
  const { isAuthenticated } = useSelector((s) => s.auth)
  return (
    <div className="min-h-screen dark:dark-page-bg">
      <header className="auth-chrome">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-3">
          <BrandLogo />
          <div className="flex w-full sm:w-auto items-center justify-end gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn-primary btn-sm sm:btn-primary">Open app</Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost btn-sm sm:btn-ghost">Sign in</Link>
                <Link to="/register" className="btn-primary btn-sm sm:btn-primary">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
        <section className="widget-card-featured p-5 sm:p-8 lg:p-12">
          <p className="insight-label mb-4 text-[11px] sm:text-xs"><i className="fas fa-lock" aria-hidden /> Enterprise-grade secure sharing</p>
          <h1 className="text-2xl leading-tight sm:text-4xl lg:text-5xl font-display font-semibold tracking-tight text-gray-900 dark:text-gray-100 max-w-3xl">
            Share files confidently with a clean, fast, modern workflow.
          </h1>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-2xl">
            VShare helps teams upload, organize, and distribute files with robust security, elegant UI, and a responsive experience across devices.
          </p>
          <div className="mt-6 sm:mt-7 flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:gap-3">
            <Link to={isAuthenticated ? '/dashboard' : '/register'} className="btn-primary w-full sm:w-auto">
              <i className="fas fa-arrow-right" aria-hidden /> {isAuthenticated ? 'Go to dashboard' : 'Start free'}
            </Link>
            <Link to="/login" className="btn-secondary w-full sm:w-auto">Sign in</Link>
          </div>

          <div className="mt-5 sm:mt-7 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="widget-card p-3.5 sm:p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Availability</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">Mobile, tablet, desktop</p>
            </div>
            <div className="widget-card p-3.5 sm:p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Sharing model</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">Direct links + ZIP bundles</p>
            </div>
            <div className="widget-card p-3.5 sm:p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Security</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">Validation, OTP, expiry controls</p>
            </div>
          </div>
        </section>

        <section className="mt-5 sm:mt-8 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {features.map((f) => (
            <article key={f.title} className="widget-card p-4 sm:p-5">
              <div className="widget-icon mb-3"><i className={`fas ${f.icon}`} aria-hidden /></div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{f.title}</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{f.desc}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="px-4 py-8 text-center text-xs text-gray-400 dark:text-gray-500">
        © {new Date().getFullYear()} VShare · Secure file sharing for modern teams.
      </footer>
    </div>
  )
}
