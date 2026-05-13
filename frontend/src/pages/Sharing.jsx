import { useEffect, useState, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import {
  fetchShares,
  share,
  revoke,
  createZipShare,
  fetchZipShares,
  revokeZipShare,
  fetchGlobalAnalytics,
  fetchRequests,
  createRequest,
  closeRequest,
  fetchInbox,
  reviewInboxItem,
  deleteInfectedFile,
} from '@/store/sharingSlice'
import { fetchFiles } from '@/store/filesSlice'
import Alert from '@/components/ui/Alert'

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) => (n ?? 0).toLocaleString()

const buildRecipientUploadUrl = (recipient) => {
  const url = recipient.upload_url || ''
  if (url.startsWith('http')) return url
  const match = url.match(/\/upload\/([0-9a-f-]{36})\/?$/i)
  return match
    ? `${window.location.origin}/request/upload/${match[1]}`
    : `${window.location.origin}/request/upload/${recipient.id}`
}

const buildRequestUploadUrl = (req) => {
  const recipients = req.recipients || []
  if (recipients.length === 1) return buildRecipientUploadUrl(recipients[0])
  if (req.upload_token) return `${window.location.origin}/request/upload/${req.upload_token}`
  return `${window.location.origin}/request/upload/${req.id}`
}

const buildShareUrl = (s) => {
  const url = s.share_url || ''
  if (url.startsWith('http')) return url
  return `${window.location.origin}/share/${s.share_token || s.id}`
}

const buildZipShareUrl = (zs) => {
  const url = zs.share_url || ''
  if (url.startsWith('http')) return url
  return `${window.location.origin}/zip-share/${zs.share_token || zs.id}`
}

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
      {status?.replace('_', ' ')}
    </span>
  )
}

