import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchFiles, fetchStorage } from '@/store/filesSlice'
import { fetchShares } from '@/store/sharingSlice'
import { downloadFile } from '@/api/filesApi'

const timeAgo = (date) => {
  if (!date) return 'Unknown'
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const getFileIcon = (mimeType) => {
  if (!mimeType) return 'fa-file text-slate-500'
  if (mimeType.includes('pdf')) return 'fa-file-pdf text-red-500'
  if (mimeType.includes('image')) return 'fa-image text-blue-500'
  if (mimeType.includes('video')) return 'fa-video text-purple-500'
  if (mimeType.includes('document') || mimeType.includes('word')) return 'fa-file-word text-blue-600'
  if (mimeType.includes('spreadsheet') || mimeType.includes('sheet')) return 'fa-file-excel text-green-600'
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'fa-file-zipper text-orange-500'
  return 'fa-file text-slate-500'
}

const getFileColor = (mimeType) => {
  if (!mimeType) return 'slate'
  if (mimeType.includes('pdf')) return 'red'
  if (mimeType.includes('image')) return 'blue'
  if (mimeType.includes('video')) return 'purple'
  if (mimeType.includes('document') || mimeType.includes('word')) return 'blue'
  if (mimeType.includes('spreadsheet') || mimeType.includes('sheet')) return 'green'
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'orange'
  return 'slate'
}

// ── Small hook: fetch a blob URL for a file that needs auth headers ──────────
function useFileBlobUrl(file) {
  const [blobUrl, setBlobUrl]     = useState(null)
  const [blobLoading, setLoading] = useState(false)

  useEffect(() => {
    setBlobUrl(null)
    if (!file) return

    const isMedia =
      file.mime_type?.includes('image') ||
      file.mime_type?.includes('video') ||
      file.mime_type?.includes('audio')

    if (!isMedia) return

    let cancelled = false
    setLoading(true)

    downloadFile(file.id)
      .then(({ data }) => { if (!cancelled) setBlobUrl(URL.createObjectURL(data)) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => {
      cancelled = true
    }
  }, [file?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Revoke when file changes or component unmounts
  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [blobUrl])

  return { blobUrl, blobLoading }
}

// ── Shared file detail modal — used for both search result and recent file ───
function FileDetailModal({ file, shares, onClose, onDownload }) {
  const { blobUrl, blobLoading } = useFileBlobUrl(file)

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-lg font-bold text-slate-900">File Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition text-xl">
            <i className="fas fa-xmark"></i>
          </button>
        </div>

        {/* ── Image / video / audio preview ── */}
        {file.mime_type?.includes('image') && (
          <div className="mb-6 rounded-2xl overflow-hidden bg-indigo-50 border border-indigo-100 flex items-center justify-center min-h-[120px]">
            {blobLoading ? (
              <div className="py-10 flex flex-col items-center gap-2 text-slate-400">
                <i className="fas fa-circle-notch fa-spin text-2xl text-indigo-400"></i>
                <p className="text-xs">Loading preview…</p>
              </div>
            ) : blobUrl ? (
              <img
                src={blobUrl}
                alt={file.original_name}
                className="w-full max-h-56 object-contain rounded-2xl"
              />
            ) : (
              <div className="py-10 flex flex-col items-center gap-2 text-slate-400">
                <i className="fas fa-image text-4xl text-blue-300"></i>
                <p className="text-xs">Preview unavailable</p>
              </div>
            )}
          </div>
        )}

        {file.mime_type?.includes('video') && (
          <div className="mb-6 rounded-2xl overflow-hidden bg-black">
            {blobLoading ? (
              <div className="py-10 flex flex-col items-center gap-2">
                <i className="fas fa-circle-notch fa-spin text-2xl text-white"></i>
                <p className="text-xs text-gray-300">Loading video…</p>
              </div>
            ) : blobUrl ? (
              <video controls className="w-full max-h-52" src={blobUrl}>
                Your browser does not support video preview.
              </video>
            ) : null}
          </div>
        )}

        {file.mime_type?.includes('audio') && (
          <div className="mb-6 p-4 bg-indigo-50 rounded-2xl">
            {blobLoading ? (
              <div className="flex items-center justify-center gap-2 py-2 text-indigo-400">
                <i className="fas fa-circle-notch fa-spin"></i>
                <span className="text-sm">Loading audio…</span>
              </div>
            ) : blobUrl ? (
              <audio controls className="w-full" src={blobUrl} />
            ) : null}
          </div>
        )}

        {/* Icon fallback for non-media files */}
        {!file.mime_type?.includes('image') &&
         !file.mime_type?.includes('video') &&
         !file.mime_type?.includes('audio') && (
          <div className="mb-6 p-6 bg-indigo-50 rounded-2xl text-center">
            <div className={`text-5xl text-${getFileColor(file.mime_type)}-600 mb-3`}>
              <i className={`fas ${getFileIcon(file.mime_type)}`}></i>
            </div>
            <p className="font-bold text-slate-900 break-all text-sm">{file.original_name}</p>
          </div>
        )}

        {/* If image/video/audio, show filename below preview */}
        {(file.mime_type?.includes('image') ||
          file.mime_type?.includes('video') ||
          file.mime_type?.includes('audio')) && (
          <p className="font-bold text-slate-900 break-all text-sm text-center mb-4">{file.original_name}</p>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">File Size</p>
            <p className="text-sm font-bold text-slate-800">{file.file_size_display}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">File Type</p>
            <p className="text-sm font-bold text-slate-800 uppercase">{file.mime_type || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Uploaded</p>
            <p className="text-sm font-bold text-slate-800">{new Date(file.uploaded_at).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
            <p className="text-sm font-bold text-slate-800">
              {shares.some((s) => s.file_id === file.id && s.status === 'active')
                ? '🔗 Shared'
                : '🔒 Private'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => { onDownload(file); onClose() }}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 text-sm"
          >
            <i className="fas fa-download"></i> Download File
          </button>
          {/* <Link
            to="/sharing"
            onClick={onClose}
            className="block w-full py-3 text-center bg-purple-50 text-purple-700 rounded-2xl font-bold hover:bg-purple-100 transition-colors text-sm"
          >
            <i className="fas fa-share-alt mr-2"></i> Share File
          </Link> */}
          <Link
            to="/files"
            onClick={onClose}
            className="block w-full py-3 text-center bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-colors text-sm"
          >
            <i className="fas fa-folder-open mr-2"></i> View in Files
          </Link>
          <button
            onClick={onClose}
            className="w-full py-3 text-slate-500 font-bold hover:text-slate-700 transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const dispatch = useDispatch()
  const { user } = useSelector((s) => s.auth)
  const { files, storage, loading: filesLoading } = useSelector((s) => s.files)
  const { shares } = useSelector((s) => s.sharing)

  const [greeting, setGreeting]               = useState('')
  const [searchQuery, setSearchQuery]         = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [selectedFile, setSelectedFile]       = useState(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [selectedRecentFile, setSelectedRecentFile] = useState(null)

  const searchRef      = useRef(null)
  const searchInputRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation for search
  const handleSearchKeydown = (e) => {
    const searchResults = searchQuery.trim()
      ? files.filter((f) => f.original_name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8)
      : []
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && searchResults[highlightedIndex]) {
          setSelectedFile(searchResults[highlightedIndex])
          setShowSearchDropdown(false)
          setSearchQuery('')
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowSearchDropdown(false)
        break
      default:
        break
    }
  }

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  useEffect(() => {
    dispatch(fetchFiles({ page: 1 }))
    dispatch(fetchStorage())
    dispatch(fetchShares({ page: 1 }))
  }, [dispatch])

  const handleSearchChange = (query) => {
    setSearchQuery(query)
    setShowSearchDropdown(query.trim().length > 0)
    setHighlightedIndex(-1)
  }

  const handleDownload = async (file) => {
    try {
      const { data } = await downloadFile(file.id)
      const url = window.URL.createObjectURL(data)
      const a   = document.createElement('a')
      a.href     = url
      a.download = file.original_name
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Download failed.')
    }
  }

  const usedPercentage = storage ? Math.round((storage.used_bytes / storage.total_bytes) * 100) : 0
  const recentFiles    = files.slice(0, 5)
  const activeShares   = shares.filter((s) => s.status === 'active').length

  const searchResults = searchQuery.trim()
    ? files.filter((f) => f.original_name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8)
    : []

  const avatarUrl = `https://ui-avatars.com/api/?name=${user?.first_name || 'User'}&background=6366f1&color=fff`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dashboard</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {greeting},{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {user?.first_name ?? 'User'}
              </span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 sm:flex-none" ref={searchRef}>
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search files, folders, shares..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeydown}
                onFocus={() => searchQuery.trim().length > 0 && setShowSearchDropdown(true)}
                className="w-full sm:w-80 pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-transparent transition text-sm"
              />

              {/* Search Dropdown */}
              {showSearchDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 max-h-96 overflow-y-auto">
                  {filesLoading ? (
                    <div className="p-4 text-center text-slate-400 text-sm">
                      <i className="fas fa-spinner fa-spin mr-2"></i>Loading...
                    </div>
                  ) : searchResults.length > 0 ? (
                    <>
                      <div className="p-3 border-b border-slate-100 bg-slate-50">
                        <p className="text-xs font-semibold text-slate-500">
                          {searchResults.length} file{searchResults.length !== 1 ? 's' : ''} found
                        </p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {searchResults.map((file, index) => {
                          const isShared = shares.some((s) => s.file_id === file.id && s.status === 'active')
                          return (
                            <div
                              key={file.id}
                              onClick={() => { setSelectedFile(file); setShowSearchDropdown(false); setSearchQuery('') }}
                              onMouseEnter={() => setHighlightedIndex(index)}
                              className={`p-4 cursor-pointer transition-colors ${
                                highlightedIndex === index ? 'bg-indigo-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg bg-${getFileColor(file.mime_type)}-50 text-${getFileColor(file.mime_type)}-600 flex items-center justify-center text-sm flex-shrink-0`}>
                                  <i className={`fas ${getFileIcon(file.mime_type)}`}></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-slate-900 truncate">{file.original_name}</p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-xs text-slate-500">{file.file_size_display}</span>
                                    <span className="text-xs text-slate-400">•</span>
                                    <span className="text-xs text-slate-500">{timeAgo(file.uploaded_at)}</span>
                                    {isShared && (
                                      <>
                                        <span className="text-xs text-slate-400">•</span>
                                        <span className="text-xs text-blue-600 flex items-center gap-1">
                                          <i className="fas fa-share-alt text-[10px]"></i> Shared
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <i className="fas fa-chevron-right text-slate-300 text-xs flex-shrink-0"></i>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="p-3 border-t border-slate-100 bg-slate-50">
                        <Link to="/files" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                          View all files <i className="fas fa-arrow-right"></i>
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center">
                      <i className="fas fa-search text-slate-300 text-2xl mb-2"></i>
                      <p className="text-sm text-slate-500">No files match "{searchQuery}"</p>
                      <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button className="relative h-11 flex items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition px-3">
              <i className="fas fa-bell text-slate-600"></i>
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>
            <Link to="/settings">
              <img src={avatarUrl} alt="avatar" className="h-11 w-11 rounded-full ring-2 ring-white shadow-md cursor-pointer hover:opacity-80 transition" />
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 opacity-10 blur-2xl" />
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">Total Files</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
                <i className="fas fa-file text-lg"></i>
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{storage?.file_count ?? 0}</p>
            <p className="mt-1 text-xs text-slate-500">in your account</p>
            <Link to="/files" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:gap-2 transition-all">
              View All <i className="fas fa-arrow-right text-xs"></i>
            </Link>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 opacity-10 blur-2xl" />
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">Active Shares</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md">
                <i className="fas fa-share-nodes text-lg"></i>
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{activeShares}</p>
            <p className="mt-1 text-xs text-slate-500">shared files</p>
            <Link to="/sharing" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:gap-2 transition-all">
              View All <i className="fas fa-arrow-right text-xs"></i>
            </Link>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 opacity-10 blur-2xl" />
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">Storage Used</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-md">
                <i className="fas fa-database text-lg"></i>
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{storage?.used_mb ?? 0} MB</p>
            <p className="mt-1 text-xs text-slate-500">Used of {storage?.total_gb ?? 1} GB</p>
            <Link to="/files" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:gap-2 transition-all">
              Manage <i className="fas fa-arrow-right text-xs"></i>
            </Link>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 opacity-10 blur-2xl" />
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">Usage</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
                <i className="fas fa-chart-line text-lg"></i>
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{usedPercentage}%</p>
            <p className="mt-1 text-xs text-slate-500">space remaining</p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <i className="fas fa-pulse text-xs"></i> Active
            </span>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Storage Overview */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Storage Overview</h2>
              <button className="text-slate-400 hover:text-slate-600 transition">
                <i className="fas fa-ellipsis-h"></i>
              </button>
            </div>
            <div className="mt-6 flex items-center justify-center">
              <div className="relative h-44 w-44">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" strokeWidth="10" className="fill-none stroke-slate-100" />
                  <circle
                    cx="50" cy="50" r="42" strokeWidth="10" strokeLinecap="round"
                    className="fill-none stroke-indigo-500 transition-all duration-700"
                    strokeDasharray={`${(usedPercentage / 100) * 264} 264`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-slate-900">{usedPercentage}%</span>
                  <span className="mt-1 text-xs text-slate-500">Used</span>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                  <span className="text-sm text-slate-600">Used Space</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{storage?.used_mb} MB</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                  <span className="text-sm text-slate-600">Free Space</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">
                  {storage ? (storage.total_gb * 1024 - storage.used_mb) : 0} MB
                </span>
              </div>
            </div>
            <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-2">
                <i className="fas fa-check-circle text-emerald-600"></i>
                <div>
                  <p className="text-xs font-semibold text-emerald-900">Healthy Storage</p>
                  <p className="text-xs text-emerald-700 mt-0.5">You're using less than 2% of your total storage</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Files */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Recent Files</h2>
              <Link to="/files" className="text-sm font-medium text-indigo-600 hover:underline">View All</Link>
            </div>
            <div className="space-y-2">
              {recentFiles.length > 0 ? (
                recentFiles.map((file) => {
                  const isShared = shares.some((s) => s.file_id === file.id && s.status === 'active')
                  return (
                    <div
                      key={file.id}
                      onClick={() => setSelectedRecentFile(file)}
                      className="group flex items-center gap-3 rounded-xl border border-transparent p-3 transition hover:border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-${getFileColor(file.mime_type)}-50 text-${getFileColor(file.mime_type)}-600`}>
                        <i className={`fas ${getFileIcon(file.mime_type)}`}></i>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{file.original_name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          {file.file_size_display}
                          {isShared && (
                            <><span>•</span><i className="fas fa-share-alt"></i><span>Shared</span></>
                          )}
                        </p>
                      </div>
                      <button className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-200 transition text-sm">
                        <i className="fas fa-eye"></i>
                      </button>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  <i className="fas fa-inbox text-2xl text-slate-300 mb-2 block"></i>
                  No recent files found
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="relative overflow-hidden rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-600 via-indigo-600 to-purple-600 p-6 text-white shadow-lg shadow-indigo-500/30">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <h2 className="text-base font-semibold">Quick Actions</h2>
              <p className="mt-1 text-sm text-indigo-100">Get things done faster</p>
              <div className="mt-6 space-y-2">
                <Link to="/files" className="flex items-center justify-between rounded-xl bg-white/10 p-3 backdrop-blur-sm transition hover:bg-white/20">
                  <span className="flex items-center gap-3 text-sm font-medium">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                      <i className="fas fa-cloud-arrow-up text-sm"></i>
                    </span>
                    Upload Files
                  </span>
                  <i className="fas fa-arrow-right text-xs opacity-70"></i>
                </Link>
                <Link to="/sharing" className="flex items-center justify-between rounded-xl bg-white/10 p-3 backdrop-blur-sm transition hover:bg-white/20">
                  <span className="flex items-center gap-3 text-sm font-medium">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                      <i className="fas fa-share-nodes text-sm"></i>
                    </span>
                    Share Files
                  </span>
                  <i className="fas fa-arrow-right text-xs opacity-70"></i>
                </Link>
                <Link to="/settings" className="flex items-center justify-between rounded-xl bg-white/10 p-3 backdrop-blur-sm transition hover:bg-white/20">
                  <span className="flex items-center gap-3 text-sm font-medium">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                      <i className="fas fa-cog text-sm"></i>
                    </span>
                    Settings
                  </span>
                  <i className="fas fa-arrow-right text-xs opacity-70"></i>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── File detail modals — now with image/video/audio preview ── */}
      {selectedFile && (
        <FileDetailModal
          file={selectedFile}
          shares={shares}
          onClose={() => setSelectedFile(null)}
          onDownload={handleDownload}
        />
      )}
      {selectedRecentFile && (
        <FileDetailModal
          file={selectedRecentFile}
          shares={shares}
          onClose={() => setSelectedRecentFile(null)}
          onDownload={handleDownload}
        />
      )}
    </div>
  )
}