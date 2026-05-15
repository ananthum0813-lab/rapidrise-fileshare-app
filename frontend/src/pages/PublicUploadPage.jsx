/**
 * PublicUploadPage.jsx
 *
 * Route: /request/upload/:token
 *
 * Public page — no auth required.
 * Fetches request info via the per-recipient token, then lets the
 * recipient drag-and-drop / select files and upload them.
 *
 * After upload, shows per-file scan status with a polling refresh
 * so the recipient sees when scanning completes.
 *
 * Slot / count corrections
 * ─────────────────────────
 * `info` is fetched once at page load and becomes stale after uploads.
 * We track `sessionUploadCount` locally to correct:
 *   • effectiveSlotsLeft = serverSlotsAtLoad - sessionUploadCount
 *   • displayUploadCount = serverUploadCount + sessionUploadCount
 *
 * We do NOT subtract `uploaded.length` from slots — that causes a
 * double-deduction because the server already deducted prior submissions
 * when it computed `remaining_slots` at load time.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { getRecipientUploadInfo, submitRecipientUpload, getRecipientUploadStatuses } from '@/api/sharingApi'

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmtBytes = (b) => {
  if (!b) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const fmtDate = (d) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

// Statuses where scanning is finished — stop polling once all files reach one
const TERMINAL_STATUSES = new Set(['safe', 'infected', 'scan_failed'])

// ─── scan status badge ────────────────────────────────────────────────────────

const ScanBadge = ({ status }) => {
  const cfg = {
    scanning:    { cls: 'bg-blue-50 text-blue-600 border-blue-200',          icon: 'fa-spinner fa-spin',      text: 'Scanning for viruses...' },
    pending:     { cls: 'bg-slate-50 text-slate-500 border-slate-200',       icon: 'fa-clock',                text: 'Scan pending'            },
    safe:        { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'fa-shield-halved',        text: 'No threats detected'     },
    infected:    { cls: 'bg-red-50 text-red-700 border-red-200',             icon: 'fa-bug',                  text: 'Threat detected'         },
    scan_failed: { cls: 'bg-orange-50 text-orange-600 border-orange-200',    icon: 'fa-triangle-exclamation', text: 'Scan failed'             },
  }
  const c = cfg[status] || cfg.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.cls}`}>
      <i className={`fas ${c.icon} text-[10px]`}></i>{c.text}
    </span>
  )
}

// ─── staged file row ──────────────────────────────────────────────────────────

function FileRow({ file, onRemove }) {
  const ext = file.name.split('.').pop().toLowerCase()
  const iconMap = {
    pdf:  'fa-file-pdf text-red-500',
    doc:  'fa-file-word text-blue-500',   docx: 'fa-file-word text-blue-500',
    xls:  'fa-file-excel text-green-500', xlsx: 'fa-file-excel text-green-500',
    png:  'fa-file-image text-purple-500', jpg: 'fa-file-image text-purple-500',
    jpeg: 'fa-file-image text-purple-500', gif: 'fa-file-image text-purple-500',
    zip:  'fa-file-zipper text-amber-500', mp4: 'fa-file-video text-indigo-500',
    txt:  'fa-file-lines text-slate-500',  csv: 'fa-file-csv text-green-600',
  }
  const icon = iconMap[ext] || 'fa-file text-slate-400'
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl group">
      <i className={`fas ${icon} text-lg flex-shrink-0`}></i>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
        <p className="text-xs text-slate-400">{fmtBytes(file.size)}</p>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50"
        >
          <i className="fas fa-xmark text-sm"></i>
        </button>
      )}
    </div>
  )
}

// ─── submitted file row (with scan badge) ─────────────────────────────────────

function UploadedRow({ result }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border border-slate-100 rounded-xl">
      <div className="flex items-center gap-3 min-w-0">
        <i className="fas fa-file-circle-check text-emerald-500 text-lg flex-shrink-0"></i>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{result.filename}</p>
          <p className="text-xs text-slate-400">{fmtBytes(result.size)}</p>
        </div>
      </div>
      <ScanBadge status={result.scan_status || 'scanning'} />
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function PublicUploadPage() {
  const { token } = useParams()

  // Request info — fetched once; stale counts are corrected via sessionUploadCount
  const [info,    setInfo]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [infoErr, setInfoErr] = useState('')

  // Upload state
  const [files,     setFiles]     = useState([])    // staged, not yet submitted
  const [progress,  setProgress]  = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [uploaded,  setUploaded]  = useState([])    // submitted files with scan statuses
  const [done,      setDone]      = useState(false)  // true after first successful batch

  /**
   * sessionUploadCount — files successfully accepted by the server in THIS
   * browser session. Used to correct stale `remaining_slots` and
   * `recipient_upload_count` from the initial fetch WITHOUT double-deducting
   * counts the server already factored in at load time.
   */
  const [sessionUploadCount, setSessionUploadCount] = useState(0)

  // Drag-over UI state
  const [dragOver, setDragOver] = useState(false)
  const dropRef = useRef(null)

  // Holds the setInterval id for scan-status polling
  const pollRef = useRef(null)

  // ── polling helpers ───────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Clean up on unmount
  useEffect(() => () => stopPolling(), [stopPolling])

  const startPolling = useCallback(
    (newBatchFiles) => {
      if (pollRef.current) return   // already polling
      // Skip if this batch is already all-terminal (instant scanner)
      if (newBatchFiles.length > 0 && newBatchFiles.every((f) => TERMINAL_STATUSES.has(f.scan_status))) return

      pollRef.current = setInterval(async () => {
        try {
          const { data } = await getRecipientUploadStatuses(token)
          const results  = (data.data || data).files || []
          if (!results.length) return
          setUploaded(results)
          if (results.every((f) => TERMINAL_STATUSES.has(f.scan_status))) stopPolling()
        } catch {
          // transient — keep polling
        }
      }, 3000)
    },
    [token, stopPolling],
  )

  // ── fetch request info ────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return
    setLoading(true)
    getRecipientUploadInfo(token)
      .then(({ data }) => { setInfo(data.data || data); setLoading(false) })
      .catch((err) => {
        setInfoErr(
          err.response?.data?.detail ||
          err.response?.data?.message ||
          'This upload link is invalid or has expired.',
        )
        setLoading(false)
      })
  }, [token])

  // ── file picking ──────────────────────────────────────────────────────────

  const addFiles = useCallback(
    (incoming) => {
      setUploadErr('')
      const arr = Array.from(incoming)

      // Slots the server reported at load time (already excludes prior submissions)
      const serverSlotsAtLoad = info
        ? (info.remaining_slots ?? (info.max_files - info.submission_count))
        : 10

      // Subtract only what WE submitted this session, and what is already staged
      const remaining = Math.max(0, serverSlotsAtLoad - sessionUploadCount - files.length)
      const allowed   = arr.slice(0, remaining)
      const blocked   = arr.length - allowed.length

      setFiles((prev) => {
        const names = new Set(prev.map((f) => f.name + f.size))
        return [...prev, ...allowed.filter((f) => !names.has(f.name + f.size))]
      })

      if (blocked > 0) {
        setUploadErr(`Only ${remaining} more file(s) can be added to this request.`)
      }
    },
    [files, sessionUploadCount, info],
  )

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  const onDragOver  = (e) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = ()  => setDragOver(false)
  const onDrop      = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  // ── upload ────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!files.length || uploading) return
    setUploading(true)
    setProgress(0)
    setUploadErr('')

    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    if (info?.recipient_email) fd.append('submitter_email', info.recipient_email)

    try {
      const { data } = await submitRecipientUpload(token, fd, {
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
        },
      })

      const payload  = data.data || data
      const newFiles = payload.files || []
      const accepted = newFiles.length

      // Append this batch to the running list so all uploaded files stay visible
      setUploaded((prev) => [...prev, ...newFiles])
      // Record how many were accepted so slot + count displays stay accurate
      setSessionUploadCount((prev) => prev + accepted)
      setFiles([])
      setDone(true)

      if (payload.errors?.length) {
        const errLines = payload.errors.map((e) => `${e.file}: ${e.errors?.join(', ')}`).join('\n')
        setUploadErr(`Some files were not accepted:\n${errLines}`)
      }

      // Restart polling so it covers the full merged list
      stopPolling()
      startPolling(newFiles)
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.response?.data?.files ||
        'Upload failed. Please try again.'
      setUploadErr(Array.isArray(msg) ? msg.join(' ') : String(msg))
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  // ── derived scan state ────────────────────────────────────────────────────

  const allScansSettled = uploaded.length > 0 && uploaded.every((f) => TERMINAL_STATUSES.has(f.scan_status))
  const allSafe         = allScansSettled && uploaded.every((f) => f.scan_status === 'safe')

  // ── loading / error screens ───────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
      <div className="text-center">
        <i className="fas fa-spinner fa-spin text-3xl text-indigo-500 mb-4 block"></i>
        <p className="text-slate-500 font-medium">Loading upload page...</p>
      </div>
    </div>
  )

  if (infoErr) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center border border-red-100">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-link-slash text-2xl text-red-500"></i>
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Link Unavailable</h2>
        <p className="text-sm text-slate-500">{infoErr}</p>
      </div>
    </div>
  )

  // ── slot / count derivations ──────────────────────────────────────────────

  // What the server reported at load time (already excludes all prior submissions)
  const serverSlotsAtLoad  = info.remaining_slots ?? (info.max_files - info.submission_count)
  const isExpired          = !!(info.expires_at && new Date(info.expires_at) < new Date())

  // Subtract only THIS session's uploads — do NOT subtract uploaded.length (double-deduction)
  const effectiveSlotsLeft = Math.max(0, serverSlotsAtLoad - sessionUploadCount)
  const isFull             = effectiveSlotsLeft <= 0

  // "N already uploaded" — add session count to the stale server value
  const displayUploadCount = (info.recipient_upload_count || 0) + sessionUploadCount

  // Block upload form only if expired, or if the request was already full at load time
  const isBlocked = isExpired || (serverSlotsAtLoad <= 0 && sessionUploadCount === 0)

  // ── fully-complete final screen (slots exhausted after uploading) ─────────

  if (done && isFull) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-start justify-center p-4 pt-10 sm:pt-16">
      <div className="max-w-lg w-full space-y-4">

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-circle-check text-3xl text-emerald-500"></i>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">All Files Sent Successfully!</h2>
          <p className="text-sm text-slate-500">
            This request is now complete — no upload slots remain.<br />
            <span className="text-slate-400">The requester has been notified and will review your files.</span>
          </p>
        </div>

        {uploaded.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <i className="fas fa-shield-halved text-indigo-500 text-sm"></i>
              <span className="text-sm font-bold text-slate-800">Security Scan Status</span>
              <span className="ml-auto text-xs text-slate-400">
                {uploaded.length} file{uploaded.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="p-4 space-y-2">
              {uploaded.map((r, i) => <UploadedRow key={i} result={r} />)}
            </div>
            {allScansSettled && (
              <div className="mx-4 mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-sm text-emerald-700 font-medium">
                <i className="fas fa-shield-halved text-emerald-500"></i>
                All files passed the security scan and have been delivered to the requester.
              </div>
            )}
          </div>
        )}

        {uploadErr && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 whitespace-pre-line">
            <i className="fas fa-triangle-exclamation mr-2"></i>{uploadErr}
          </div>
        )}

        <div className="rounded-2xl p-4 border bg-amber-50 border-amber-200 text-amber-700 text-sm font-medium flex items-center gap-3">
          <i className="fas fa-lock text-amber-500 text-lg"></i>
          <span>This request has reached its file limit. No further uploads are accepted.</span>
        </div>
      </div>
    </div>
  )

  // ── unified main UI ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-start justify-center p-4 pt-8 sm:pt-14">
      <div className="max-w-xl w-full space-y-4">

        {/* Request info card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="fas fa-inbox text-indigo-500 text-lg"></i>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{info.title}</h1>
              {info.owner_name && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Requested by <span className="font-semibold text-slate-600">{info.owner_name}</span>
                </p>
              )}
              {info.description && (
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{info.description}</p>
              )}
            </div>
          </div>

          {/* Meta chips */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Slots Left</p>
              <p className={`text-sm font-bold mt-0.5 ${isFull ? 'text-red-500' : 'text-slate-800'}`}>
                {isFull ? 'Full' : `${effectiveSlotsLeft} of ${info.max_files}`}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Expires</p>
              <p className={`text-sm font-bold mt-0.5 ${isExpired ? 'text-red-500' : 'text-slate-800'}`}>
                {info.expires_at ? fmtDate(info.expires_at) : 'Never'}
              </p>
            </div>
            {info.allowed_extensions?.length > 0 && (
              <div className="bg-slate-50 rounded-xl px-3 py-2 col-span-2 sm:col-span-1">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Accepted Types</p>
                <div className="flex flex-wrap gap-1">
                  {info.allowed_extensions.map((e) => (
                    <span key={e} className="px-1.5 py-0.5 bg-white text-slate-600 text-[10px] font-semibold rounded border border-slate-200">.{e}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {info.required_files?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Required Files</p>
              <div className="flex flex-wrap gap-1.5">
                {info.required_files.map((f) => (
                  <span key={f} className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-100">
                    <i className="fas fa-file-circle-check mr-1 text-[10px]"></i>{f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {info.recipient_email && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
              <i className="fas fa-envelope text-[11px]"></i>
              Upload link for <span className="font-semibold text-slate-600">{info.recipient_email}</span>
              {/* Use corrected count so it updates immediately after each upload */}
              {displayUploadCount > 0 && (
                <span className="ml-auto text-emerald-600 font-semibold">
                  <i className="fas fa-check-circle mr-1"></i>{displayUploadCount} already uploaded
                </span>
              )}
            </div>
          )}
        </div>

        {/* Scan results — shown inline after first upload while slots still remain */}
        {done && uploaded.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <i className="fas fa-shield-halved text-indigo-500 text-sm"></i>
              <span className="text-sm font-bold text-slate-800">Security Scan Status</span>
              <span className="ml-auto text-xs text-slate-400">
                {uploaded.length} file{uploaded.length !== 1 ? 's' : ''} uploaded
              </span>
            </div>
            <div className="p-4 space-y-2">
              {uploaded.map((r, i) => <UploadedRow key={i} result={r} />)}
            </div>
            <div className="px-4 pb-4">
              {!allScansSettled ? (
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <i className="fas fa-info-circle text-blue-400"></i>
                  Scanning typically completes within a few seconds...
                </p>
              ) : allSafe ? (
                <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-sm text-emerald-700 font-medium">
                  <i className="fas fa-shield-halved text-emerald-500"></i>
                  All files are safe!{effectiveSlotsLeft > 0 ? ' You can upload more files below if needed.' : ''}
                </div>
              ) : (
                <div className="px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-2 text-sm text-orange-700 font-medium">
                  <i className="fas fa-triangle-exclamation text-orange-500"></i>
                  One or more files had scan issues. Check the statuses above.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Blocked state — expired or full before this session */}
        {isBlocked && (
          <div className={`rounded-2xl p-5 border text-sm font-medium flex items-center gap-3 ${
            isExpired ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            <i className={`fas ${isExpired ? 'fa-clock text-red-500' : 'fa-lock text-amber-500'} text-lg`}></i>
            <span>
              {isExpired
                ? 'This upload link has expired and is no longer accepting files.'
                : 'This request has reached its file limit.'}
            </span>
          </div>
        )}

        {/* Upload form — shown when slots remain */}
        {!isBlocked && !isExpired && effectiveSlotsLeft > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <i className="fas fa-cloud-arrow-up text-indigo-500"></i>
                {done ? 'Upload More Files' : 'Upload Your Files'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {effectiveSlotsLeft} slot{effectiveSlotsLeft !== 1 ? 's' : ''} remaining &middot; Files are scanned for viruses before delivery.
              </p>
            </div>

            <div className="p-5 space-y-4">
              {/* Drop zone */}
              <div
                ref={dropRef}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  dragOver
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'
                }`}
                onClick={() => document.getElementById('file-input').click()}
              >
                <input
                  id="file-input"
                  type="file"
                  multiple
                  className="hidden"
                  accept={
                    info.allowed_extensions?.length
                      ? info.allowed_extensions.map((e) => `.${e}`).join(',')
                      : undefined
                  }
                  onChange={(e) => {
                    if (e.target.files.length) addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
                <div className={`transition-transform ${dragOver ? 'scale-110' : ''}`}>
                  <i className={`fas fa-cloud-arrow-up text-3xl mb-3 block ${dragOver ? 'text-indigo-500' : 'text-slate-300'}`}></i>
                  <p className="text-sm font-semibold text-slate-600">
                    {dragOver ? 'Drop files here' : 'Drag & drop files, or click to browse'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Up to {effectiveSlotsLeft} file{effectiveSlotsLeft !== 1 ? 's' : ''} &middot; Max 100 MB each
                  </p>
                </div>
              </div>

              {/* Staged files */}
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <FileRow key={f.name + i} file={f} onRemove={() => removeFile(i)} />
                  ))}
                </div>
              )}

              {/* Error */}
              {uploadErr && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 whitespace-pre-line">
                  <i className="fas fa-triangle-exclamation mr-1.5"></i>{uploadErr}
                </div>
              )}

              {/* Progress bar */}
              {uploading && progress > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span><i className="fas fa-spinner fa-spin mr-1.5"></i>Uploading...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submit button */}
              <button
                onClick={handleUpload}
                disabled={!files.length || uploading}
                className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
              >
                {uploading
                  ? <><i className="fas fa-spinner fa-spin"></i>Uploading {files.length} file{files.length !== 1 ? 's' : ''}...</>
                  : <><i className="fas fa-paper-plane"></i>Submit {files.length > 0 ? `${files.length} file${files.length !== 1 ? 's' : ''}` : 'Files'}</>}
              </button>

              <p className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                <i className="fas fa-shield-halved text-emerald-400"></i>
                All files are automatically scanned for viruses before delivery.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}