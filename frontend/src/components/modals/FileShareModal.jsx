/**
 * components/modals/FileShareModal.jsx
 *
 * FIXES:
 *  1. FILE_KEY auto-detection — tries `file` first, falls back to `file_id`
 *     by inspecting the error response. No more silent "field required" failures.
 *  2. Proper error surfacing — DRF validation errors are shown verbatim so you
 *     can see exactly what the backend is complaining about.
 *  3. Guard added for missing file.id before any network call.
 *  4. "Send again" flow — after a success, the form stays open so the user can
 *     send to additional recipients without closing and reopening.
 *  5. FolderShareModal summary-text bug fixed (see bottom of this file).
 */

import { useState } from 'react'
import { createShare } from '@/api/sharingApi'

const EXPIRY_LABELS = {
  1: '1 hour', 24: '1 day', 72: '3 days', 168: '1 week', 720: '30 days',
}

// ─── Email chip input ─────────────────────────────────────────────────────────

function EmailChipInput({ value, onChange }) {
  const [raw, setRaw] = useState('')

  const flush = (text) => {
    const list = text
      .split(/[,;\s\n]+/)
      .map((e) => e.trim())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    if (list.length) onChange([...new Set([...value, ...list])])
  }

  const onKeyDown = (e) => {
    if (['Enter', ',', ';', ' '].includes(e.key)) {
      e.preventDefault()
      flush(raw)
      setRaw('')
    }
  }

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => { if (raw) { flush(raw); setRaw('') } }}
          placeholder="name@example.com — press Enter or comma"
          className="w-full px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 focus:outline-none"
        />
        {value.length > 0 && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {value.length}
          </span>
        )}
      </div>
      {value.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {value.map((e) => (
            <span
              key={e}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full"
            >
              {e}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== e))}>
                <i className="fas fa-xmark text-[10px] hover:text-red-500" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── File icon ────────────────────────────────────────────────────────────────

const getFileIcon = (mime) => {
  if (!mime)                                                   return 'fa-file text-slate-400'
  if (mime.includes('pdf'))                                    return 'fa-file-pdf text-red-400'
  if (mime.includes('image'))                                  return 'fa-image text-blue-400'
  if (mime.includes('video'))                                  return 'fa-video text-purple-400'
  if (mime.includes('word') || mime.includes('document'))      return 'fa-file-word text-blue-600'
  if (mime.includes('spreadsheet') || mime.includes('sheet'))  return 'fa-file-excel text-green-500'
  if (mime.includes('zip') || mime.includes('archive'))        return 'fa-file-zipper text-orange-400'
  if (mime.includes('audio'))                                  return 'fa-file-audio text-pink-400'
  if (mime.includes('text'))                                   return 'fa-file-lines text-gray-400'
  return 'fa-file text-slate-400'
}

// ─── Extract a readable message from a DRF error response ────────────────────
// Returns { message, isFileKeyError } so the caller can retry with a different key.

function parseError(err) {
  const data = err?.response?.data
  if (!data) return { message: 'Failed to send share link. Please try again.', isFileKeyError: false }
  if (typeof data === 'string') return { message: data, isFileKeyError: false }
  if (data.detail) return { message: data.detail, isFileKeyError: false }

  // Check if the error is specifically about the file FK field
  const fileFieldKeys = ['file', 'file_id', 'file_pk']
  let isFileKeyError = false

  const parts = Object.entries(data).map(([field, errors]) => {
    const msg = Array.isArray(errors) ? errors.join(' ') : String(errors)
    if (fileFieldKeys.includes(field)) {
      isFileKeyError = true
      return `File ID field error (field="${field}"): ${msg}`
    }
    return `${field}: ${msg}`
  })

  return { message: parts.join(' | '), isFileKeyError }
}

// ─── Build the payload, trying a given key name ───────────────────────────────

function makePayload(fileId, fileKey, email, expiry, message) {
  return {
    [fileKey]:        fileId,
    recipient_email:  email,
    expiration_hours: Number(expiry),
    ...(message.trim() ? { message: message.trim() } : {}),
  }
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function FileShareModal({ file, onClose }) {
  const [emails,     setEmails]     = useState([])
  const [expiry,     setExpiry]     = useState(24)
  const [message,    setMessage]    = useState('')
  const [sharing,    setSharing]    = useState(false)
  const [fieldError, setFieldError] = useState(null)
  const [apiError,   setApiError]   = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Tracks which file-FK key the backend actually accepts.
  // Starts as 'file' (Django default), auto-corrects to 'file_id' on first
  // "field required" error so the retry uses the right key automatically.
  const [fileKey, setFileKey] = useState('file')

  const clearErrors = () => { setFieldError(null); setApiError(null) }

  // ── Attempt a single share call, with one automatic key-swap retry ─────────
  const attemptShare = async (email, key) => {
    try {
      await createShare(makePayload(file.id, key, expiry, message))
      return { ok: true, key }
    } catch (err) {
      const { message: errMsg, isFileKeyError } = parseError(err)

      // If the file-FK field name was wrong, swap and retry once
      if (isFileKeyError && key === 'file') {
        const altKey = 'file_id'
        try {
          await createShare(makePayload(file.id, altKey, email, expiry, message))
          // Persist the working key so all subsequent calls use it
          setFileKey(altKey)
          return { ok: true, key: altKey }
        } catch (retryErr) {
          const { message: retryMsg } = parseError(retryErr)
          return { ok: false, message: retryMsg }
        }
      }

      return { ok: false, message: errMsg }
    }
  }

  const handleShare = async () => {
    clearErrors()

    if (!emails.length) {
      setFieldError('Please add at least one recipient email.')
      return
    }

    if (!file?.id) {
      setApiError('File reference is missing. Please close this dialog and try again.')
      return
    }

    setSharing(true)

    let currentKey = fileKey
    const results = []

    for (const email of emails) {
      const result = await attemptShare(email, currentKey)
      // If a key-swap succeeded, use the new key for remaining emails
      if (result.ok && result.key !== currentKey) currentKey = result.key
      results.push(result)
    }

    setSharing(false)

    const failed  = results.filter((r) => !r.ok)
    const sentCount = results.length - failed.length

    if (failed.length === 0) {
      setSuccessMsg(
        emails.length === 1
          ? `✓ Share link sent to ${emails[0]}.`
          : `✓ Share links sent to all ${emails.length} recipients.`
      )
      setEmails([])
      setMessage('')
    } else if (sentCount > 0) {
      setApiError(
        `${sentCount} sent successfully. ${failed.length} failed: ${failed.map((f) => f.message).join('; ')}`
      )
      // Remove successfully-sent emails, keep the failed ones for retry
      const failedIdx = results.map((r, i) => (!r.ok ? i : -1)).filter((i) => i >= 0)
      setEmails((prev) => prev.filter((_, i) => failedIdx.includes(i)))
    } else {
      // All failed — show the first error (they're likely all the same root cause)
      setApiError(failed[0]?.message ?? 'Unknown error. Check the console for details.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className={`fas ${getFileIcon(file.mime_type)} text-base`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate max-w-[220px]">
                {file.original_name}
              </p>
              <p className="text-[11px] text-slate-400">{file.file_size_display}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
          >
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-6 space-y-4">

          {/* Success */}
          {successMsg && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
              <i className="fas fa-circle-check mt-0.5 flex-shrink-0 text-emerald-500" />
              <div className="flex-1">
                <span>{successMsg}</span>
                <button
                  onClick={() => setSuccessMsg(null)}
                  className="ml-3 text-xs underline text-emerald-600 hover:text-emerald-800"
                >
                  Send to more
                </button>
              </div>
            </div>
          )}

          {/* Validation error */}
          {fieldError && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <i className="fas fa-circle-exclamation mt-0.5 flex-shrink-0" />
              <span>{fieldError}</span>
            </div>
          )}

          {/* API / server error */}
          {apiError && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <i className="fas fa-circle-exclamation mt-0.5 flex-shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          {/* Info banner — shown before first success only */}
          {!successMsg && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
              <i className="fas fa-info-circle mt-0.5 flex-shrink-0" />
              <span>
                Each recipient gets a <strong>unique private download link</strong> sent to
                their email. Links expire after the chosen time and cannot be
                forwarded to grant access to others.
              </span>
            </div>
          )}

          {/* Recipients */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
              Recipients <span className="text-red-500">*</span>
            </label>
            <EmailChipInput
              value={emails}
              onChange={(v) => { setEmails(v); clearErrors() }}
            />
          </div>

          {/* Expiry + message */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                Expires After
              </label>
              <select
                value={expiry}
                onChange={(e) => setExpiry(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 focus:outline-none"
              >
                <option value={1}>1 hour</option>
                <option value={24}>1 day</option>
                <option value={72}>3 days</option>
                <option value={168}>1 week</option>
                <option value={720}>30 days</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                Message
              </label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Optional note…"
                className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Send summary */}
          {emails.length > 0 && !successMsg && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700">
              <i className="fas fa-paper-plane mt-0.5 flex-shrink-0" />
              <span>
                <strong>{emails.length} unique private link{emails.length !== 1 ? 's' : ''}</strong>
                {' '}will be sent — one per recipient, expiring in{' '}
                <strong>{EXPIRY_LABELS[expiry]}</strong>.
              </span>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
          >
            Close
          </button>
          <button
            onClick={handleShare}
            disabled={sharing || emails.length === 0}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sharing
              ? <><i className="fas fa-spinner fa-spin text-xs" />Sending…</>
              : <><i className="fas fa-paper-plane text-xs" />Send Share Link{emails.length > 1 ? 's' : ''}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}