import { useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchFiles, upload, remove, fetchStorage } from '@/store/filesSlice'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'

const UploadIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
const TrashIcon = () => <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
const DownloadIcon = () => <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
const EyeIcon = () => <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
const FileIcon = () => <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>

export default function Files() {
  const dispatch = useDispatch()
  const { files, pagination, loading, uploading, storage, error } = useSelector((s) => s.files)
  const [dragActive, setDragActive] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const fileInputRef = useRef()

  useEffect(() => {
    dispatch(fetchFiles())
    dispatch(fetchStorage())
  }, [dispatch])

  const handleDrag = (e) => {
    e.preventDefault()
    setDragActive(e.type !== 'dragleave')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    setSelectedFiles(Array.from(e.dataTransfer.files))
  }

  const handleFileSelect = (e) => {
    setSelectedFiles(Array.from(e.target.files || []))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return
    await dispatch(upload(selectedFiles))
    dispatch(fetchStorage())
    setSelectedFiles([])
    fileInputRef.current.value = ''
  }

  const handleDownload = async (file) => {
    try {
      const response = await fetch(`/api/files/${file.id}/download/`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.original_name
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Download failed.')
    }
  }

  const handleDelete = async (fileId) => {
    await dispatch(remove(fileId))
    setDeleteConfirm(null)
    dispatch(fetchStorage())
  }

  const usedPercentage = storage ? Math.round((storage.used_bytes / storage.total_bytes) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">My Files</h1>
            <p className="text-sm sm:text-base text-gray-500">Manage your files and uploads.</p>
          </div>

          {error && <Alert type="error" message={error} className="mb-6" />}

          {/* Storage Progress */}
          {storage && (
            <div className="card p-4 sm:p-6 mb-6 sm:mb-8">
              <div className="flex justify-between items-end mb-3">
                <p className="text-sm font-semibold text-gray-800">Storage Usage</p>
                <p className="text-sm font-bold text-gray-600">{usedPercentage}%</p>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(usedPercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                <span className="font-medium">{storage.used_mb} MB</span> used of {storage.total_gb} GB
                {' • '}
                <span className="font-medium">{storage.total_gb * 1024 - storage.used_mb} MB</span> remaining
              </p>
            </div>
          )}

          {/* Upload Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`card p-6 sm:p-8 lg:p-12 text-center border-2 border-dashed transition-all duration-200 mb-6 sm:mb-8 cursor-pointer
              ${dragActive ? 'border-brand-400 bg-brand-50' : 'border-gray-300 hover:border-gray-400'}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept="*/*"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="text-brand-400 opacity-20">
                <UploadIcon />
              </div>
              <div>
                <p className="text-base sm:text-lg font-semibold text-gray-800">Drag files or click to upload</p>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">Max 100MB per file</p>
              </div>
            </div>
          </div>

          {/* Selected Files Preview - SHOW UPLOAD BUTTON */}
          {selectedFiles.length > 0 && (
            <div className="card p-4 sm:p-6 mb-6 sm:mb-8 border-l-4 border-brand-500 bg-brand-50">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Ready to upload ({selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''})
              </h3>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {selectedFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center shrink-0 text-xs font-bold">
                        {f.name.split('.').pop()?.toUpperCase().slice(0, 3) || 'F'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                        <p className="text-xs text-gray-500">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleUpload}
                  loading={uploading}
                  fullWidth
                >
                  ↑ Upload {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSelectedFiles([])
                    fileInputRef.current.value = ''
                  }}
                  fullWidth
                  className="sm:flex-none"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="mb-6 sm:mb-8">
            <input
              type="text"
              placeholder="Search files..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                dispatch(fetchFiles({ search: e.target.value }))
              }}
              className="field w-full"
            />
          </div>

          {/* Files List */}
          {loading && !files.length ? (
            <div className="text-center py-12">
              <svg className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-sm text-gray-400">Loading...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12 card">
              <FileIcon />
              <p className="text-gray-500 text-sm mt-3">No files. Upload to get started.</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {files.map((file) => (
                <div key={file.id} className="card p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:shadow-card transition-shadow">
                  <div className="flex items-center gap-3 flex-1 min-w-0 w-full">
                    <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 text-xs font-medium">
                      {file.original_name.split('.').pop()?.toUpperCase().slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{file.original_name}</p>
                      <p className="text-xs text-gray-400 flex flex-wrap gap-2 mt-1">
                        <span>{file.file_size_display}</span>
                        <span>•</span>
                        <span>{new Date(file.uploaded_at).toLocaleDateString()}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="flex-1 sm:flex-none p-2 sm:p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Preview"
                    >
                      <EyeIcon />
                    </button>
                    <button
                      onClick={() => handleDownload(file)}
                      className="flex-1 sm:flex-none p-2 sm:p-2.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                      title="Download"
                    >
                      <DownloadIcon />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(file.id)}
                      className="flex-1 sm:flex-none p-2 sm:p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Delete Confirmation */}
          {deleteConfirm && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="card p-6 max-w-sm w-full">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete file?</h3>
                <p className="text-sm text-gray-500 mb-6">This cannot be undone.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="ghost" fullWidth onClick={() => setDeleteConfirm(null)}>
                    Cancel
                  </Button>
                  <Button variant="danger" fullWidth onClick={() => handleDelete(deleteConfirm)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Preview Modal */}
          {previewFile && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="card p-6 max-w-sm w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">File Details</h3>
                  <button
                    onClick={() => setPreviewFile(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs font-medium">NAME</p>
                    <p className="text-gray-900 font-medium break-all">{previewFile.original_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs font-medium">SIZE</p>
                    <p className="text-gray-900 font-medium">{previewFile.file_size_display}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs font-medium">TYPE</p>
                    <p className="text-gray-900 font-medium">{previewFile.mime_type}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs font-medium">UPLOADED</p>
                    <p className="text-gray-900 font-medium">
                      {new Date(previewFile.uploaded_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-6">
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => {
                      handleDownload(previewFile)
                      setPreviewFile(null)
                    }}
                  >
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    fullWidth
                    onClick={() => setPreviewFile(null)}
                  >
                    Close
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
                onClick={() => dispatch(fetchFiles({ page: pagination.current_page - 1 }))}
              >
                ← Previous
              </button>
              <span className="text-gray-600">
                Page {pagination.current_page} of {pagination.total_pages}
              </span>
              <button
                disabled={!pagination.next}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 w-full sm:w-auto"
                onClick={() => dispatch(fetchFiles({ page: pagination.current_page + 1 }))}
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