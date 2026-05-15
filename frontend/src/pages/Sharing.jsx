import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import {
  fetchAllFiles,
  fetchShares,
  share,
  revoke,
  deleteShare,
  createZipShare,
  fetchZipShares,
  revokeZipShare,
  deleteZipShare,
  fetchGlobalAnalytics,
  fetchRequests,
  createRequest,
  closeRequest,
  fetchInbox,
  reviewInboxItem,
  deleteInfectedFile,
  removeInboxItem,
} from '@/store/sharingSlice'
import Alert from '@/components/ui/Alert'

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) => (n ?? 0).toLocaleString()

// ─── UI primitives ────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const map = {
    active:       'bg-emerald-50 text-emerald-700 border border-emerald-200',
    expired:      'bg-slate-50 text-slate-500 border border-slate-200',
    revoked:      'bg-red-50 text-red-600 border border-red-200',
    pending:      'bg-amber-50 text-amber-700 border border-amber-200',
    approved:     'bg-emerald-50 text-emerald-700 border border-emerald-200',
    rejected:     'bg-red-50 text-red-600 border border-red-200',
    needs_action: 'bg-orange-50 text-orange-600 border border-orange-200',
    complete:     'bg-blue-50 text-blue-700 border border-blue-200',
    open:         'bg-indigo-50 text-indigo-700 border border-indigo-200',
    fulfilled:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
    closed:       'bg-slate-50 text-slate-500 border border-slate-200',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${map[status] || map.pending}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  )
}

const ScanBadge = ({ status }) => {
  const cfg = {
    pending:     { cls: 'bg-slate-50 text-slate-500 border-slate-200',      icon: 'fa-clock',                label: 'Pending Scan' },
    scanning:    { cls: 'bg-blue-50 text-blue-600 border-blue-200',          icon: 'fa-spinner fa-spin',      label: 'Scanning…'    },
    safe:        { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'fa-shield-halved',        label: 'Safe'         },
    infected:    { cls: 'bg-red-50 text-red-700 border-red-200',             icon: 'fa-bug',                  label: 'Infected'     },
    scan_failed: { cls: 'bg-orange-50 text-orange-600 border-orange-200',    icon: 'fa-triangle-exclamation', label: 'Scan Failed'  },
  }
  const c = cfg[status] || cfg.pending
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${c.cls}`}>
      <i className={`fas ${c.icon} text-[9px]`}></i>{c.label}
    </span>
  )
}

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${className}`}>{children}</div>
)

const StatTile = ({ icon, label, value, color = 'indigo' }) => (
  <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
    <div className={`absolute -right-4 -top-4 h-20 w-20 rounded-full bg-${color}-500 opacity-10 blur-2xl`} />
    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-${color}-500 to-${color}-600 text-white shadow-md mb-3`}>
      <i className={`fas ${icon} text-base`}></i>
    </div>
    <p className="text-2xl font-bold text-slate-900">{value}</p>
    <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
  </div>
)

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto flex-wrap">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            active === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <i className={`fas ${t.icon} text-[11px]`}></i>
          {t.label}
          {t.count != null && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              active === t.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
            }`}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

