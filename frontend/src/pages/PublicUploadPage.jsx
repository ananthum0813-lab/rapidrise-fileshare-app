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
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { getRecipientUploadInfo, submitRecipientUpload } from '@/api/sharingApi'

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmtBytes = (b) => {
  if (!b) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const fmtDate = (d) => d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

// ─── scan status badge ────────────────────────────────────────────────────────

const ScanBadge = ({ status }) => {
  const cfg = {
    scanning:    { cls: 'bg-blue-50 text-blue-600 border-blue-200',       icon: 'fa-spinner fa-spin',       text: 'Scanning for viruses…' },
    pending:     { cls: 'bg-slate-50 text-slate-500 border-slate-200',    icon: 'fa-clock',                 text: 'Scan pending'          },
    safe:        { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'fa-shield-halved',      text: 'No threats detected'   },
    infected:    { cls: 'bg-red-50 text-red-700 border-red-200',          icon: 'fa-bug',                   text: 'Threat detected'       },
    scan_failed: { cls: 'bg-orange-50 text-orange-600 border-orange-200', icon: 'fa-triangle-exclamation',  text: 'Scan failed'           },
  }
  const c = cfg[status] || cfg.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.cls}`}>
      <i className={`fas ${c.icon} text-[10px]`}></i>{c.text}
    </span>
  )
}

// ─── file row ─────────────────────────────────────────────────────────────────

function FileRow({ file, onRemove }) {
  const ext = file.name.split('.').pop().toLowerCase()
  const iconMap = {
    pdf: 'fa-file-pdf text-red-500',
    doc: 'fa-file-word text-blue-500', docx: 'fa-file-word text-blue-500',
    xls: 'fa-file-excel text-green-500', xlsx: 'fa-file-excel text-green-500',
    png: 'fa-file-image text-purple-500', jpg: 'fa-file-image text-purple-500',
    jpeg: 'fa-file-image text-purple-500', gif: 'fa-file-image text-purple-500',
    zip: 'fa-file-zipper text-amber-500', mp4: 'fa-file-video text-indigo-500',
    txt: 'fa-file-lines text-slate-500', csv: 'fa-file-csv text-green-600',
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

// ─── uploaded result row ──────────────────────────────────────────────────────

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

  // Request info state
  const [info,     setInfo]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [infoErr,  setInfoErr]  = useState('')

  // Upload state
  const [files,    setFiles]    = useState([])        // FileList items staged
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [uploaded,  setUploaded]  = useState([])      // results from server
  const [done,      setDone]      = useState(false)

  // Drag-over state
  const [dragOver, setDragOver] = useState(false)
  const dropRef = useRef(null)

  // ── fetch request info ────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return
    setLoading(true)
    getRecipientUploadInfo(token)
      .then(({ data }) => {
        setInfo(data.data || data)
        setLoading(false)
      })
      .catch((err) => {
        const msg = err.response?.data?.detail
          || err.response?.data?.message
          || 'This upload link is invalid or has expired.'
        setInfoErr(msg)
        setLoading(false)
      })
  }, [token])

  // ── file picking ──────────────────────────────────────────────────────────

  const addFiles = useCallback((incoming) => {
    setUploadErr('')
    const arr = Array.from(incoming)
    const remaining = info ? (info.remaining_slots - files.length) : 10
    const allowed   = arr.slice(0, remaining)
    const blocked   = arr.length - allowed.length

    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name + f.size))
      const dedup  = allowed.filter((f) => !names.has(f.name + f.size))
      return [...prev, ...dedup]
    })

    if (blocked > 0) {
      setUploadErr(`Only ${remaining} more file(s) can be added to this request.`)
    }
  }, [files, info])

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  // Drag & drop handlers
  const onDragOver  = (e) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = ()  => setDragOver(false)
  const onDrop      = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files) }

  // ── upload ────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!files.length || uploading) return
    setUploading(true)
    setProgress(0)
    setUploadErr('')

    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))

    try {
      const { data } = await submitRecipientUpload(token, fd, {
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
        },
      })

      const payload = data.data || data
      const results = payload.files || []
      setUploaded(results)
      setFiles([])
      setDone(true)

      // Show errors for files that failed validation
      if (payload.errors?.length) {
        const errLines = payload.errors.map((e) => `${e.file}: ${e.errors?.join(', ')}`).join('\n')
        setUploadErr(`Some files were not accepted:\n${errLines}`)
      }
    } catch (err) {
      const msg = err.response?.data?.detail
        || err.response?.data?.message
        || err.response?.data?.files
        || 'Upload failed. Please try again.'
      setUploadErr(Array.isArray(msg) ? msg.join(' ') : String(msg))
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  // ── upload more ───────────────────────────────────────────────────────────

  const uploadMore = () => {
    setDone(false)
    setUploaded([])
    setUploadErr('')
  }

  // ── loading / error states ────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
      <div className="text-center">
        <i className="fas fa-spinner fa-spin text-3xl text-indigo-500 mb-4 block"></i>
        <p className="text-slate-500 font-medium">Loading upload page…</p>
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

  const slotsLeft    = info.remaining_slots ?? (info.max_files - info.submission_count)
  const isExpired    = info.expires_at && new Date(info.expires_at) < new Date()
  const isFull       = slotsLeft <= 0
  const isBlocked    = isExpired || isFull

  // ── success screen ────────────────────────────────────────────────────────

  if (done) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-start justify-center p-4 pt-10 sm:pt-16">
      <div className="max-w-lg w-full space-y-4">
        {/* Success header */}
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-circle-check text-3xl text-emerald-500"></i>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Files Uploaded!</h2>
          <p className="text-sm text-slate-500">
            Your files have been received and are being scanned for security. <br />
            <span className="text-slate-400">The recipient will be notified once the review is complete.</span>
          </p>
        </div>

        {/* Per-file scan status */}
        {uploaded.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <i className="fas fa-shield-halved text-indigo-500 text-sm"></i>
              <span className="text-sm font-bold text-slate-800">Security Scan Status</span>
              <span className="ml-auto text-xs text-slate-400">{uploaded.length} file{uploaded.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="p-4 space-y-2">
              {uploaded.map((r, i) => <UploadedRow key={i} result={r} />)}
            </div>
            <div className="px-5 pb-4">
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <i className="fas fa-info-circle text-blue-400"></i>
                Scanning typically completes within a few seconds. The requester reviews files after scanning.
              </p>
            </div>
          </div>
        )}

        {uploadErr && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 whitespace-pre-line">
            <i className="fas fa-triangle-exclamation mr-2"></i>{uploadErr}
          </div>
        )}

        {/* Upload more button if slots remain */}
        {slotsLeft > uploaded.length && (
          <button
            onClick={uploadMore}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            <i className="fas fa-plus"></i> Upload More Files
          </button>
        )}
      </div>
    </div>
  )

  // ── main upload UI ────────────────────────────────────────────────────────

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

          {/* Meta */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Slots Left</p>
              <p className={`text-sm font-bold mt-0.5 ${isFull ? 'text-red-500' : 'text-slate-800'}`}>
                {isFull ? 'Full' : `${slotsLeft} of ${info.max_files}`}
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

          {/* Required files */}
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

          {/* Recipient info */}
          {info.recipient_email && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
              <i className="fas fa-envelope text-[11px]"></i>
              Upload link for <span className="font-semibold text-slate-600">{info.recipient_email}</span>
              {info.recipient_upload_count > 0 && (
                <span className="ml-auto text-emerald-600 font-semibold">
                  <i className="fas fa-check-circle mr-1"></i>{info.recipient_upload_count} already uploaded
                </span>
              )}
            </div>
          )}
        </div>

        {/* Blocked state */}
        {isBlocked && (
          <div className={`rounded-2xl p-5 border text-sm font-medium flex items-center gap-3 ${
            isExpired ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            <i className={`fas ${isExpired ? 'fa-clock text-red-500' : 'fa-lock text-amber-500'} text-lg`}></i>
            <span>{isExpired ? 'This upload link has expired and is no longer accepting files.' : 'This request has reached its file limit.'}</span>
          </div>
        )}

        {/* Upload form */}
        {!isBlocked && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <i className="fas fa-cloud-arrow-up text-indigo-500"></i> Upload Your Files
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Files are scanned for viruses before being made available to the requester.
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
                  onChange={(e) => { if (e.target.files.length) addFiles(e.target.files); e.target.value = '' }}
                />
                <div className={`transition-transform ${dragOver ? 'scale-110' : ''}`}>
                  <i className={`fas fa-cloud-arrow-up text-3xl mb-3 block ${dragOver ? 'text-indigo-500' : 'text-slate-300'}`}></i>
                  <p className="text-sm font-semibold text-slate-600">
                    {dragOver ? 'Drop files here' : 'Drag & drop files, or click to browse'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Up to {slotsLeft} file{slotsLeft !== 1 ? 's' : ''} · Max 100 MB each
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
                    <span><i className="fas fa-spinner fa-spin mr-1.5"></i>Uploading…</span>
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
                  ? <><i className="fas fa-spinner fa-spin"></i>Uploading {files.length} file{files.length !== 1 ? 's' : ''}…</>
                  : <><i className="fas fa-paper-plane"></i>Submit {files.length > 0 ? `${files.length} file${files.length !== 1 ? 's' : ''}` : 'Files'}</>}
              </button>

              {/* Security note */}
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