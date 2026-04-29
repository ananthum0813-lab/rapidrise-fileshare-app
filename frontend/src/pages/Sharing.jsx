import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { fetchShares, share, revoke } from '@/store/sharingSlice'
import { fetchFiles } from '@/store/filesSlice'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'

const RevokeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const StatusBadge = ({ status }) => {
  const colors = {
    active: 'bg-green-50 text-green-700',
    expired: 'bg-gray-50 text-gray-700',
    revoked: 'bg-red-50 text-red-700',
  }
  return (
    <span className={`badge ${colors[status] || colors.active} capitalize text-xs`}>
      {status}
    </span>
  )
}

export default function Sharing() {
  const dispatch = useDispatch()
  const { files } = useSelector((s) => s.files)
  const { shares, pagination, sharing, error } = useSelector((s) => s.sharing)
  const [showForm, setShowForm] = useState(false)
  const [revokeConfirm, setRevokeConfirm] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  const { register: field, handleSubmit, reset, formState: { errors } } = useForm({
    mode: 'onTouched',
    defaultValues: { expiration_hours: 24 },
  })

  useEffect(() => {
    dispatch(fetchShares())
    dispatch(fetchFiles())
  }, [dispatch])

  const onSubmit = async (data) => {
    const result = await dispatch(share(data))
    if (share.fulfilled.match(result)) {
      reset()
      setShowForm(false)
      setSuccessMsg('✓ File shared! Email sent to recipient with download link.')
      setTimeout(() => setSuccessMsg(''), 5000)
      dispatch(fetchShares())
    }
  }

  const handleRevoke = async (shareId) => {
    await dispatch(revoke(shareId))
    setRevokeConfirm(null)
    dispatch(fetchShares())
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Shared Files</h1>
              <p className="text-sm sm:text-base text-gray-500 mt-1">Manage file shares and track access.</p>
            </div>
            <Button 
              variant="primary" 
              onClick={() => setShowForm(!showForm)}
              className="w-full sm:w-auto justify-center"
            >
              {showForm ? '✕ Cancel' : '+ Share File'}
            </Button>
          </div>

          {error && <Alert type="error" message={error} className="mb-6" />}
          {successMsg && <Alert type="success" message={successMsg} className="mb-6" />}

          {/* Share Form */}
          {showForm && (
            <div className="bg-white rounded-[2rem] p-6 mb-6 sm:mb-8 shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Share a file</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Select File *</label>
                    <select
                      {...field('file_id', { required: 'Select a file to share.' })}
                      className={`field text-sm ${errors.file_id ? 'field-error' : ''}`}
                    >
                      <option value="">Choose a file...</option>
                      {files.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.original_name} ({f.file_size_display})
                        </option>
                      ))}
                    </select>
                    {errors.file_id && <p className="text-red-600 text-xs mt-1">{errors.file_id.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Recipient Email *</label>
                    <input
                      type="email"
                      placeholder="someone@example.com"
                      className={`field text-sm ${errors.recipient_email ? 'field-error' : ''}`}
                      {...field('recipient_email', {
                        required: 'Email is required.',
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: 'Invalid email.',
                        },
                      })}
                    />
                    {errors.recipient_email && <p className="text-red-600 text-xs mt-1">{errors.recipient_email.message}</p>}
                    <p className="text-xs text-gray-400 mt-1">Any email (public share)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Expiry Time *</label>
                    <select {...field('expiration_hours')} className="field text-sm">
                      <option value="1">1 hour</option>
                      <option value="24">1 day</option>
                      <option value="72">3 days</option>
                      <option value="168">1 week</option>
                      <option value="720">30 days</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Message (optional)</label>
                    <input
                      type="text"
                      placeholder="Add a note..."
                      className="field text-sm"
                      {...field('message')}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900">
                  <p className="font-semibold mb-2">📧 Automatic Email</p>
                  <p>The recipient will receive an email with the download link automatically (no manual sending needed).</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button type="submit" variant="primary" loading={sharing} className="flex-1">
                    Share & Send Email
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="flex-1 sm:flex-none">
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Shares List */}
          {shares.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-[2rem] shadow-sm border border-gray-200">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <p className="text-gray-500 text-sm">No active shares. Create one above.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {shares.map((s) => (
                <div key={s.id} className="bg-white rounded-[1.75rem] p-5 sm:p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{s.file_name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        📧 <span className="font-medium text-gray-700">{s.recipient_email}</span>
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 rounded-lg p-3 mb-4 text-xs">
                    <div>
                      <p className="text-gray-500 text-[11px]">Shared</p>
                      <p className="text-gray-900 font-medium">{new Date(s.shared_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-[11px]">Expires</p>
                      <p className="text-gray-900 font-medium">{new Date(s.expires_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-[11px]">Downloads</p>
                      <p className="text-gray-900 font-medium">{s.download_count}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-[11px]">Accessed</p>
                      <p className="text-gray-900 font-medium">
                        {s.has_been_accessed ? new Date(s.accessed_at).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Message */}
                  {s.message && (
                    <div className="bg-blue-50 border-l-2 border-blue-300 p-3 rounded text-xs text-blue-900 mb-4">
                      <p className="font-semibold mb-1">💬 Message:</p>
                      "{s.message}"
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 px-3 py-2 bg-gray-100 rounded text-xs text-gray-600 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2 13c0 1.104.895 2 2 2h4c1.104 0 2-.896 2-2V7c0-1.104-.896-2-2-2H4c-1.105 0-2 .896-2 2v6zm14-6h4c1.104 0 2 .896 2 2v6c0 1.104-.896 2-2 2h-4c-1.104 0-2-.896-2-2V9c0-1.104.896-2 2-2z" />
                      </svg>
                      <span className="truncate">Link sent via email</span>
                    </div>

                    {s.status === 'active' && (
                      <button
                        onClick={() => setRevokeConfirm(s.id)}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 justify-center"
                      >
                        <RevokeIcon /> Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Revoke Confirmation */}
          {revokeConfirm && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="card p-6 max-w-sm w-full">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Revoke share?</h3>
                <p className="text-sm text-gray-500 mb-6">Recipient won't be able to download anymore.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="ghost" fullWidth onClick={() => setRevokeConfirm(null)}>
                    Keep
                  </Button>
                  <Button variant="danger" fullWidth onClick={() => handleRevoke(revokeConfirm)}>
                    Revoke
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 text-sm">
              <button
                disabled={!pagination.previous}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 w-full sm:w-auto"
                onClick={() => dispatch(fetchShares({ page: pagination.current_page - 1 }))}
              >
                ← Previous
              </button>
              <span className="text-gray-600">Page {pagination.current_page} of {pagination.total_pages}</span>
              <button
                disabled={!pagination.next}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 w-full sm:w-auto"
                onClick={() => dispatch(fetchShares({ page: pagination.current_page + 1 }))}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}