function ConfirmModal({ title, body, confirmLabel, confirmClass, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-6">{body}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-3 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${confirmClass}`}
          >
            {loading ? <><i className="fas fa-spinner fa-spin text-xs"></i>Please wait…</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function EmailChipInput({ label, helper, value, onChange, required }) {
  const [raw, setRaw] = useState('')

  const parse = (text) => {
    const list = text
      .split(/[,;\s\n]+/)
      .map((e) => e.trim())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    onChange([...new Set([...value, ...list])])
  }

  const onKeyDown = (e) => {
    if (['Enter', ',', ';', ' '].includes(e.key)) {
      e.preventDefault()
      parse(raw)
      setRaw('')
    }
  }

  const remove = (email) => onChange(value.filter((x) => x !== email))

  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
        {helper && <span className="normal-case text-slate-400 font-normal ml-1">{helper}</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => { if (raw) { parse(raw); setRaw('') } }}
          placeholder="name@example.com  (press Enter or comma)"
          className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 focus:outline-none"
        />
        {value.length > 0 && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {value.length}
          </span>
        )}
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((e) => (
            <span key={e} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full">
              <i className="fas fa-envelope text-[10px]"></i>{e}
              <button type="button" onClick={() => remove(e)}>
                <i className="fas fa-xmark text-[10px] hover:text-red-500"></i>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── File selector ────────────────────────────────────────────────────────────

function FileSelector({ files, loading, selectedFiles, onToggle }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return files
    const q = search.toLowerCase()
    return files.filter(
      (f) => f.original_name?.toLowerCase().includes(q) || f.mime_type?.toLowerCase().includes(q),
    )
  }, [files, search])

  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">
        Files *{' '}
        <span className="normal-case text-slate-400 font-normal">
          (select one for a direct link · two or more for a ZIP bundle)
        </span>
      </label>
      <div className="relative mb-2">
        <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or type…"
          className="w-full pl-8 pr-9 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 focus:outline-none"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <i className="fas fa-xmark text-xs"></i>
          </button>
        )}
      </div>
      <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <i className="fas fa-spinner fa-spin mr-2"></i>Loading your files…
          </div>
        ) : files.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No files found. Upload files first.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No files match "{search}"</p>
        ) : (
          filtered.map((f) => {
            const checked = selectedFiles.includes(f.id)
            return (
              <label key={f.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${checked ? 'bg-indigo-50' : ''}`}>
                <input type="checkbox" checked={checked} onChange={() => onToggle(f.id)} className="w-4 h-4 rounded accent-indigo-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate font-medium">{f.original_name}</p>
                  <p className="text-[10px] text-slate-400">{f.mime_type || 'Unknown type'}</p>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{f.file_size_display}</span>
              </label>
            )
          })
        )}
      </div>
      {selectedFiles.length > 0 && (
        <p className="text-xs text-indigo-600 font-semibold mt-1.5 flex items-center gap-1">
          <i className="fas fa-check-circle"></i>
          {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  )
}

// ─── Pagination control ───────────────────────────────────────────────────────

function Pagination({ currentPage, totalPages, count, onPageChange, loading }) {
  if (!totalPages || totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1 || loading}
        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        <i className="fas fa-chevron-left text-[10px]"></i> Prev
      </button>
      <span className="text-xs text-slate-500 font-medium px-2">
        Page {currentPage} of {totalPages}
        {count != null && <span className="text-slate-400 ml-1">({fmt(count)} total)</span>}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages || loading}
        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        Next <i className="fas fa-chevron-right text-[10px]"></i>
      </button>
    </div>
  )
}

// ─── File viewer modal ────────────────────────────────────────────────────────

function FileViewerModal({ file, onClose }) {
  const isImage = file.mime_type?.startsWith('image/')
  const isPdf   = file.mime_type === 'application/pdf'
  const isText  = file.mime_type?.startsWith('text/')
  const isVideo = file.mime_type?.startsWith('video/')
  const isAudio = file.mime_type?.startsWith('audio/')

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fas fa-eye text-emerald-600 text-sm"></i>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{file.original_filename}</p>
              <p className="text-xs text-slate-400">{file.mime_type} · <ScanBadge status="safe" /></p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {file.file_url && (
              <a
                href={file.file_url}
                download={file.original_filename}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all"
              >
                <i className="fas fa-download text-[10px]"></i> Download
              </a>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all">
              <i className="fas fa-xmark"></i>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 p-4">
          {isImage && (
            <div className="flex items-center justify-center h-full min-h-64">
              <img src={file.file_url} alt={file.original_filename} className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-md" />
            </div>
          )}
          {isPdf && <iframe src={file.file_url} className="w-full h-[70vh] rounded-xl border border-slate-200" title={file.original_filename} />}
          {isVideo && (
            <div className="flex items-center justify-center">
              <video controls className="max-w-full max-h-[70vh] rounded-xl shadow-md">
                <source src={file.file_url} type={file.mime_type} />
              </video>
            </div>
          )}
          {isAudio && (
            <div className="flex items-center justify-center p-8">
              <audio controls className="w-full max-w-lg">
                <source src={file.file_url} type={file.mime_type} />
              </audio>
            </div>
          )}
          {isText && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-3 flex items-center gap-2">
                <i className="fas fa-file-lines text-slate-400"></i>
                Text preview — <a href={file.file_url} className="text-indigo-600 hover:underline">open full file</a>
              </p>
              <iframe src={file.file_url} className="w-full h-96 border-0" title={file.original_filename} />
            </div>
          )}
          {!isImage && !isPdf && !isVideo && !isAudio && !isText && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <i className="fas fa-file text-5xl mb-4 text-slate-300"></i>
              <p className="text-sm font-semibold text-slate-600 mb-1">Preview not available</p>
              <p className="text-xs text-slate-400 mb-4">This file type cannot be previewed in the browser.</p>
              {file.file_url && (
                <a href={file.file_url} download={file.original_filename} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all">
                  <i className="fas fa-download"></i> Download File
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 1. Shares panel ──────────────────────────────────────────────────────────

function SharesPanel() {
  const dispatch = useDispatch()
  const {
    allFiles, allFilesLoading,
    shares, pagination, sharing,
    zipShares, zipPagination, zipSharing,
    error,
  } = useSelector((s) => s.sharing)

  const [showForm,      setShowForm]      = useState(false)
  const [currentPage,   setCurrentPage]   = useState(1)
  const [successMsg,    setSuccessMsg]    = useState('')
  const [emails,        setEmails]        = useState([])
  const [selectedFiles, setSelectedFiles] = useState([])
  const [actionConfirm, setActionConfirm] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  // Track whether we're in a background refresh so we don't flash loading state
  const [initialLoaded, setInitialLoaded] = useState(false)

  const { register: field, handleSubmit, reset } = useForm({
    defaultValues: { expiration_hours: 24, message: '', zip_name: 'shared_files' },
  })

  // Fetch all files once on mount
  useEffect(() => { dispatch(fetchAllFiles()) }, [dispatch])

  // Fetch shares whenever page changes; mark initial load done after first fetch
  useEffect(() => {
    const load = async () => {
      await Promise.all([
        dispatch(fetchShares({ page: currentPage })),
        dispatch(fetchZipShares({ page: currentPage })),
      ])
      setInitialLoaded(true)
    }
    load()
  }, [dispatch, currentPage])

  const toggleFile = (id) =>
    setSelectedFiles((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const isZipMode    = selectedFiles.length >= 2
  const isSingleMode = selectedFiles.length === 1
  const isFormValid  = emails.length > 0 && selectedFiles.length >= 1
  const isSubmitting = sharing || zipSharing

  const flash = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 8000)
  }

  const onSubmit = async (data) => {
    if (!isFormValid) return

    let result
    if (isZipMode) {
      result = await dispatch(createZipShare({
        file_ids:         selectedFiles,
        recipient_emails: emails,
        expiration_hours: Number(data.expiration_hours),
        message:          data.message || '',
        zip_name:         (data.zip_name || 'shared_files').replace(/\.zip$/i, '') + '.zip',
      }))
      if (createZipShare.fulfilled.match(result)) {
        const p = result.payload
        flash(`✓ ${p.file_count} files bundled into ${p.count} unique ZIP link${p.count !== 1 ? 's' : ''}. Each recipient received their own private download link by email.`)
      } else {
        flash(`⚠ ZIP share failed: ${result.payload || 'Unknown error'}`)
      }
    } else {
      result = await dispatch(share({
        file_id:          selectedFiles[0],
        recipient_emails: emails,
        expiration_hours: Number(data.expiration_hours),
        message:          data.message || '',
      }))
      if (share.fulfilled.match(result)) {
        const count = result.payload.count ?? 0
        flash(`✓ File shared with ${emails.length} recipient${emails.length !== 1 ? 's' : ''}. ${count} unique private link${count !== 1 ? 's' : ''} sent by email.`)
      } else {
        flash(`⚠ Share failed: ${result.payload || 'Unknown error'}`)
      }
    }

    reset()
    setEmails([])
    setSelectedFiles([])
    setShowForm(false)
    // Go to page 1 to see the new share at the top
    setCurrentPage(1)
    // Re-fetch immediately — page change above will trigger the useEffect,
    // but if currentPage was already 1 we need to force it
    await Promise.all([
      dispatch(fetchShares({ page: 1 })),
      dispatch(fetchZipShares({ page: 1 })),
    ])
  }

  const handleConfirmAction = async () => {
    if (!actionConfirm) return
    setActionLoading(true)
    const { id, type, action } = actionConfirm
    try {
      if (action === 'revoke') {
        type === 'zip' ? await dispatch(revokeZipShare(id)) : await dispatch(revoke(id))
      } else {
        type === 'zip' ? await dispatch(deleteZipShare(id)) : await dispatch(deleteShare(id))
      }
      // Re-fetch current page after action so the list is immediately accurate
      await Promise.all([
        dispatch(fetchShares({ page: currentPage })),
        dispatch(fetchZipShares({ page: currentPage })),
      ])
    } finally {
      setActionLoading(false)
      setActionConfirm(null)
    }
  }

  // Merge + sort shares from both slices — stable because each fetch replaces
  // the arrays in Redux with the correct page data
  const allShares = useMemo(() => {
    const singles = (shares || []).map((s) => ({ ...s, _type: 'single' }))
    const zips    = (zipShares || []).map((z) => ({ ...z, _type: 'zip' }))
    return [...singles, ...zips].sort((a, b) => new Date(b.shared_at) - new Date(a.shared_at))
  }, [shares, zipShares])

  const totalPages = Math.max(pagination?.total_pages || 1, zipPagination?.total_pages || 1)
  const totalCount = (pagination?.count || 0) + (zipPagination?.count || 0)

  // Show full-page spinner only on the very first load, not on subsequent page changes
  const showSpinner = !initialLoaded && (sharing || zipSharing)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Shared Files</h2>
          <p className="text-sm text-slate-500">1 file → private download link per recipient · 2+ files → ZIP bundle per recipient</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm"
        >
          <i className={`fas ${showForm ? 'fa-xmark' : 'fa-share-nodes'}`}></i>
          {showForm ? 'Cancel' : 'Share Files'}
        </button>
      </div>

      {error      && <Alert type="error"   message={error}      className="rounded-xl" />}
      {successMsg && <Alert type="success" message={successMsg} className="rounded-xl" />}

      {showForm && (
        <Card className="p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <i className="fas fa-share-alt text-indigo-500"></i> New Share
          </h3>
          <div className="flex items-start gap-2 mb-5 px-3 py-2.5 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700">
            <i className="fas fa-shield-halved mt-0.5 flex-shrink-0"></i>
            <span>Share links are <strong>private and unique per recipient</strong>. Each link is sent by email — no public links are created. Links expire automatically.</span>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <FileSelector files={allFiles} loading={allFilesLoading} selectedFiles={selectedFiles} onToggle={toggleFile} />

            {selectedFiles.length > 0 && (
              <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-xs font-semibold ${
                isSingleMode ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-violet-50 border-violet-100 text-violet-700'
              }`}>
                <i className={`fas ${isSingleMode ? 'fa-link' : 'fa-file-zipper'} text-sm mt-0.5 flex-shrink-0`}></i>
                <span>
                  {isSingleMode
                    ? 'Single file mode — each recipient receives their own private download link'
                    : `ZIP bundle mode — ${selectedFiles.length} files will be bundled; each recipient gets one ZIP download link`}
                </span>
              </div>
            )}

            {isZipMode && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">ZIP File Name</label>
                <div className="flex items-stretch">
                  <input type="text" {...field('zip_name')} placeholder="shared_files" className="flex-1 px-4 py-3 bg-slate-50 rounded-l-xl border border-r-0 border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 focus:outline-none" />
                  <span className="px-3 py-3 bg-slate-100 rounded-r-xl text-sm text-slate-500 font-medium border border-l-0 border-slate-200">.zip</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Expires After</label>
              <select {...field('expiration_hours')} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-200 focus:outline-none">
                <option value="1">1 hour</option>
                <option value="24">1 day</option>
                <option value="72">3 days</option>
                <option value="168">1 week</option>
                <option value="720">30 days</option>
              </select>
            </div>

            <div>
              <EmailChipInput
                label="Recipients"
                helper="(required — each gets their own private link by email)"
                value={emails}
                onChange={setEmails}
                required
              />
              {emails.length === 0 && (
                <p className="text-xs text-amber-600 font-medium mt-1.5 flex items-center gap-1">
                  <i className="fas fa-circle-exclamation text-[10px]"></i>
                  At least one recipient email is required to share files.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Message (optional)</label>
              <input type="text" {...field('message')} placeholder="Add a personal note shown in the email…" className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 focus:outline-none" />
            </div>

            {selectedFiles.length > 0 && emails.length > 0 && (
              <div className="flex items-start gap-3 px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <i className="fas fa-info-circle text-indigo-400 mt-0.5 flex-shrink-0"></i>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  {isSingleMode
                    ? <><strong>{emails.length} unique private link{emails.length !== 1 ? 's' : ''}</strong> sent by email immediately. Links expire after the selected period.</>
                    : <><strong>{selectedFiles.length} files</strong> bundled into <strong>{emails.length} private ZIP archive{emails.length !== 1 ? 's' : ''}</strong> — one per recipient, sent by email.</>}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="submit"
                disabled={isSubmitting || !isFormValid}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><i className="fas fa-spinner fa-spin"></i>Sharing…</>
                ) : isZipMode ? (
                  <><i className="fas fa-file-zipper"></i>Create ZIP Share ({selectedFiles.length} files · {emails.length || '…'} recipients)</>
                ) : (
                  <><i className="fas fa-paper-plane"></i>Share with {emails.length || '…'} recipient{emails.length !== 1 ? 's' : ''}</>
                )}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="sm:w-auto px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {showSpinner ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <i className="fas fa-spinner fa-spin text-xl mr-2"></i>Loading shares…
        </div>
      ) : allShares.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-share-nodes text-2xl text-slate-400"></i>
          </div>
          <p className="text-slate-500 font-semibold">No shares yet</p>
          <p className="text-slate-400 text-sm mt-1">Share 1 file for a direct link, or 2+ files for a ZIP bundle.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {allShares.map((s) => {
            const isZip = s._type === 'zip'
            return (
              <Card key={`${s._type}-${s.id}`} className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isZip ? 'bg-violet-100' : 'bg-indigo-100'}`}>
                        <i className={`fas ${isZip ? 'fa-file-zipper text-violet-600' : 'fa-file text-indigo-600'} text-xs`}></i>
                      </div>
                      {isZip ? (
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{s.zip_name}</p>
                          <p className="text-[10px] text-violet-500 font-semibold">{s.file_count} files bundled</p>
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs">{s.file_name}</p>
                      )}
                      <StatusBadge status={s.status} />
                      {isZip && <span className="text-[10px] px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full font-bold border border-violet-100">ZIP</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      <i className="fas fa-envelope text-slate-400 mr-1"></i>{s.recipient_email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {s.status === 'active' && (
                      <button onClick={() => setActionConfirm({ id: s.id, type: s._type, action: 'revoke' })} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-all border border-amber-100">
                        <i className="fas fa-ban text-[11px]"></i>Revoke
                      </button>
                    )}
                    <button onClick={() => setActionConfirm({ id: s.id, type: s._type, action: 'delete' })} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-all border border-red-100">
                      <i className="fas fa-trash text-[11px]"></i>Delete
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    ...(!isZip ? [{ icon: 'fa-eye', label: 'Views', value: fmt(s.view_count) }] : [{ icon: 'fa-files', label: 'Files', value: s.file_count }]),
                    { icon: 'fa-download', label: 'Downloads', value: fmt(s.download_count) },
                    { icon: 'fa-calendar', label: 'Shared',    value: new Date(s.shared_at).toLocaleDateString() },
                    { icon: 'fa-clock',    label: 'Expires',   value: new Date(s.expires_at).toLocaleDateString() },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="bg-slate-50 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <i className={`fas ${icon} text-[9px]`}></i>{label}
                      </p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
                {isZip && s.files_info?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Files in ZIP</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.files_info.map((f) => (
                        <span key={f.id} className="text-[10px] px-2 py-1 bg-violet-50 text-violet-700 rounded-lg font-medium">{f.original_name}</span>
                      ))}
                    </div>
                  </div>
                )}
                {s.has_been_accessed && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-emerald-600">
                    <i className="fas fa-circle-check text-[10px]"></i>
                    {isZip ? 'ZIP downloaded' : 'File accessed'} · Last: {s.accessed_at ? new Date(s.accessed_at).toLocaleString() : '—'}
                  </p>
                )}
                {s.message && (
                  <div className="mt-3 px-4 py-2.5 bg-blue-50 border-l-2 border-blue-300 rounded-r-xl text-xs text-blue-800">
                    <i className="fas fa-comment-alt mr-1.5"></i>"{s.message}"
                  </div>
                )}
              </Card>
            )
          })}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            count={totalCount}
            onPageChange={(p) => setCurrentPage(p)}
            loading={sharing || zipSharing}
          />
        </div>
      )}

      {actionConfirm && (
        <ConfirmModal
          title={actionConfirm.action === 'revoke' ? `Revoke this ${actionConfirm.type === 'zip' ? 'ZIP share' : 'share'}?` : `Delete this ${actionConfirm.type === 'zip' ? 'ZIP share' : 'share'}?`}
          body={actionConfirm.action === 'revoke' ? 'The recipient will no longer be able to download using this link. This cannot be undone.' : 'This share record will be permanently removed. The source files are not affected.'}
          confirmLabel={actionConfirm.action === 'revoke' ? 'Revoke' : 'Delete'}
          confirmClass={actionConfirm.action === 'revoke' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-500 hover:bg-red-600'}
          loading={actionLoading}
          onCancel={() => setActionConfirm(null)}
          onConfirm={handleConfirmAction}
        />
      )}
    </div>
  )
}

// ─── 2. Analytics panel ───────────────────────────────────────────────────────

function AnalyticsPanel() {
  const dispatch = useDispatch()
  const { globalAnalytics, analyticsLoading } = useSelector((s) => s.sharing)

  useEffect(() => { dispatch(fetchGlobalAnalytics()) }, [dispatch])

  if (analyticsLoading || !globalAnalytics) return (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <i className="fas fa-spinner fa-spin text-2xl mr-3"></i>Loading analytics…
    </div>
  )

  const { totals, top_shares = [], top_zips = [], single_file = {}, zip_shares = {} } = globalAnalytics

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Sharing Analytics</h2>
        <p className="text-sm text-slate-500">Aggregated stats across single-file shares and ZIP bundles.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile icon="fa-share-nodes"  label="Total Shares"    value={fmt(totals?.total_shares)}    color="indigo"  />
        <StatTile icon="fa-eye"          label="Total Views"     value={fmt(totals?.total_views)}     color="blue"    />
        <StatTile icon="fa-download"     label="Total Downloads" value={fmt(totals?.total_downloads)} color="emerald" />
        <StatTile icon="fa-circle-check" label="Active"          value={fmt(totals?.active_count)}    color="green"   />
        <StatTile icon="fa-clock"        label="Expired"         value={fmt(totals?.expired_count)}   color="amber"   />
        <StatTile icon="fa-ban"          label="Revoked"         value={fmt(totals?.revoked_count)}   color="red"     />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center"><i className="fas fa-file text-indigo-600 text-xs"></i></div>
            <h3 className="text-sm font-bold text-slate-800">Single-file Shares</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Shares',    value: fmt(single_file?.total_shares) },
              { label: 'Downloads', value: fmt(single_file?.total_downloads) },
              { label: 'Views',     value: fmt(single_file?.total_views) },
              { label: 'Active',    value: fmt(single_file?.active_count) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-xl px-3 py-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase">{label}</p>
                <p className="text-sm font-bold text-slate-800">{value}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center"><i className="fas fa-file-zipper text-violet-600 text-xs"></i></div>
            <h3 className="text-sm font-bold text-slate-800">ZIP Bundle Shares</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'ZIP Shares', value: fmt(zip_shares?.total_zip_shares) },
              { label: 'Downloads',  value: fmt(zip_shares?.total_zip_downloads) },
              { label: 'Active',     value: fmt(zip_shares?.zip_active) },
              { label: 'Expired',    value: fmt(zip_shares?.zip_expired) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-xl px-3 py-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase">{label}</p>
                <p className="text-sm font-bold text-slate-800">{value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {top_shares.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <i className="fas fa-trophy text-amber-500"></i>
            <h3 className="text-sm font-bold text-slate-900">Top Single-file Shares by Downloads</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {top_shares.map((s, i) => (
              <div key={s.id} className="flex items-center gap-4 px-6 py-4 flex-wrap sm:flex-nowrap">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : 'bg-orange-50 text-orange-600'}`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.file_name}</p>
                  <p className="text-xs text-slate-400">{s.recipient_email}</p>
                </div>
                <div className="flex items-center gap-4 text-xs flex-shrink-0">
                  <span className="flex items-center gap-1 text-blue-600 font-semibold"><i className="fas fa-eye text-[10px]"></i>{fmt(s.view_count)}</span>
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold"><i className="fas fa-download text-[10px]"></i>{fmt(s.download_count)}</span>
                  <StatusBadge status={s.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── 3. File Requests panel ───────────────────────────────────────────────────

function RequestsPanel() {
  const dispatch = useDispatch()
  const { requests, requestLoading, requestPagination, error } = useSelector((s) => s.sharing)

  const [showForm,        setShowForm]        = useState(false)
  const [closeConfirm,    setCloseConfirm]    = useState(null)
  const [successMsg,      setSuccessMsg]      = useState('')
  const [recipientEmails, setRecipientEmails] = useState([])
  const [currentPage,     setCurrentPage]     = useState(1)
  const [emailError,      setEmailError]      = useState('')
  const [initialLoaded,   setInitialLoaded]   = useState(false)

  const { register: field, handleSubmit, reset, formState: { errors } } = useForm({
    mode: 'onTouched',
    defaultValues: { expiration_hours: 168, max_files: 10, title: '', description: '', allowed_extensions: '' },
  })

  useEffect(() => {
    const load = async () => {
      await dispatch(fetchRequests({ page: currentPage }))
      setInitialLoaded(true)
    }
    load()
  }, [dispatch, currentPage])

  const validateAndSubmit = (data) => {
    if (recipientEmails.length === 0) {
      setEmailError('At least one recipient email is required. Upload links are sent by email only.')
      return
    }
    setEmailError('')
    onSubmit(data)
  }

  const onSubmit = async (data) => {
    const allowedExt = data.allowed_extensions
      ? data.allowed_extensions.split(/[,\s]+/).map((e) => e.trim().replace(/^\./, '').toLowerCase()).filter(Boolean)
      : []

    const payload = {
      title:              data.title,
      description:        data.description || '',
      recipient_emails:   recipientEmails,
      recipient_email:    '',
      expiration_hours:   Number(data.expiration_hours),
      max_files:          Number(data.max_files),
      allowed_extensions: allowedExt,
    }
    const result = await dispatch(createRequest(payload))
    if (createRequest.fulfilled.match(result)) {
      reset()
      setRecipientEmails([])
      setShowForm(false)
      const count = recipientEmails.length
      setSuccessMsg(
        `✓ File request created. ${count} unique upload link${count !== 1 ? 's' : ''} sent by email to ${count} recipient${count !== 1 ? 's' : ''}.`
      )
      setTimeout(() => setSuccessMsg(''), 8000)
      // Refresh to page 1 so new request appears immediately
      setCurrentPage(1)
      await dispatch(fetchRequests({ page: 1 }))
    }
  }

  const handleClose = async (id) => {
    await dispatch(closeRequest(id))
    setCloseConfirm(null)
    await dispatch(fetchRequests({ page: currentPage }))
  }

  const totalPages = requestPagination?.total_pages || 1
  const totalCount = requestPagination?.count || 0
  const showSpinner = !initialLoaded && requestLoading

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">File Requests</h2>
          <p className="text-sm text-slate-500">Ask recipients to upload files — upload links delivered by email only.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm"
        >
          <i className={`fas ${showForm ? 'fa-xmark' : 'fa-plus'}`}></i>
          {showForm ? 'Cancel' : 'New Request'}
        </button>
      </div>

      {error      && <Alert type="error"   message={error}      className="rounded-xl" />}
      {successMsg && <Alert type="success" message={successMsg} className="rounded-xl" />}

      {showForm && (
        <Card className="p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <i className="fas fa-inbox text-indigo-500"></i> Create Upload Request
          </h3>
          <div className="mb-5 space-y-2">
            <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700">
              <i className="fas fa-shield-halved mt-0.5 flex-shrink-0"></i>
              <span><strong>Email delivery only</strong> — upload links are sent directly to recipients and are not publicly accessible. Each recipient gets a unique, single-use link.</span>
            </div>
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700">
              <i className="fas fa-virus-slash mt-0.5 flex-shrink-0"></i>
              <span>All uploaded files are <strong>automatically scanned for viruses</strong> before they appear in your inbox. Infected files are quarantined and flagged immediately.</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(validateAndSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Title *</label>
              <input
                type="text"
                {...field('title', { required: 'Title is required.' })}
                placeholder="e.g. Q4 Invoice Submission"
                className={`w-full px-4 py-3 bg-slate-50 rounded-xl border text-sm focus:ring-2 focus:ring-indigo-200 focus:outline-none ${errors.title ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'}`}
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Description</label>
              <textarea {...field('description')} rows={3} placeholder="What files do you need? Any specific requirements?" className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 focus:outline-none resize-none" />
            </div>

            <div>
              <EmailChipInput
                label="Recipients"
                helper="(required — each gets their own unique upload link by email)"
                value={recipientEmails}
                onChange={(v) => { setRecipientEmails(v); if (v.length > 0) setEmailError('') }}
                required
              />
              {emailError && (
                <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700">
                  <i className="fas fa-circle-exclamation mt-0.5 flex-shrink-0"></i>
                  <span>{emailError}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Expires After</label>
                <select {...field('expiration_hours')} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 focus:outline-none">
                  <option value="24">1 day</option>
                  <option value="72">3 days</option>
                  <option value="168">1 week</option>
                  <option value="720">30 days</option>
                  <option value="8760">1 year</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Max Files</label>
                <input type="number" min="1" max="50" {...field('max_files')} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                Allowed File Types <span className="normal-case text-slate-400 font-normal">(optional — leave blank to accept all safe types)</span>
              </label>
              <input
                type="text"
                {...field('allowed_extensions')}
                placeholder="e.g. pdf, docx, jpg, png"
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 focus:outline-none"
              />
              <p className="text-xs text-slate-400 mt-1">Separate with commas. Executable files (.exe, .sh, .bat…) are always blocked.</p>
            </div>

            {recipientEmails.length > 0 && (
              <div className="flex items-start gap-3 px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <i className="fas fa-check-circle text-emerald-500 mt-0.5 flex-shrink-0"></i>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  <strong>{recipientEmails.length} private upload link{recipientEmails.length !== 1 ? 's' : ''}</strong> will be sent by email. Links are unique per recipient. All uploads will be virus-scanned before delivery to your inbox.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="submit"
                disabled={requestLoading}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {requestLoading
                  ? <><i className="fas fa-spinner fa-spin"></i>Creating…</>
                  : <><i className="fas fa-paper-plane"></i>Create & Send {recipientEmails.length > 0 ? `(${recipientEmails.length} recipient${recipientEmails.length !== 1 ? 's' : ''})` : 'Request'}</>}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="sm:w-auto px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {showSpinner ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <i className="fas fa-spinner fa-spin text-xl mr-2"></i>Loading…
        </div>
      ) : requests.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-inbox text-2xl text-slate-400"></i>
          </div>
          <p className="text-slate-500 font-semibold">No file requests yet</p>
          <p className="text-slate-400 text-sm mt-1">Create a request to collect files from anyone via a secure email link.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const recipients = req.recipients || []
            return (
              <Card key={req.id} className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900">{req.title}</p>
                      <StatusBadge status={req.status} />
                      {req.is_expired && <span className="text-xs text-red-500 font-semibold">Expired</span>}
                    </div>
                    {req.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{req.description}</p>}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
                      <span><i className="fas fa-file mr-1"></i>{req.submission_count}/{req.max_files} submissions</span>
                      {req.expires_at && <span><i className="fas fa-clock mr-1"></i>Expires {new Date(req.expires_at).toLocaleDateString()}</span>}
                      {recipients.length > 0 && <span><i className="fas fa-users mr-1"></i>{recipients.length} recipient{recipients.length !== 1 ? 's' : ''}</span>}
                      {req.allowed_extensions?.length > 0 && (
                        <span><i className="fas fa-filter mr-1"></i>{req.allowed_extensions.join(', ')}</span>
                      )}
                    </div>
                  </div>
                  {/* ── Only show Close button; Copy Link removed ── */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {req.status === 'open' && (
                      <button onClick={() => setCloseConfirm(req.id)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-all">
                        Close
                      </button>
                    )}
                  </div>
                </div>

                {/* Recipients list — shows emails and their upload counts; no copy-link buttons */}
                {recipients.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Recipients · {recipients.length}
                    </p>
                    <div className="space-y-1.5">
                      {recipients.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                          <i className="fas fa-user text-slate-300 text-[11px] flex-shrink-0"></i>
                          <span className="text-xs font-medium text-slate-700 truncate">{r.email}</span>
                          {r.upload_count > 0 && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ml-auto">
                              ✓ {r.upload_count} uploaded
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {req.required_files?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Required Files</p>
                    <div className="flex flex-wrap gap-1.5">
                      {req.required_files.map((f) => (
                        <span key={f} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[11px] font-semibold rounded-full border border-amber-100">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            count={totalCount}
            onPageChange={(p) => setCurrentPage(p)}
            loading={requestLoading}
          />
        </div>
      )}

      {closeConfirm && (
        <ConfirmModal
          title="Close this request?"
          body="The upload link will no longer work. Existing submissions are preserved."
          confirmLabel="Close Request"
          confirmClass="bg-slate-700 hover:bg-slate-800"
          onCancel={() => setCloseConfirm(null)}
          onConfirm={() => handleClose(closeConfirm)}
        />
      )}
    </div>
  )
}

// ─── 4. Submission Inbox panel ────────────────────────────────────────────────

const SCAN_POLL_INTERVAL = 5000

function InboxPanel() {
  const dispatch = useDispatch()
  const { inbox, inboxLoading, inboxStatusCounts, scanStatusCounts, deletingFile, removingItem } = useSelector((s) => s.sharing)

  const [activeStatus,  setActiveStatus]  = useState('')
  const [reviewModal,   setReviewModal]   = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [viewFile,      setViewFile]      = useState(null)
  const [reviewNote,    setReviewNote]    = useState('')
  const [errorMsg,      setErrorMsg]      = useState('')
  const [currentPage,   setCurrentPage]   = useState(1)
  const [initialLoaded, setInitialLoaded] = useState(false)

  const pollRef = useRef(null)

  const hasScanning = useMemo(() =>
    inbox.some((s) => s.scan_status === 'scanning' || s.scan_status === 'pending'),
    [inbox]
  )

  const loadInbox = useCallback(async () => {
    await dispatch(fetchInbox({ page: currentPage, status: activeStatus }))
    setInitialLoaded(true)
  }, [dispatch, currentPage, activeStatus])

  useEffect(() => {
    loadInbox()
  }, [loadInbox])

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (hasScanning) {
      pollRef.current = setInterval(() => {
        dispatch(fetchInbox({ page: currentPage, status: activeStatus }))
      }, SCAN_POLL_INTERVAL)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [hasScanning, dispatch, currentPage, activeStatus])

  const handleReview = async () => {
    if (!reviewModal) return
    if (reviewModal.action === 'approve' && reviewModal.submission.scan_status !== 'safe') {
      setErrorMsg('Cannot approve: file has not passed security scanning yet.')
      setReviewModal(null)
      setTimeout(() => setErrorMsg(''), 5000)
      return
    }
    const result = await dispatch(reviewInboxItem({ id: reviewModal.submission.id, action: reviewModal.action, note: reviewNote }))
    if (reviewInboxItem.rejected.match(result)) {
      setErrorMsg(result.payload || 'Action failed.')
      setTimeout(() => setErrorMsg(''), 5000)
    }
    setReviewModal(null)
    setReviewNote('')
    loadInbox()
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    const sub = deleteConfirm
    const isInfected = ['infected', 'scan_failed'].includes(sub.scan_status)
    let result
    if (isInfected) {
      result = await dispatch(deleteInfectedFile(sub.id))
      if (deleteInfectedFile.rejected.match(result)) {
        setErrorMsg(result.payload || 'Delete failed.')
        setTimeout(() => setErrorMsg(''), 5000)
      }
    } else {
      result = await dispatch(removeInboxItem(sub.id))
      if (removeInboxItem.rejected.match(result)) {
        setErrorMsg(result.payload || 'Delete failed.')
        setTimeout(() => setErrorMsg(''), 5000)
      }
    }
    setDeleteConfirm(null)
    loadInbox()
  }

  const sourceIcon = (src) =>
    ({ file_request: 'fa-inbox', direct_share: 'fa-share-alt', anonymous: 'fa-user-secret' }[src] || 'fa-file')

  const statusTabs = [
    { id: '',             label: 'All',      count: Object.values(inboxStatusCounts || {}).reduce((a, b) => a + b, 0) },
    { id: 'pending',      label: 'Pending',  count: inboxStatusCounts?.pending },
    { id: 'needs_action', label: 'Action',   count: inboxStatusCounts?.needs_action },
    { id: 'approved',     label: 'Approved', count: inboxStatusCounts?.approved },
    { id: 'rejected',     label: 'Rejected', count: inboxStatusCounts?.rejected },
    { id: 'complete',     label: 'Complete', count: inboxStatusCounts?.complete },
  ]

  const showSpinner = !initialLoaded && inboxLoading

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Submission Inbox</h2>
          <p className="text-sm text-slate-500">Files submitted via your requests — review, view, download, or delete.</p>
        </div>
        {hasScanning && (
          <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 font-semibold">
            <i className="fas fa-spinner fa-spin text-[10px]"></i>
            Auto-refreshing scan status…
          </div>
        )}
      </div>

      {scanStatusCounts && Object.keys(scanStatusCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(scanStatusCounts).map(([s, n]) =>
            n > 0 && (
              <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                <ScanBadge status={s} />
                <span className="text-xs font-bold text-slate-600 ml-1">{n}</span>
              </div>
            )
          )}
        </div>
      )}

      {errorMsg && <Alert type="error" message={errorMsg} className="rounded-xl" />}

      <div className="flex gap-1.5 flex-wrap">
        {statusTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveStatus(t.id); setCurrentPage(1) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              activeStatus === t.id
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeStatus === t.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {showSpinner ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <i className="fas fa-spinner fa-spin text-xl mr-2"></i>Loading inbox…
        </div>
      ) : inbox.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-inbox text-2xl text-slate-400"></i>
          </div>
          <p className="text-slate-500 font-semibold">Inbox is empty</p>
          <p className="text-slate-400 text-sm mt-1">Files submitted via your requests will appear here.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {inbox.map((sub) => {
            const isInfected   = ['infected', 'scan_failed'].includes(sub.scan_status)
            const isSafe       = sub.scan_status === 'safe'
            const isScanning   = ['scanning', 'pending'].includes(sub.scan_status)
            const downloadable = isSafe && sub.file_url
            const viewable     = isSafe && sub.file_url

            return (
              <Card key={sub.id} className={`p-4 sm:p-5 ${isInfected ? 'border-red-100 bg-red-50/30' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isInfected ? 'bg-red-100' : isSafe ? 'bg-emerald-50' : 'bg-indigo-50'}`}>
                    <i className={`fas ${isInfected ? 'fa-bug text-red-500' : isSafe ? 'fa-shield-halved text-emerald-500' : sourceIcon(sub.source_type) + ' text-indigo-500'}`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs">{sub.original_filename}</p>
                      <StatusBadge status={sub.status} />
                      <ScanBadge status={sub.scan_status} />
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-400">
                      {sub.submitter_email && <span><i className="fas fa-envelope mr-1"></i>{sub.submitter_email}</span>}
                      {sub.submitter_name  && <span><i className="fas fa-user mr-1"></i>{sub.submitter_name}</span>}
                      {sub.request_title   && <span><i className="fas fa-inbox mr-1"></i>{sub.request_title}</span>}
                      <span><i className="fas fa-clock mr-1"></i>{new Date(sub.submitted_at).toLocaleString()}</span>
                    </div>
                    {isInfected && sub.scan_result && (
                      <div className="mt-2 px-3 py-2 bg-red-50 rounded-lg border border-red-100 text-xs text-red-700 flex items-start gap-1.5">
                        <i className="fas fa-triangle-exclamation mt-0.5 flex-shrink-0"></i>
                        <span>{sub.scan_result}</span>
                      </div>
                    )}
                    {sub.review_note && (
                      <p className="mt-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg">{sub.review_note}</p>
                    )}
                    {sub.rejection_reason && (
                      <p className="mt-1.5 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
                        <i className="fas fa-circle-exclamation mr-1"></i>{sub.rejection_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                    {viewable && (
                      <button onClick={() => setViewFile(sub)} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-1">
                        <i className="fas fa-eye text-[10px]"></i> View
                      </button>
                    )}
                    {downloadable && (
                      <a href={sub.file_url} download={sub.original_filename} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-1">
                        <i className="fas fa-download text-[10px]"></i> Download
                      </a>
                    )}
                    {isScanning && (
                      <span className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                        <i className="fas fa-spinner fa-spin text-[10px]"></i>Scanning
                      </span>
                    )}
                    {sub.status === 'pending' && !isInfected && (
                      <>
                        <button
                          onClick={() => { setReviewModal({ submission: sub, action: 'approve' }); setReviewNote('') }}
                          disabled={!isSafe}
                          title={!isSafe ? 'Wait for security scan to complete' : undefined}
                          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <i className="fas fa-check text-[10px]"></i> Approve
                        </button>
                        <button
                          onClick={() => { setReviewModal({ submission: sub, action: 'needs_action' }); setReviewNote('') }}
                          className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-100 transition-all flex items-center gap-1"
                        >
                          <i className="fas fa-flag text-[10px]"></i> Flag
                        </button>
                        <button
                          onClick={() => { setReviewModal({ submission: sub, action: 'reject' }); setReviewNote('') }}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-all flex items-center gap-1"
                        >
                          <i className="fas fa-xmark text-[10px]"></i> Reject
                        </button>
                      </>
                    )}
                    {sub.status === 'approved' && (
                      <button
                        onClick={() => { setReviewModal({ submission: sub, action: 'complete' }); setReviewNote('') }}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-1.5"
                      >
                        <i className="fas fa-circle-check text-[10px]"></i> Complete
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteConfirm(sub)}
                      disabled={deletingFile || removingItem}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-40 ${
                        isInfected ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={isInfected ? 'Permanently delete infected file' : 'Delete this file from inbox'}
                    >
                      <i className="fas fa-trash text-[10px]"></i>
                      {isInfected ? 'Delete' : 'Remove'}
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {reviewModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-1 capitalize">{reviewModal.action.replace(/_/g, ' ')} Submission</h3>
            <p className="text-sm text-slate-500 mb-4">File: <span className="font-semibold text-slate-700">{reviewModal.submission.original_filename}</span></p>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder={reviewModal.action === 'reject' ? 'Rejection reason (recommended)…' : 'Optional note…'}
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 focus:outline-none resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setReviewModal(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200">Cancel</button>
              <button
                onClick={handleReview}
                className={`flex-1 py-3 text-white rounded-xl font-bold text-sm transition-all ${
                  reviewModal.action === 'reject'   ? 'bg-red-500 hover:bg-red-600'
                  : reviewModal.action === 'approve'  ? 'bg-emerald-500 hover:bg-emerald-600'
                  : reviewModal.action === 'complete' ? 'bg-blue-500 hover:bg-blue-600'
                  : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <ConfirmModal
          title={
            ['infected', 'scan_failed'].includes(deleteConfirm.scan_status)
              ? 'Permanently delete infected file?'
              : `Remove "${deleteConfirm.original_filename}"?`
          }
          body={
            ['infected', 'scan_failed'].includes(deleteConfirm.scan_status)
              ? `"${deleteConfirm.original_filename}" contains malware and will be permanently deleted. This cannot be undone.`
              : `This will remove "${deleteConfirm.original_filename}" from your inbox${deleteConfirm.scan_status === 'safe' ? ' and delete it from storage' : ''}. This cannot be undone.`
          }
          confirmLabel={['infected', 'scan_failed'].includes(deleteConfirm.scan_status) ? 'Delete Permanently' : 'Remove File'}
          confirmClass={['infected', 'scan_failed'].includes(deleteConfirm.scan_status) ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-800'}
          loading={deletingFile || removingItem}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={handleDelete}
        />
      )}

      {viewFile && <FileViewerModal file={viewFile} onClose={() => setViewFile(null)} />}
    </div>
  )
}

// ─── Main Sharing page ────────────────────────────────────────────────────────

export default function Sharing() {
  const dispatch = useDispatch()
  const { shares, zipShares, inbox, inboxStatusCounts } = useSelector((s) => s.sharing)
  const [activeTab, setActiveTab] = useState('shares')

  // Initial data load on mount — each panel manages its own subsequent fetches
  useEffect(() => {
    dispatch(fetchShares({ page: 1 }))
    dispatch(fetchZipShares({ page: 1 }))
    dispatch(fetchRequests({ page: 1 }))
    dispatch(fetchInbox())
    dispatch(fetchGlobalAnalytics())
    dispatch(fetchAllFiles())
  }, [dispatch])

  const pendingCount = inboxStatusCounts?.pending || 0
  const totalShares  = (shares?.length || 0) + (zipShares?.length || 0)

  const tabs = [
    { id: 'shares',    label: 'Shares',    icon: 'fa-share-nodes',     count: totalShares || null },
    { id: 'analytics', label: 'Analytics', icon: 'fa-chart-line',      count: null },
    { id: 'requests',  label: 'Requests',  icon: 'fa-inbox',           count: null },
    { id: 'inbox',     label: 'Inbox',     icon: 'fa-tray-arrow-down', count: pendingCount || null },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Sharing Hub</h1>
              <p className="text-sm text-slate-500 mt-1">Share files · ZIP bundles · File requests · Submission inbox</p>
            </div>
            <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
          </div>

          {activeTab === 'shares'    && <SharesPanel />}
          {activeTab === 'analytics' && <AnalyticsPanel />}
          {activeTab === 'requests'  && <RequestsPanel />}
          {activeTab === 'inbox'     && <InboxPanel />}
        </div>
      </div>
    </div>
  )
}