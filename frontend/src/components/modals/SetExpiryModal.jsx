/**
 * SetExpiryModal.jsx
 *
 * Modal for setting / clearing auto-delete expiry on a single file.
 * Shows current expiry status and lets the user pick a new one.
 *
 * Props:
 *   file      — file object (needs id, original_name, expires_at)
 *   onClose   — () => void
 *   onUpdated — (updatedFile) => void   called after a successful save
 */

import { useState } from 'react'
import { setFileExpiry } from '@/api/filesApi'

// ── Constants ─────────────────────────────────────────────────────────────────

export const EXPIRY_OPTIONS = [
  { value: 'never',   label: 'Never',   sublabel: 'File is permanent' },
  { value: '1_minute', label: '1 Minute', sublabel: 'Deletes in 60 seconds' },  
  { value: '1_hour',  label: '1 Hour',  sublabel: 'Deletes in 60 minutes' },
  { value: '1_day',   label: '1 Day',   sublabel: 'Deletes in 24 hours' },
  { value: '7_days',  label: '7 Days',  sublabel: 'Deletes in one week' },
  { value: '30_days', label: '30 Days', sublabel: 'Deletes in one month' },
]

// ── Expiry display helper (exported so Files.jsx can reuse it) ────────────────

export function getExpiryInfo(expiresAt) {
  if (!expiresAt) return null
  const now    = Date.now()
  const exp    = new Date(expiresAt).getTime()
  const diffMs = exp - now
  if (diffMs <= 0) return { label: 'Expired', variant: 'expired' }
  const h = diffMs / 3_600_000
  const d = h / 24
  if (h < 1)  return { label: 'Expires < 1h',              variant: 'critical' }
  if (h < 24) return { label: `Expires in ${Math.ceil(h)}h`, variant: 'critical' }
  if (d < 2)  return { label: 'Expires tomorrow',            variant: 'warning' }
  if (d < 7)  return { label: `Expires in ${Math.floor(d)}d`, variant: 'warning' }
  return             { label: `Expires in ${Math.floor(d)}d`, variant: 'normal' }
}

const variantClasses = {
  expired:  'text-red-500',
  critical: 'text-orange-500',
  warning:  'text-amber-500',
  normal:   'text-slate-400',
}

const variantBg = {
  expired:  'bg-red-50 border-red-100 text-red-700',
  critical: 'bg-orange-50 border-orange-100 text-orange-700',
  warning:  'bg-amber-50 border-amber-100 text-amber-700',
  normal:   'bg-slate-50 border-slate-200 text-slate-600',
}

// ── File icon helper (mirrors Files.jsx) ──────────────────────────────────────
function getFileIcon(mime) {
  if (!mime) return 'fa-file text-slate-400'
  if (mime.includes('pdf'))    return 'fa-file-pdf text-red-400'
  if (mime.includes('image'))  return 'fa-image text-blue-400'
  if (mime.includes('video'))  return 'fa-video text-purple-400'
  if (mime.includes('word') || mime.includes('document')) return 'fa-file-word text-blue-600'
  if (mime.includes('sheet') || mime.includes('spreadsheet')) return 'fa-file-excel text-green-500'
  if (mime.includes('zip') || mime.includes('archive')) return 'fa-file-zipper text-orange-400'
  if (mime.includes('audio')) return 'fa-file-audio text-pink-400'
  if (mime.includes('text'))  return 'fa-file-lines text-gray-400'
  return 'fa-file text-slate-400'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SetExpiryModal({ file, onClose, onUpdated }) {
  // Pre-select 'never' (safest default — user must opt in to deletion)
  const [selected, setSelected] = useState('never')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState(null)
  const [success,  setSuccess]  = useState(false)

  const expiryInfo    = getExpiryInfo(file.expires_at)
  const hasExpiry     = !!file.expires_at
  const expiresAtDate = hasExpiry ? new Date(file.expires_at) : null

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const { data } = await setFileExpiry(file.id, selected)
      setSuccess(true)
      setTimeout(() => {
        onUpdated?.(data?.data ?? null)
        onClose()
      }, 800)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update expiry.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <i className={`fas ${getFileIcon(file.mime_type)} text-sm`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{file.original_name}</p>
              <p className="text-[11px] text-slate-400">{file.file_size_display}</p>
            </div>
          </div>
          <button onClick={onClose} className="ml-2 flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all">
            <i className="fas fa-xmark" />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-4">

          {/* Success flash */}
          {success && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
              <i className="fas fa-circle-check flex-shrink-0" />
              <span>Expiry updated!</span>
            </div>
          )}

          {/* Error */}
          {error && !success && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <i className="fas fa-circle-exclamation flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current status */}
          {hasExpiry && !success && (
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border ${variantBg[expiryInfo?.variant ?? 'normal']}`}>
              <i className="fas fa-clock flex-shrink-0" />
              <span>
                {expiryInfo?.variant === 'expired'
                  ? 'This file has already expired.'
                  : `Auto-deletes on ${expiresAtDate?.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </span>
              <button
                onClick={() => setSelected('never')}
                className="ml-auto underline text-[10px] font-bold hover:opacity-70 transition-opacity whitespace-nowrap"
                title="Remove expiry"
              >
                Remove
              </button>
            </div>
          )}

          {/* Expiry picker */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              {hasExpiry ? 'Change expiry' : 'Set auto-delete'}
            </p>
            <div className="space-y-1.5">
              {EXPIRY_OPTIONS.map(({ value, label, sublabel }) => {
                const active = selected === value
                return (
                  <label
                    key={value}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                      active
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-slate-50 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="expiry_option"
                      value={value}
                      checked={active}
                      onChange={() => setSelected(value)}
                      className="accent-indigo-600 w-4 h-4 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${active ? 'text-indigo-700' : 'text-slate-700'}`}>{label}</p>
                      <p className="text-[10px] text-slate-400">{sublabel}</p>
                    </div>
                    {value === 'never' && (
                      <span className="text-[10px] bg-slate-200 text-slate-500 font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                        Default
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Warning callout when destructive option selected */}
          {selected !== 'never' && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
              <i className="fas fa-triangle-exclamation mt-0.5 flex-shrink-0" />
              <span>
                The file will be <strong>moved to trash</strong> automatically after{' '}
                {EXPIRY_OPTIONS.find((o) => o.value === selected)?.label.toLowerCase()}.
                You can still restore it from trash within 30 days.
              </span>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || success}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {success ? (
              <><i className="fas fa-check text-xs" />Saved!</>
            ) : saving ? (
              <><i className="fas fa-spinner fa-spin text-xs" />Saving…</>
            ) : (
              <><i className="fas fa-clock text-xs" />Save Expiry</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Re-export badge helper so Files.jsx can import from here ──────────────────
export { variantClasses }