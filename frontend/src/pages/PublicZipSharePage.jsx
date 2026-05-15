/**
 * PublicZipSharePage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Route: /zip-share/:token   (no auth required)
 *
 * Page recipients see when a ZIP bundle has been shared with them.
 * Flow:
 *  1. Load → GET /api/sharing/public/zip/<token>/  to validate + fetch file list
 *  2. Show ZIP name, file list, expiry, message
 *  3. Download button → GET /api/sharing/public/zip/<token>/download/  (blob)
 *
 * Add this route to your App router:
 *   <Route path="/zip-share/:token" element={<PublicZipSharePage />} />
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPublicZipShareInfo, downloadPublicZipShare } from '@/api/sharingApi'

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function mimeIcon(mime) {
  if (!mime)                                                   return 'fa-file text-slate-400'
  if (mime.includes('pdf'))                                    return 'fa-file-pdf text-red-500'
  if (mime.includes('image'))                                  return 'fa-file-image text-blue-500'
  if (mime.includes('video'))                                  return 'fa-file-video text-purple-500'
  if (mime.includes('audio'))                                  return 'fa-file-audio text-pink-500'
  if (mime.includes('word') || mime.includes('document'))      return 'fa-file-word text-blue-600'
  if (mime.includes('spreadsheet') || mime.includes('excel') ||
      mime.includes('sheet'))                                  return 'fa-file-excel text-green-600'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'fa-file-powerpoint text-orange-500'
  if (mime.includes('zip') || mime.includes('archive') ||
      mime.includes('compressed'))                             return 'fa-file-zipper text-amber-500'
  if (mime.includes('text') || mime.includes('csv'))           return 'fa-file-lines text-gray-500'
  return 'fa-file text-slate-400'
}

// ─── Error screen ─────────────────────────────────────────────────────────────

function ErrorScreen({ type, message }) {
  const config = {
    expired:  { emoji: '⏰', title: 'Link Expired',         sub: 'This ZIP share link has expired and is no longer available.',    color: 'text-amber-600',  bg: 'from-amber-50 to-orange-50' },
    revoked:  { emoji: '🔒', title: 'Link Revoked',          sub: 'This share link has been revoked by the sender.',                color: 'text-slate-600',  bg: 'from-slate-50 to-gray-100'  },
    invalid:  { emoji: '🔗', title: 'Link Not Found',        sub: 'This share link is invalid or has been removed.',               color: 'text-slate-600',  bg: 'from-slate-50 to-gray-100'  },
    error:    { emoji: '⚠️', title: 'Something Went Wrong',  sub: message || 'An unexpected error occurred. Please try again.',   color: 'text-red-600',    bg: 'from-red-50 to-rose-50'     },
  }[type] || { emoji: '⚠️', title: 'Error', sub: message, color: 'text-red-600', bg: 'from-red-50 to-rose-50' }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${config.bg} flex items-center justify-center p-4`}>
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center border border-slate-100">
        <div className="text-6xl mb-5 select-none">{config.emoji}</div>
        <h2 className={`text-2xl font-bold mb-3 ${config.color}`}>{config.title}</h2>
        <p className="text-slate-500 text-sm leading-relaxed">{config.sub}</p>
      </div>
    </div>
  )
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto">
          <i className="fas fa-file-zipper text-2xl text-violet-500 animate-pulse"></i>
        </div>
        <p className="text-sm text-slate-500 font-medium">Validating share link…</p>
      </div>
    </div>
  )
}

// ─── File list item ───────────────────────────────────────────────────────────

function FileListItem({ file }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-1 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
        <i className={`fas ${mimeIcon(file.mime_type)} text-sm`}></i>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{file.original_name}</p>
        {file.mime_type && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            {file.mime_type.split('/')[1]?.toUpperCase() || file.mime_type}
          </p>
        )}
      </div>
      {file.file_size_display && (
        <span className="text-xs text-slate-400 font-medium flex-shrink-0">{file.file_size_display}</span>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PublicZipSharePage() {
  const { token } = useParams()

  const [loading,     setLoading]     = useState(true)
  const [info,        setInfo]        = useState(null)
  const [error,       setError]       = useState(null)    // { type, message }
  const [downloading, setDownloading] = useState(false)
  const [downloaded,  setDownloaded]  = useState(false)
  const [dlError,     setDlError]     = useState('')

  // ── Fetch ZIP share info ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await getPublicZipShareInfo(token)
        if (!cancelled) setInfo(data.data)
      } catch (err) {
        if (cancelled) return
        const httpStatus = err.response?.status
        const msg        = err.response?.data?.detail
          || err.response?.data?.message
          || 'Something went wrong.'
        const lower = msg.toLowerCase()

        if (httpStatus === 404) {
          if (lower.includes('expir'))       setError({ type: 'expired', message: msg })
          else if (lower.includes('revok'))  setError({ type: 'revoked', message: msg })
          else                               setError({ type: 'invalid', message: msg })
        } else {
          setError({ type: 'error', message: msg })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  // ── Download handler ─────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    setDlError('')
    try {
      const { data } = await downloadPublicZipShare(token)
      const url  = window.URL.createObjectURL(new Blob([data], { type: 'application/zip' }))
      const link = document.createElement('a')
      link.href     = url
      link.download = info?.zip_name || 'shared_files.zip'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setDownloaded(true)
    } catch (err) {
      const msg = err.response?.data?.detail
        || err.response?.data?.message
        || 'Download failed. The link may have expired.'
      setDlError(msg)
    } finally {
      setDownloading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen />
  if (error)   return <ErrorScreen type={error.type} message={error.message} />

  const files      = info.files_info || []
  const fileCount  = info.file_count || files.length
  const isExpired  = info.expires_at && new Date(info.expires_at) < new Date()

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-indigo-50 to-slate-50 flex items-start justify-center p-4 pt-8 sm:pt-16">
      <div className="max-w-lg w-full space-y-4">

        {/* ── Header card ── */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center">
          {/* ZIP icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
            <i className="fas fa-file-zipper text-4xl text-violet-600"></i>
          </div>

          {/* ZIP name */}
          <h1 className="text-xl font-bold text-slate-900 break-all leading-tight">
            {info.zip_name || 'shared_files.zip'}
          </h1>
          <p className="text-sm text-slate-400 mt-1.5">
            {fileCount} file{fileCount !== 1 ? 's' : ''} bundled as a ZIP archive
          </p>

          {/* Message from sender */}
          {info.message && (
            <div className="mt-5 px-4 py-3 bg-violet-50 border-l-4 border-violet-400 rounded-r-2xl text-left">
              <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-1">Message from sender</p>
              <p className="text-sm text-violet-900 leading-relaxed">"{info.message}"</p>
            </div>
          )}
        </div>

        {/* ── Meta grid ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Files</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{fileCount}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shared</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{fmtDate(info.shared_at)}</p>
            </div>
            <div className={`col-span-2 rounded-xl px-4 py-3 ${isExpired ? 'bg-red-50' : 'bg-slate-50'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isExpired ? 'text-red-400' : 'text-slate-400'}`}>
                {isExpired ? 'Expired' : 'Expires'}
              </p>
              <p className={`text-sm font-bold mt-0.5 ${isExpired ? 'text-red-600' : 'text-slate-900'}`}>
                {fmtDateTime(info.expires_at)}
              </p>
            </div>
          </div>
        </div>

        {/* ── File list ── */}
        {files.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fas fa-list text-violet-500 text-sm"></i>
                <span className="text-sm font-bold text-slate-900">Files in this bundle</span>
              </div>
              <span className="text-xs text-slate-400 font-medium">{files.length} item{files.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="px-5 py-2 max-h-64 overflow-y-auto">
              {files.map((f) => (
                <FileListItem key={f.id} file={f} />
              ))}
            </div>
          </div>
        )}

        {/* ── Download card ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">

          {/* Error from download attempt */}
          {dlError && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <i className="fas fa-circle-exclamation mt-0.5 flex-shrink-0"></i>
              <span>{dlError}</span>
            </div>
          )}

          {/* Success hint */}
          {downloaded && !dlError && (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
              <i className="fas fa-circle-check flex-shrink-0"></i>
              <span>ZIP downloaded successfully!</span>
            </div>
          )}

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={downloading || isExpired}
            className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2.5 shadow-lg ${
              isExpired
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : downloading
                  ? 'bg-violet-400 text-white cursor-wait shadow-violet-200'
                  : downloaded
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'
                    : 'bg-violet-600 text-white hover:bg-violet-700 active:scale-[0.98] shadow-violet-200'
            }`}
          >
            {isExpired ? (
              <><i className="fas fa-clock"></i>Link Expired</>
            ) : downloading ? (
              <><i className="fas fa-spinner fa-spin"></i>Preparing download…</>
            ) : downloaded ? (
              <><i className="fas fa-circle-check"></i>Downloaded · Click to download again</>
            ) : (
              <><i className="fas fa-download"></i>Download ZIP ({fileCount} file{fileCount !== 1 ? 's' : ''})</>
            )}
          </button>

          {/* Security / privacy notice */}
          {!isExpired && (
            <div className="flex items-start gap-3">
              <i className="fas fa-shield-halved text-emerald-400 mt-0.5 flex-shrink-0 text-sm"></i>
              <p className="text-xs text-slate-400 leading-relaxed">
                This link is private to you. All files have been scanned for malware before being
                shared. The link expires on <strong className="text-slate-500">{fmtDateTime(info.expires_at)}</strong>.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-300 pb-6">
          Powered by FileVault · Secure File Sharing
        </p>
      </div>
    </div>
  )
}