const ScanBadge = ({ status }) => {
  const cfg = {
    pending:     { cls: 'bg-slate-50 text-slate-500 border-slate-200',       icon: 'fa-clock',               label: 'Pending Scan' },
    scanning:    { cls: 'bg-blue-50 text-blue-600 border-blue-200',           icon: 'fa-spinner fa-spin',     label: 'Scanning…'    },
    safe:        { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',  icon: 'fa-shield-halved',       label: 'Safe'         },
    infected:    { cls: 'bg-red-50 text-red-700 border-red-200',              icon: 'fa-bug',                 label: 'Infected'     },
    scan_failed: { cls: 'bg-orange-50 text-orange-600 border-orange-200',     icon: 'fa-triangle-exclamation',label: 'Scan Failed'  },
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
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 py-3 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${confirmClass}`}>
            {loading ? <><i className="fas fa-spinner fa-spin text-xs"></i>Please wait…</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function EmailChipInput({ label, helper, value, onChange }) {
  const [raw, setRaw] = useState('')

  const parse = (text) => {
    const list = text.split(/[,;\s\n]+/).map((e) => e.trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
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
        {label}{helper && <span className="normal-case text-slate-400 font-normal ml-1">{helper}</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => { if (raw) { parse(raw); setRaw('') } }}
          placeholder="name@example.com, …  (press Enter or comma)"
          className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none text-sm focus:ring-2 focus:ring-indigo-200"
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

// ─── File Search + Selector (reusable) ────────────────────────────────────────

function FileSelector({ files, selectedFiles, onToggle, multiSelect = true, label = 'Files' }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return files
    const q = search.toLowerCase()
    return files.filter((f) =>
      f.original_name?.toLowerCase().includes(q) ||
      f.mime_type?.toLowerCase().includes(q)
    )
  }, [files, search])

  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">
        {label} *{' '}
        <span className="normal-case text-slate-400 font-normal">
          {multiSelect ? '(select one or more)' : '(select one)'}
        </span>
      </label>

      {/* Search bar */}
      <div className="relative mb-1.5">
        <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files by name or type…"
          className="w-full pl-8 pr-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 focus:outline-none"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <i className="fas fa-xmark text-xs"></i>
          </button>
        )}
      </div>

      <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
        {files.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No files available. Upload files first.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No files match "{search}"</p>
        ) : filtered.map((f) => {
          const isSelected = multiSelect
            ? selectedFiles.includes(f.id)
            : selectedFiles === f.id

          return (
            <label
              key={f.id}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}
            >
              <input
                type={multiSelect ? 'checkbox' : 'radio'}
                checked={isSelected}
                onChange={() => onToggle(f.id)}
                className="w-4 h-4 rounded accent-indigo-600 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 truncate font-medium">{f.original_name}</p>
                <p className="text-[10px] text-slate-400">{f.mime_type || 'Unknown type'}</p>
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">{f.file_size_display}</span>
            </label>
          )
        })}
      </div>

      {multiSelect && selectedFiles.length > 0 && (
        <p className="text-xs text-indigo-600 font-semibold mt-1.5">
          <i className="fas fa-check-circle mr-1"></i>
          {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
          {search && filtered.length !== files.length && (
            <span className="text-slate-400 font-normal ml-1">
              (showing {filtered.length} of {files.length})
            </span>
          )}
        </p>
      )}
    </div>
  )
}

// ─── 1. Shares panel (single-file + zip unified) ──────────────────────────────

function SharesPanel({ files }) {
  const dispatch = useDispatch()
  const { shares, sharing, zipShares, zipSharing, error } = useSelector((s) => s.sharing)

  const [showForm,       setShowForm]       = useState(false)
  const [shareMode,      setShareMode]      = useState('single') // 'single' | 'zip'
  const [revokeConfirm,  setRevokeConfirm]  = useState(null)  // { id, type: 'single'|'zip' }
  const [successMsg,     setSuccessMsg]     = useState('')
  const [emails,         setEmails]         = useState([])
  const [selectedFiles,  setSelectedFiles]  = useState([])
  const [copiedId,       setCopiedId]       = useState(null)

  const { register: field, handleSubmit, reset, watch } = useForm({
    defaultValues: { expiration_hours: 24, message: '', zip_name: 'shared_files' },
  })

  useEffect(() => {
    dispatch(fetchShares({ page: 1 }))
    dispatch(fetchZipShares({ page: 1 }))
  }, [dispatch])

  // Auto-switch mode based on file count
  useEffect(() => {
    if (selectedFiles.length > 1 && shareMode === 'single') {
      setShareMode('zip')
    } else if (selectedFiles.length <= 1 && shareMode === 'zip' && selectedFiles.length > 0) {
      setShareMode('single')
    }
  }, [selectedFiles.length])

  const toggleFile = (id) =>
    setSelectedFiles((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const isSingleValid   = emails.length > 0 && selectedFiles.length === 1
  const isZipValid      = emails.length > 0 && selectedFiles.length >= 2
  const isFormValid     = shareMode === 'single' ? isSingleValid : isZipValid
  const isSubmitting    = sharing || zipSharing

  const onSubmit = async (data) => {
    if (!isFormValid) return

    let result
    if (shareMode === 'zip') {
      // Multi-file → ZIP
      result = await dispatch(createZipShare({
        file_ids:         selectedFiles,
        recipient_emails: emails,
        expiration_hours: Number(data.expiration_hours),
        message:          data.message || '',
        zip_name:         (data.zip_name || 'shared_files').replace(/\.zip$/, '') + '.zip',
      }))
      if (createZipShare.fulfilled.match(result)) {
        const p = result.payload
        setSuccessMsg(
          `✓ ${p.file_count} files bundled → ${p.count} unique ZIP link${p.count !== 1 ? 's' : ''} created. ` +
          `Each recipient gets one download link for all files.`
        )
      } else {
        setSuccessMsg(`⚠ ZIP share failed: ${result.payload || 'Unknown error'}`)
      }
    } else {
      // Single-file → individual share per recipient
      result = await dispatch(share({
        file_id:          selectedFiles[0],
        recipient_emails: emails,
        expiration_hours: Number(data.expiration_hours),
        message:          data.message || '',
      }))
      if (share.fulfilled.match(result)) {
        const count = result.payload.count ?? 0
        setSuccessMsg(`✓ File shared with ${emails.length} recipient${emails.length !== 1 ? 's' : ''}. ${count} unique link${count !== 1 ? 's' : ''} sent.`)
      } else {
        setSuccessMsg(`⚠ Share failed: ${result.payload || 'Unknown error'}`)
      }
    }

    reset()
    setEmails([])
    setSelectedFiles([])
    setShowForm(false)
    setTimeout(() => setSuccessMsg(''), 8000)
    dispatch(fetchShares({ page: 1 }))
    dispatch(fetchZipShares({ page: 1 }))
  }

  const handleRevoke = async ({ id, type }) => {
    if (type === 'zip') {
      await dispatch(revokeZipShare(id))
    } else {
      await dispatch(revoke(id))
    }
    setRevokeConfirm(null)
    dispatch(fetchShares({ page: 1 }))
    dispatch(fetchZipShares({ page: 1 }))
  }

  const copyUrl = (url, id) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Merge single + zip shares, sorted by date
  const allShares = useMemo(() => {
    const singles = shares.map((s) => ({ ...s, _type: 'single' }))
    const zips    = zipShares.map((z) => ({ ...z, _type: 'zip' }))
    return [...singles, ...zips].sort(
      (a, b) => new Date(b.shared_at) - new Date(a.shared_at)
    )
  }, [shares, zipShares])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Shared Files</h2>
          <p className="text-sm text-slate-500">
            1 file → unique link per recipient. 2+ files → ZIP bundle per recipient.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm"
        >
          <i className={`fas ${showForm ? 'fa-xmark' : 'fa-share-nodes'}`}></i>
          {showForm ? 'Cancel' : 'Share Files'}
        </button>
      </div>

      {error      && <Alert type="error"   message={error}      className="rounded-xl" />}
      {successMsg && <Alert type="success" message={successMsg} className="rounded-xl" />}

      {showForm && (
        <Card className="p-6">
          <h3 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
            <i className="fas fa-share-alt text-indigo-500"></i> New Share
          </h3>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* File selector with search */}
            <FileSelector
              files={files}
              selectedFiles={selectedFiles}
              onToggle={toggleFile}
              multiSelect={true}
              label="Files"
            />

            {/* Mode indicator */}
            {selectedFiles.length > 0 && (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-semibold ${
                selectedFiles.length === 1
                  ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
                  : 'bg-violet-50 border-violet-100 text-violet-700'
              }`}>
                <i className={`fas ${selectedFiles.length === 1 ? 'fa-link' : 'fa-file-zipper'} text-sm`}></i>
                <div>
                  {selectedFiles.length === 1
                    ? 'Single file → each recipient gets a unique download link'
                    : `${selectedFiles.length} files → bundled as a ZIP for each recipient`}
                </div>
              </div>
            )}

            {/* ZIP name — only if multi-file */}
            {selectedFiles.length > 1 && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">ZIP File Name</label>
                <div className="flex items-center gap-0">
                  <input
                    type="text"
                    {...field('zip_name')}
                    placeholder="shared_files"
                    className="flex-1 px-4 py-3 bg-slate-50 rounded-l-xl border-none text-sm focus:ring-2 focus:ring-indigo-200"
                  />
                  <span className="px-3 py-3 bg-slate-100 rounded-r-xl text-sm text-slate-500 font-medium border-l border-slate-200">.zip</span>
                </div>
              </div>
            )}

            {/* Expiry */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Expires After</label>
              <select {...field('expiration_hours')} className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-200">
                <option value="1">1 hour</option>
                <option value="24">1 day</option>
                <option value="72">3 days</option>
                <option value="168">1 week</option>
                <option value="720">30 days</option>
              </select>
            </div>

            {/* Recipients */}
            <EmailChipInput
              label="Recipients *"
              helper="(press Enter or comma — each gets their own unique link)"
              value={emails}
              onChange={setEmails}
            />

            {/* Message */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Message (optional)</label>
              <input
                type="text"
                {...field('message')}
                placeholder="Add a personal note shown in the email…"
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none text-sm focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            {/* Info box */}
            {selectedFiles.length > 0 && emails.length > 0 && (
              <div className="flex items-start gap-3 px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <i className="fas fa-info-circle text-indigo-400 mt-0.5 flex-shrink-0"></i>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  {selectedFiles.length === 1
                    ? <>This creates <strong>{emails.length} unique link{emails.length !== 1 ? 's' : ''}</strong> — one per recipient, each with their own private download URL.</>
                    : <>This bundles <strong>{selectedFiles.length} files into {emails.length} ZIP archive{emails.length !== 1 ? 's' : ''}</strong> — one ZIP download link per recipient. Clean and simple.</>
                  }
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="submit"
                disabled={isSubmitting || !isFormValid}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting
                  ? <><i className="fas fa-spinner fa-spin"></i>Sharing…</>
                  : selectedFiles.length > 1
                    ? <><i className="fas fa-file-zipper"></i>Create ZIP Share ({selectedFiles.length} files, {emails.length || '…'} recipients)</>
                    : <><i className="fas fa-paper-plane"></i>Share with {emails.length || '…'} recipient{emails.length !== 1 ? 's' : ''}</>
                }
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="sm:w-auto px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">Cancel</button>
            </div>
          </form>
        </Card>
      )}

      {allShares.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-share-nodes text-2xl text-slate-400"></i>
          </div>
          <p className="text-slate-500 font-semibold">No shares yet</p>
          <p className="text-slate-400 text-sm mt-1">Share files above — 1 file gets a direct link, multiple files get a ZIP bundle.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {allShares.map((s) => {
            const isZip  = s._type === 'zip'
            const url    = isZip ? buildZipShareUrl(s) : buildShareUrl(s)
            const copied = copiedId === s.id

            return (
              <Card key={`${s._type}-${s.id}`} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isZip ? 'bg-violet-100' : 'bg-indigo-100'}`}>
                        <i className={`fas ${isZip ? 'fa-file-zipper text-violet-600' : 'fa-file text-indigo-600'} text-xs`}></i>
                      </div>
                      {isZip ? (
                        <div>
                          <p className="text-sm font-bold text-slate-900">{s.zip_name}</p>
                          <p className="text-[10px] text-violet-500 font-semibold">{s.file_count} files bundled</p>
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-slate-900 truncate">{s.file_name}</p>
                      )}
                      <StatusBadge status={s.status} />
                      {isZip && <span className="text-[10px] px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full font-bold border border-violet-100">ZIP</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      <i className="fas fa-envelope text-slate-400 mr-1"></i>{s.recipient_email}
                    </p>
                    <p className="text-[10px] text-slate-300 mt-0.5 truncate max-w-xs" title={url}>
                      <i className="fas fa-link mr-1"></i>{url}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => copyUrl(url, s.id)}
                      className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-all flex items-center gap-1.5"
                    >
                      <i className={`fas ${copied ? 'fa-check text-green-600' : 'fa-copy'}`}></i>
                      {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                    {s.status === 'active' && (
                      <button
                        onClick={() => setRevokeConfirm({ id: s.id, type: s._type })}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-all flex items-center gap-1.5"
                      >
                        <i className="fas fa-ban text-[11px]"></i> Revoke
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ...(!isZip ? [{ icon: 'fa-eye', label: 'Views', value: fmt(s.view_count) }] : []),
                    { icon: 'fa-download', label: 'Downloads', value: fmt(s.download_count) },
                    { icon: 'fa-calendar', label: 'Shared',    value: new Date(s.shared_at).toLocaleDateString() },
                    { icon: 'fa-clock',    label: 'Expires',   value: new Date(s.expires_at).toLocaleDateString() },
                    ...(isZip ? [{ icon: 'fa-files', label: 'Files', value: s.file_count }] : []),
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="bg-slate-50 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <i className={`fas ${icon} text-[9px]`}></i>{label}
                      </p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                {/* ZIP file list preview */}
                {isZip && s.files_info?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Files in ZIP</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.files_info.map((f) => (
                        <span key={f.id} className="text-[10px] px-2 py-1 bg-violet-50 text-violet-700 rounded-lg font-medium">
                          {f.original_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {s.has_been_accessed && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600">
                    <i className="fas fa-circle-check text-[10px]"></i>
                    {isZip ? 'ZIP downloaded' : 'File accessed'} · Last: {s.accessed_at ? new Date(s.accessed_at).toLocaleString() : '—'}
                  </div>
                )}

                {s.message && (
                  <div className="mt-3 px-4 py-2.5 bg-blue-50 border-l-2 border-blue-300 rounded-r-xl text-xs text-blue-800">
                    <i className="fas fa-comment-alt mr-1.5"></i>"{s.message}"
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {revokeConfirm && (
        <ConfirmModal
          title={`Revoke ${revokeConfirm.type === 'zip' ? 'ZIP share' : 'share'}?`}
          body="The recipient will no longer be able to download using this link."
          confirmLabel="Revoke"
          confirmClass="bg-red-500 hover:bg-red-600"
          onCancel={() => setRevokeConfirm(null)}
          onConfirm={() => handleRevoke(revokeConfirm)}
        />
      )}
    </div>
  )
}

// ─── 2. Analytics panel (no event log) ───────────────────────────────────────

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

      {/* Combined totals */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile icon="fa-share-nodes"  label="Total Shares"     value={fmt(totals?.total_shares)}    color="indigo" />
        <StatTile icon="fa-eye"          label="Total Views"      value={fmt(totals?.total_views)}     color="blue"   />
        <StatTile icon="fa-download"     label="Total Downloads"  value={fmt(totals?.total_downloads)} color="emerald"/>
        <StatTile icon="fa-circle-check" label="Active"           value={fmt(totals?.active_count)}    color="green"  />
        <StatTile icon="fa-clock"        label="Expired"          value={fmt(totals?.expired_count)}   color="amber"  />
        <StatTile icon="fa-ban"          label="Revoked"          value={fmt(totals?.revoked_count)}   color="red"    />
      </div>

      {/* Breakdown by type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-file text-indigo-600 text-xs"></i>
            </div>
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
            <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-file-zipper text-violet-600 text-xs"></i>
            </div>
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
            <h3 className="text-sm font-bold text-slate-900">Top Downloaded Single-file Shares</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {top_shares.map((s, i) => (
              <div key={s.id} className="flex items-center gap-4 px-6 py-4">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : 'bg-orange-50 text-orange-600'
                }`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.file_name}</p>
                  <p className="text-xs text-slate-400">{s.recipient_email}</p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-blue-600 font-semibold">
                    <i className="fas fa-eye text-[10px]"></i>{fmt(s.view_count)}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <i className="fas fa-download text-[10px]"></i>{fmt(s.download_count)}
                  </span>
                  <StatusBadge status={s.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {top_zips.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <i className="fas fa-file-zipper text-violet-500"></i>
            <h3 className="text-sm font-bold text-slate-900">Top Downloaded ZIP Shares</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {top_zips.map((z, i) => (
              <div key={z.id} className="flex items-center gap-4 px-6 py-4">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{z.zip_name}</p>
                  <p className="text-xs text-slate-400">{z.recipient_email} · {z.file_count} files</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <i className="fas fa-download text-[10px]"></i>{fmt(z.download_count)}
                  </span>
                  <StatusBadge status={z.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── 3. File Requests panel (unchanged) ───────────────────────────────────────

function RequestsPanel() {
  const dispatch = useDispatch()
  const { requests, requestLoading, error } = useSelector((s) => s.sharing)

  const [showForm,        setShowForm]        = useState(false)
  const [closeConfirm,    setCloseConfirm]    = useState(null)
  const [successMsg,      setSuccessMsg]      = useState('')
  const [copiedId,        setCopiedId]        = useState(null)
  const [recipientEmails, setRecipientEmails] = useState([])

  const { register: field, handleSubmit, reset, formState: { errors } } = useForm({
    mode: 'onTouched',
    defaultValues: { expiration_hours: 168, max_files: 10, title: '', description: '' },
  })

  useEffect(() => { dispatch(fetchRequests()) }, [dispatch])

  const onSubmit = async (data) => {
    const payload = {
      title:            data.title,
      description:      data.description || '',
      recipient_emails: recipientEmails,
      recipient_email:  '',
      expiration_hours: Number(data.expiration_hours),
      max_files:        Number(data.max_files),
    }
    const result = await dispatch(createRequest(payload))
    if (createRequest.fulfilled.match(result)) {
      reset()
      setRecipientEmails([])
      setShowForm(false)
      const count = recipientEmails.length
      setSuccessMsg(
        count > 0
          ? `✓ File request created. ${count} unique upload link${count !== 1 ? 's' : ''} sent.`
          : '✓ File request created. Copy the link to share.'
      )
      setTimeout(() => setSuccessMsg(''), 6000)
    }
  }

  const copyLink = (req) => {
    const url = buildRequestUploadUrl(req)
    navigator.clipboard.writeText(url)
    setCopiedId(req.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleClose = async (id) => {
    await dispatch(closeRequest(id))
    setCloseConfirm(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">File Requests</h2>
          <p className="text-sm text-slate-500">Ask anyone to upload files to your inbox — no login required.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm"
        >
          <i className={`fas ${showForm ? 'fa-xmark' : 'fa-plus'}`}></i>
          {showForm ? 'Cancel' : 'New Request'}
        </button>
      </div>

      {error      && <Alert type="error"   message={error}      className="rounded-xl" />}
      {successMsg && <Alert type="success" message={successMsg} className="rounded-xl" />}

      {showForm && (
        <Card className="p-6">
          <h3 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
            <i className="fas fa-inbox text-indigo-500"></i> Create Upload Request
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Title *</label>
              <input
                type="text"
                {...field('title', { required: 'Title is required.' })}
                placeholder="e.g. Q4 Invoice Submission"
                className={`w-full px-4 py-3 bg-slate-50 rounded-xl border-none text-sm focus:ring-2 focus:ring-indigo-200 ${errors.title ? 'ring-2 ring-red-300' : ''}`}
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Description</label>
              <textarea {...field('description')} rows={3} placeholder="What files do you need?" className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none text-sm focus:ring-2 focus:ring-indigo-200 resize-none" />
            </div>

            <EmailChipInput
              label="Recipients"
              helper="(optional — each gets their own unique upload link)"
              value={recipientEmails}
              onChange={setRecipientEmails}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Expires After</label>
                <select {...field('expiration_hours')} className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none text-sm focus:ring-2 focus:ring-indigo-200">
                  <option value="24">1 day</option>
                  <option value="72">3 days</option>
                  <option value="168">1 week</option>
                  <option value="720">30 days</option>
                  <option value="8760">1 year</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Max Files</label>
                <input type="number" min="1" max="50" {...field('max_files')} className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none text-sm focus:ring-2 focus:ring-indigo-200" />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={requestLoading}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {requestLoading ? <><i className="fas fa-spinner fa-spin"></i>Creating…</> : <><i className="fas fa-link"></i>Create Request</>}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">Cancel</button>
            </div>
          </form>
        </Card>
      )}

      {requestLoading && !showForm ? (
        <div className="flex items-center justify-center py-16 text-slate-400"><i className="fas fa-spinner fa-spin text-xl mr-2"></i>Loading…</div>
      ) : requests.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-inbox text-2xl text-slate-400"></i>
          </div>
          <p className="text-slate-500 font-semibold">No file requests yet</p>
          <p className="text-slate-400 text-sm mt-1">Create a request to collect files from anyone.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const recipients = req.recipients || []
            return (
              <Card key={req.id} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900">{req.title}</p>
                      <StatusBadge status={req.status} />
                      {req.is_expired && <span className="text-xs text-red-500 font-semibold">Expired</span>}
                    </div>
                    {req.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{req.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                      <span><i className="fas fa-file mr-1"></i>{req.submission_count}/{req.max_files} submissions</span>
                      {req.expires_at && <span><i className="fas fa-clock mr-1"></i>Expires {new Date(req.expires_at).toLocaleDateString()}</span>}
                      {recipients.length > 0 && <span><i className="fas fa-users mr-1"></i>{recipients.length} recipient{recipients.length !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => copyLink(req)}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-all flex items-center gap-1.5">
                      <i className={`fas ${copiedId === req.id ? 'fa-check' : 'fa-copy'}`}></i>
                      {copiedId === req.id ? 'Copied!' : recipients.length <= 1 ? 'Copy Link' : 'Copy First Link'}
                    </button>
                    {req.status === 'open' && (
                      <button onClick={() => setCloseConfirm(req.id)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-all">Close</button>
                    )}
                  </div>
                </div>

                {recipients.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Upload Links · {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
                    </p>
                    <div className="space-y-1.5">
                      {recipients.map((r) => {
                        const rUrl = buildRecipientUploadUrl(r)
                        return (
                          <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-2 min-w-0">
                              <i className="fas fa-user text-slate-300 text-[11px] flex-shrink-0"></i>
                              <span className="text-xs font-medium text-slate-700 truncate">{r.email}</span>
                              {r.upload_count > 0 && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                                  ✓ {r.upload_count} uploaded
                                </span>
                              )}
                            </div>
                            <button onClick={() => navigator.clipboard.writeText(rUrl)}
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex-shrink-0 flex items-center gap-1 transition-colors">
                              <i className="fas fa-copy text-[10px]"></i> Copy
                            </button>
                          </div>
                        )
                      })}
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

// ─── 4. Submission Inbox panel (unchanged) ────────────────────────────────────

function InboxPanel() {
  const dispatch = useDispatch()
  const { inbox, inboxLoading, inboxStatusCounts, scanStatusCounts, deletingFile } = useSelector((s) => s.sharing)

  const [activeStatus,  setActiveStatus]  = useState('')
  const [reviewModal,   setReviewModal]   = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [reviewNote,    setReviewNote]    = useState('')
  const [errorMsg,      setErrorMsg]      = useState('')

  useEffect(() => { dispatch(fetchInbox({ status: activeStatus })) }, [dispatch, activeStatus])

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
    dispatch(fetchInbox({ status: activeStatus }))
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    const result = await dispatch(deleteInfectedFile(deleteConfirm.id))
    if (deleteInfectedFile.rejected.match(result)) {
      setErrorMsg(result.payload || 'Delete failed.')
      setTimeout(() => setErrorMsg(''), 5000)
    }
    setDeleteConfirm(null)
  }

  const sourceIcon = (src) => ({ file_request: 'fa-inbox', direct_share: 'fa-share-alt', anonymous: 'fa-user-secret' }[src] || 'fa-file')

  const statusTabs = [
    { id: '',             label: 'All',      count: Object.values(inboxStatusCounts || {}).reduce((a, b) => a + b, 0) },
    { id: 'pending',      label: 'Pending',  count: inboxStatusCounts?.pending },
    { id: 'needs_action', label: 'Action',   count: inboxStatusCounts?.needs_action },
    { id: 'approved',     label: 'Approved', count: inboxStatusCounts?.approved },
    { id: 'rejected',     label: 'Rejected', count: inboxStatusCounts?.rejected },
    { id: 'complete',     label: 'Complete', count: inboxStatusCounts?.complete },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Submission Inbox</h2>
        <p className="text-sm text-slate-500">Files submitted via your requests — review, download, or delete.</p>
      </div>

      {scanStatusCounts && Object.keys(scanStatusCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(scanStatusCounts).map(([s, n]) => n > 0 && (
            <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-slate-100 shadow-sm">
              <ScanBadge status={s} /><span className="text-xs font-bold text-slate-600 ml-1">{n}</span>
            </div>
          ))}
        </div>
      )}

      {errorMsg && <Alert type="error" message={errorMsg} className="rounded-xl" />}

      <div className="flex gap-1.5 flex-wrap">
        {statusTabs.map((t) => (
          <button key={t.id} onClick={() => setActiveStatus(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              activeStatus === t.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
            }`}>
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeStatus === t.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {inboxLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400"><i className="fas fa-spinner fa-spin text-xl mr-2"></i>Loading inbox…</div>
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

            return (
              <Card key={sub.id} className={`p-5 ${isInfected ? 'border-red-100' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isInfected ? 'bg-red-50' : 'bg-indigo-50'}`}>
                    <i className={`fas ${isInfected ? 'fa-bug text-red-500' : sourceIcon(sub.source_type) + ' text-indigo-500'}`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900 truncate">{sub.original_filename}</p>
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
                        <i className="fas fa-triangle-exclamation mt-0.5 flex-shrink-0"></i><span>{sub.scan_result}</span>
                      </div>
                    )}
                    {sub.review_note && <p className="mt-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg">{sub.review_note}</p>}
                    {sub.rejection_reason && <p className="mt-1.5 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg"><i className="fas fa-circle-exclamation mr-1"></i>{sub.rejection_reason}</p>}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                    {downloadable && (
                      <a href={sub.file_url} download={sub.original_filename}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-1">
                        <i className="fas fa-download text-[10px]"></i> Download
                      </a>
                    )}
                    {isScanning && (
                      <span className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                        <i className="fas fa-spinner fa-spin text-[10px]"></i>Scanning
                      </span>
                    )}
                    {isInfected && (
                      <button onClick={() => setDeleteConfirm(sub)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-all flex items-center gap-1">
                        <i className="fas fa-trash text-[10px]"></i> Delete
                      </button>
                    )}
                    {sub.status === 'pending' && !isInfected && (
                      <>
                        <button onClick={() => { setReviewModal({ submission: sub, action: 'approve' }); setReviewNote('') }}
                          disabled={!isSafe} title={!isSafe ? 'Wait for security scan' : undefined}
                          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                          <i className="fas fa-check text-[10px]"></i> Approve
                        </button>
                        <button onClick={() => { setReviewModal({ submission: sub, action: 'needs_action' }); setReviewNote('') }}
                          className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-100 transition-all flex items-center gap-1">
                          <i className="fas fa-flag text-[10px]"></i> Flag
                        </button>
                        <button onClick={() => { setReviewModal({ submission: sub, action: 'reject' }); setReviewNote('') }}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-all flex items-center gap-1">
                          <i className="fas fa-xmark text-[10px]"></i> Reject
                        </button>
                      </>
                    )}
                    {sub.status === 'approved' && (
                      <button onClick={() => { setReviewModal({ submission: sub, action: 'complete' }); setReviewNote('') }}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-1.5">
                        <i className="fas fa-circle-check text-[10px]"></i> Complete
                      </button>
                    )}
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
            <h3 className="text-base font-bold text-slate-900 mb-1 capitalize">{reviewModal.action.replace('_', ' ')} Submission</h3>
            <p className="text-sm text-slate-500 mb-4">File: <span className="font-semibold text-slate-700">{reviewModal.submission.original_filename}</span></p>
            <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)}
              placeholder={reviewModal.action === 'reject' ? 'Rejection reason (recommended)…' : 'Optional note…'}
              rows={3} className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none text-sm focus:ring-2 focus:ring-indigo-200 resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setReviewModal(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200">Cancel</button>
              <button onClick={handleReview}
                className={`flex-1 py-3 text-white rounded-xl font-bold text-sm transition-all ${
                  reviewModal.action === 'reject'   ? 'bg-red-500 hover:bg-red-600' :
                  reviewModal.action === 'approve'  ? 'bg-emerald-500 hover:bg-emerald-600' :
                  reviewModal.action === 'complete' ? 'bg-blue-500 hover:bg-blue-600' :
                  'bg-orange-500 hover:bg-orange-600'
                }`}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Permanently delete infected file?"
          body={`"${deleteConfirm.original_filename}" contains malware and will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete Permanently"
          confirmClass="bg-red-600 hover:bg-red-700"
          loading={deletingFile}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

// ─── Main Sharing page ────────────────────────────────────────────────────────

export default function Sharing() {
  const dispatch = useDispatch()
  const { files }  = useSelector((s) => s.files)
  const { shares, zipShares, inbox, inboxStatusCounts } = useSelector((s) => s.sharing)
  const [activeTab, setActiveTab] = useState('shares')

  useEffect(() => {
    dispatch(fetchFiles())
    dispatch(fetchShares({ page: 1 }))
    dispatch(fetchZipShares({ page: 1 }))
    dispatch(fetchRequests())
    dispatch(fetchInbox())
    dispatch(fetchGlobalAnalytics())
  }, [dispatch])

  const pendingCount  = inboxStatusCounts?.pending || 0
  const totalShares   = (shares.length || 0) + (zipShares.length || 0)

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
              <p className="text-sm text-slate-500 mt-1">
                Share files · ZIP bundles · File requests · Submission inbox
              </p>
            </div>
            <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
          </div>

          {activeTab === 'shares'    && <SharesPanel files={files} />}
          {activeTab === 'analytics' && <AnalyticsPanel />}
          {activeTab === 'requests'  && <RequestsPanel />}
          {activeTab === 'inbox'     && <InboxPanel />}
        </div>
      </div>
    </div>
  )
}