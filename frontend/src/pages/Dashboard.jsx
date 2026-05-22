import { useEffect, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchFiles, fetchStorage } from '@/store/filesSlice'
import { fetchShares, fetchZipShares, fetchGlobalAnalytics } from '@/store/sharingSlice'
import { downloadFile, getFiles, getStorageDashboard, getFilesWithPageSize } from '@/api/filesApi'

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

const CAT_META = {
  Images:    { colour: '#6366f1', icon: 'fa-image' },
  Videos:    { colour: '#8b5cf6', icon: 'fa-film' },
  PDFs:      { colour: '#ef4444', icon: 'fa-file-pdf' },
  Documents: { colour: '#2563eb', icon: 'fa-file-word' },
  Archives:  { colour: '#f59e0b', icon: 'fa-file-zipper' },
  Others:    { colour: '#94a3b8', icon: 'fa-file' },
}

// ── Activity helpers ──────────────────────────────────────────────────────────

function buildActivityData(files) {
  const days = []
  const now  = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    days.push({
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date:  d.toDateString(),
      count: 0,
    })
  }
  files.forEach((f) => {
    if (!f.uploaded_at) return
    const slot = days.find((d) => d.date === new Date(f.uploaded_at).toDateString())
    if (slot) slot.count++
  })
  return days
}

// Returns { thisWeek, lastWeek, trend: 'up'|'down'|'same' }
function calcWeekTrend(files) {
  const now      = new Date()
  const msPerDay = 86400000
  let thisWeek = 0, lastWeek = 0
  files.forEach((f) => {
    if (!f.uploaded_at) return
    const diffDays = (now - new Date(f.uploaded_at)) / msPerDay
    if (diffDays < 7)        thisWeek++
    else if (diffDays < 14)  lastWeek++
  })
  const trend = thisWeek > lastWeek ? 'up' : thisWeek < lastWeek ? 'down' : 'same'
  return { thisWeek, lastWeek, trend }
}

function ActivityChart({ files }) {
  const data   = buildActivityData(files)
  const max    = Math.max(...data.map((d) => d.count), 1)
  const chartH = 68
  const barW   = 28
  const gap    = 10
  const totalW = data.length * (barW + gap) - gap

  return (
    <svg
      viewBox={`0 0 ${totalW} ${chartH + 22}`}
      className="w-full overflow-visible"
      style={{ maxHeight: 96 }}
    >
      <defs>
        <linearGradient id="dbBarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {data.map((d, i) => {
        const barH = max === 0 ? 2 : Math.max(3, (d.count / max) * chartH)
        const x    = i * (barW + gap)
        const y    = chartH - barH
        return (
          <g key={d.date}>
            <rect
              x={x} y={y} width={barW} height={barH} rx={5}
              fill={d.count === 0 ? '#e2e8f0' : 'url(#dbBarGrad)'}
            />
            {d.count > 0 && (
              <text
                x={x + barW / 2} y={y - 4}
                textAnchor="middle" fontSize="8" fill="#6366f1" fontWeight="700"
              >
                {d.count}
              </text>
            )}
            <text
              x={x + barW / 2} y={chartH + 15}
              textAnchor="middle" fontSize="8.5" fill="#94a3b8" fontWeight="600"
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Blob URL hook ─────────────────────────────────────────────────────────────
function useFileBlobUrl(file) {
  const [blobUrl, setBlobUrl]     = useState(null)
  const [blobLoading, setLoading] = useState(false)

  useEffect(() => {
    setBlobUrl(null)
    if (!file) return
    const isMedia =
      file.mime_type?.includes('image') || file.mime_type?.includes('video') ||
      file.mime_type?.includes('audio') || file.mime_type?.includes('pdf')
    if (!isMedia) return
    let cancelled = false
    setLoading(true)
    downloadFile(file.id)
      .then(({ data }) => {
        if (!cancelled) {
          const blob = new Blob([data], { type: file.mime_type || data.type || 'application/octet-stream' })
          setBlobUrl(URL.createObjectURL(blob))
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [file?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [blobUrl])

  return { blobUrl, blobLoading }
}

// ── File detail modal ─────────────────────────────────────────────────────────
function FileDetailModal({ file, shares, onClose, onDownload }) {
  const { blobUrl, blobLoading } = useFileBlobUrl(file)
  const handleOpen = () => { if (blobUrl) window.open(blobUrl, '_blank') }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-lg font-bold text-slate-900">File Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition text-xl">
            <i className="fas fa-xmark"></i>
          </button>
        </div>

        {file.mime_type?.includes('image') && (
          <div className="mb-6 rounded-2xl overflow-hidden bg-indigo-50 border border-indigo-100 flex items-center justify-center min-h-[120px]">
            {blobLoading ? (
              <div className="py-10 flex flex-col items-center gap-2 text-slate-400">
                <i className="fas fa-circle-notch fa-spin text-2xl text-indigo-400"></i>
                <p className="text-xs">Loading preview…</p>
              </div>
            ) : blobUrl ? (
              <img src={blobUrl} alt={file.original_name} className="w-full max-h-56 object-contain rounded-2xl" />
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
              <video controls className="w-full max-h-52" src={blobUrl}>Your browser does not support video preview.</video>
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

        {file.mime_type?.includes('pdf') && (
          <div className="mb-6 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 min-h-[500px] relative" style={{ overflow: 'hidden' }}>
            {blobLoading ? (
              <div className="py-10 flex flex-col items-center gap-3 text-gray-400">
                <i className="fas fa-circle-notch fa-spin text-2xl text-indigo-400"></i>
                <p className="text-xs">Loading PDF…</p>
              </div>
            ) : blobUrl ? (
              <div style={{ height: '500px', position: 'relative', overflow: 'hidden' }}>
                <iframe
                  src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&page=1`}
                  title={file.original_name}
                  style={{ height: '580px', border: 'none', display: 'block', position: 'absolute', top: '-46px', left: 0, width: '100%' }}
                />
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center gap-2 text-gray-400">
                <i className="fas fa-file-pdf text-4xl text-red-300"></i>
                <p className="text-sm">PDF preview unavailable</p>
              </div>
            )}
          </div>
        )}

        {!file.mime_type?.includes('image') && !file.mime_type?.includes('video') &&
         !file.mime_type?.includes('audio') && !file.mime_type?.includes('pdf') && (
          <div className="mb-6 p-6 bg-indigo-50 rounded-2xl text-center">
            <div className={`text-5xl text-${getFileColor(file.mime_type)}-600 mb-3`}>
              <i className={`fas ${getFileIcon(file.mime_type)}`}></i>
            </div>
            <p className="font-bold text-slate-900 break-all text-sm">{file.original_name}</p>
          </div>
        )}

        {(file.mime_type?.includes('image') || file.mime_type?.includes('video') ||
          file.mime_type?.includes('audio') || file.mime_type?.includes('pdf')) && (
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
              {shares.some((s) => s.file_id === file.id && s.status === 'active') ? '🔗 Shared' : '🔒 Private'}
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
          {file.mime_type?.includes('pdf') && (
            <button
              onClick={handleOpen}
              disabled={!blobUrl}
              className="w-full py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all shadow-sm flex items-center justify-center gap-2 text-sm"
            >
              <i className="fas fa-arrow-up-right-from-square"></i> Open PDF
            </button>
          )}
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

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const dispatch = useDispatch()
  const { user } = useSelector((s) => s.auth)
  const { files, storage, loading: filesLoading } = useSelector((s) => s.files)
  const { shares, pagination, zipShares, zipPagination, globalAnalytics } = useSelector((s) => s.sharing)

  const [searchQuery, setSearchQuery]               = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [selectedFile, setSelectedFile]             = useState(null)
  const [highlightedIndex, setHighlightedIndex]     = useState(-1)
  const [selectedRecentFile, setSelectedRecentFile] = useState(null)

  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const debounceTimer  = useRef(null)
  const searchRef      = useRef(null)
  const searchInputRef = useRef(null)

  const [storageDash, setStorageDash]           = useState(null)
  const [activityFiles, setActivityFiles]       = useState([])
  const [activityLoading, setActivityLoading]   = useState(false)

  // ── Click-outside search ──────────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearchDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const runSearch = useCallback(async (query) => {
    if (!query.trim()) { setSearchResults([]); setSearchLoading(false); return }
    setSearchLoading(true)
    try {
      const { data } = await getFiles(1, query.trim(), '-uploaded_at')
      setSearchResults(data?.data?.results?.slice(0, 8) ?? [])
    } catch { setSearchResults([]) }
    finally { setSearchLoading(false) }
  }, [])

  const handleSearchChange = (query) => {
    setSearchQuery(query)
    setHighlightedIndex(-1)
    if (!query.trim()) {
      setShowSearchDropdown(false); setSearchResults([])
      clearTimeout(debounceTimer.current); return
    }
    setShowSearchDropdown(true); setSearchLoading(true)
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => runSearch(query), 350)
  }

  useEffect(() => () => clearTimeout(debounceTimer.current), [])

  const handleSearchKeydown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((p) => (p < searchResults.length - 1 ? p + 1 : p))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((p) => (p > 0 ? p - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && searchResults[highlightedIndex]) {
          setSelectedFile(searchResults[highlightedIndex])
          setShowSearchDropdown(false); setSearchQuery(''); setSearchResults([])
        }
        break
      case 'Escape':
        e.preventDefault(); setShowSearchDropdown(false); break
      default: break
    }
  }

  // ── Data fetches ──────────────────────────────────────────────────────────
  const loadStorageDash = useCallback(async () => {
    try {
      const { data } = await getStorageDashboard()
      setStorageDash(data.data)
    } catch { /* silently fail */ }
  }, [])

  // ── Activity fetch: paginate until all files from last 7 days are loaded ───
  // A single page_size=100 call misses users with >100 recent files.
  // We keep fetching pages (newest-first, 100/page) and stop as soon as the
  // oldest file on the current page predates the 7-day window, or there are
  // no more pages. This ensures every upload in the chart window is counted,
  // which also makes the Top Day insight accurate.
  const loadActivityFiles = useCallback(async () => {
    setActivityLoading(true)
    try {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 7)
      cutoff.setHours(0, 0, 0, 0)          // start of 7 days ago

      let page      = 1
      let collected = []

      for (;;) {
        const { data }   = await getFilesWithPageSize(page, '', '-uploaded_at', 100)
        const results    = data?.data?.results    || []
        const totalPages = data?.data?.total_pages ?? 1

        if (results.length === 0) break
        collected = [...collected, ...results]

        // Once the oldest file on this page is before the cutoff, every
        // subsequent page will be even older — safe to stop.
        const oldest     = results[results.length - 1]
        const oldestDate = oldest?.uploaded_at ? new Date(oldest.uploaded_at) : null

        if (page >= totalPages || (oldestDate && oldestDate < cutoff)) break
        page++
      }

      setActivityFiles(collected)
    } catch {
      setActivityFiles([]) // chart falls back to Redux slice via chartFiles
    } finally {
      setActivityLoading(false)
    }
  }, [])

  useEffect(() => {
    dispatch(fetchFiles({ page: 1 }))
    dispatch(fetchStorage())
    dispatch(fetchShares({ page: 1 }))
    dispatch(fetchZipShares({ page: 1 }))
    dispatch(fetchGlobalAnalytics())
    loadStorageDash()
    loadActivityFiles()
  }, [dispatch, loadStorageDash, loadActivityFiles])

  const handleDownload = async (file) => {
    try {
      const { data } = await downloadFile(file.id)
      const url = window.URL.createObjectURL(data)
      const a   = document.createElement('a')
      a.href = url; a.download = file.original_name; a.click()
      window.URL.revokeObjectURL(url)
    } catch { alert('Download failed.') }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const usedPercentage = storage ? Math.round((storage.used_bytes / storage.total_bytes) * 100) : 0
  const recentFiles    = files.slice(0, 5)

  const activeShares = (() => {
    if (globalAnalytics?.totals?.active_count != null) return globalAnalytics.totals.active_count
    return shares.filter((s) => s.status === 'active').length +
           zipShares.filter((z) => z.status === 'active').length
  })()

  const fileTypeBreakdown = (storageDash?.type_usage || []).map((row) => ({
    label:  row.category,
    count:  row.count,
    bytes:  row.bytes,
    colour: CAT_META[row.category]?.colour || '#94a3b8',
    icon:   CAT_META[row.category]?.icon   || 'fa-file',
  }))
  const totalFileCount = fileTypeBreakdown.reduce((sum, t) => sum + t.count, 0)

  // ── Activity: prefer the 100-file fetch, fall back to Redux files ─────────
  // This ensures the chart always has data to render if files exist at all.
  const chartFiles   = activityFiles.length > 0 ? activityFiles : files
  const hasAnyFiles  = (storage?.file_count ?? 0) > 0
  // Only show "no data" empty state if we genuinely have 0 files in the account
  const showChart    = hasAnyFiles

  // Week-over-week trend (uses chartFiles for the comparison)
  const weekTrend = calcWeekTrend(chartFiles)

  // Today's upload count from the best available source
  const todayUploads = chartFiles.filter((f) => {
    if (!f.uploaded_at) return false
    return new Date(f.uploaded_at).toDateString() === new Date().toDateString()
  }).length

  // Top file type for the new "dominant type" badge
  const topType = fileTypeBreakdown.length > 0
    ? fileTypeBreakdown.reduce((a, b) => (b.count > a.count ? b : a))
    : null

  // ── Insights strip derived values ────────────────────────────────────────
  // Average file size (bytes) across all typed files from storageDash
  const totalBytes   = fileTypeBreakdown.reduce((s, t) => s + (t.bytes || 0), 0)
  const avgFileBytes = totalFileCount > 0 ? Math.round(totalBytes / totalFileCount) : 0
  const fmtBytes = (b) => {
    if (!b) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let v = b, i = 0
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
    return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
  }

  // Most active upload day across chartFiles
  const dayCounts = chartFiles.reduce((acc, f) => {
    if (!f.uploaded_at) return acc
    const day = new Date(f.uploaded_at).toLocaleDateString('en-US', { weekday: 'short' })
    acc[day] = (acc[day] || 0) + 1
    return acc
  }, {})
  const mostActiveDay = Object.keys(dayCounts).length > 0
    ? Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0][0]
    : null

  // Shared ratio
  const sharedFileIds = new Set(shares.filter((s) => s.status === 'active').map((s) => s.file_id))
  const sharedRatio   = (storage?.file_count ?? 0) > 0
    ? Math.round((sharedFileIds.size / storage.file_count) * 100)
    : 0

  const avatarUrl = `https://ui-avatars.com/api/?name=${user?.first_name || 'User'}&background=6366f1&color=fff`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-md shadow-indigo-200">
              <i className="fas fa-layer-group text-white text-base"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                  {user?.first_name ? `${user.first_name}'s Workspace` : 'My Workspace'}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 border border-emerald-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                {todayUploads > 0 && (
                  <span className="ml-2 text-indigo-500 font-medium">
                    · {todayUploads} upload{todayUploads !== 1 ? 's' : ''} today
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
              {showSearchDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 max-h-96 overflow-y-auto">
                  {searchLoading ? (
                    <div className="p-4 text-center text-slate-400 text-sm">
                      <i className="fas fa-spinner fa-spin mr-2"></i>Searching…
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
                              onClick={() => {
                                setSelectedFile(file); setShowSearchDropdown(false)
                                setSearchQuery(''); setSearchResults([])
                              }}
                              onMouseEnter={() => setHighlightedIndex(index)}
                              className={`p-4 cursor-pointer transition-colors ${highlightedIndex === index ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
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
                        <Link
                          to={`/files?search=${encodeURIComponent(searchQuery)}`}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                          onClick={() => setShowSearchDropdown(false)}
                        >
                          See all results in Files <i className="fas fa-arrow-right"></i>
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
            <Link to="/settings">
              <img src={avatarUrl} alt="avatar" className="h-11 w-11 rounded-full ring-2 ring-white shadow-md cursor-pointer hover:opacity-80 transition" />
            </Link>
          </div>
        </div>

        {/* ── Stats Grid ──────────────────────────────────────────────────── */}
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
            {/* NEW: dominant type badge */}
            {topType && (
              <p className="mt-1 text-xs" style={{ color: topType.colour }}>
                <i className={`fas ${topType.icon} mr-1`}></i>
                Mostly {topType.label.toLowerCase()}
              </p>
            )}
            <Link to="/files" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:gap-2 transition-all">
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
            <p className="mt-1 text-xs text-slate-500">singles &amp; ZIP shares</p>
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
            <Link to="/storage" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:gap-2 transition-all">
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
            <p className="mt-1 text-xs text-slate-500">storage used</p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <i className="fas fa-pulse text-xs"></i> Active
            </span>
          </div>
        </div>

        {/* ── Bottom Grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* ── Col 1: Storage Overview + File Types ─────────────────────── */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm self-start">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Storage Overview</h2>
              <button className="text-slate-400 hover:text-slate-600 transition">
                <i className="fas fa-ellipsis-h"></i>
              </button>
            </div>

            {/* Donut — smaller than before (h-32 instead of h-40) */}
            <div className="flex items-center justify-center">
              <div className="relative h-32 w-32">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" strokeWidth="10" className="fill-none stroke-slate-100" />
                  <circle
                    cx="50" cy="50" r="42" strokeWidth="10" strokeLinecap="round"
                    className="fill-none stroke-indigo-500 transition-all duration-700"
                    strokeDasharray={`${(usedPercentage / 100) * 264} 264`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900">{usedPercentage}%</span>
                  <span className="text-[10px] text-slate-500">Used</span>
                </div>
              </div>
            </div>

            {/* Used / Free — tighter spacing */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  <span className="text-xs text-slate-600">Used Space</span>
                </div>
                <span className="text-xs font-semibold text-slate-900">{storage?.used_mb} MB</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                  <span className="text-xs text-slate-600">Free Space</span>
                </div>
                <span className="text-xs font-semibold text-slate-900">
                  {storage ? (storage.total_gb * 1024 - storage.used_mb) : 0} MB
                </span>
              </div>
            </div>

            {/* File Types — from server type_usage aggregate */}
            {fileTypeBreakdown.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">File Types</p>
                <div className="space-y-2">
                  {fileTypeBreakdown.map((type) => {
                    const pct = totalFileCount > 0 ? Math.round((type.count / totalFileCount) * 100) : 0
                    return (
                      <div key={type.label}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="flex items-center gap-1.5 font-medium text-slate-600">
                            <i className={`fas ${type.icon} text-[10px]`} style={{ color: type.colour }}></i>
                            {type.label}
                          </span>
                          <span className="text-slate-400">{type.count} file{type.count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: type.colour }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Skeleton while loading */}
            {!storageDash && fileTypeBreakdown.length === 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">File Types</p>
                {[1, 2, 3].map((n) => (
                  <div key={n} className="animate-pulse">
                    <div className="flex justify-between mb-1">
                      <div className="h-3 w-16 bg-slate-100 rounded"></div>
                      <div className="h-3 w-10 bg-slate-100 rounded"></div>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100"></div>
                  </div>
                ))}
              </div>
            )}
            {/* ── green tick removed ── */}
          </div>

          {/* ── Col 2: Activity Chart + Recent Files ─────────────────────── */}
          <div className="flex flex-col gap-6">

            {/* Upload Activity Chart */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900">Upload Activity</h2>
                <div className="flex items-center gap-2">
                  {/* NEW: week-over-week trend badge */}
                  {hasAnyFiles && !activityLoading && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                      weekTrend.trend === 'up'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : weekTrend.trend === 'down'
                          ? 'bg-red-50 text-red-600 border-red-100'
                          : 'bg-slate-50 text-slate-500 border-slate-100'
                    }`}>
                      <i className={`fas fa-arrow-${weekTrend.trend === 'up' ? 'up' : weekTrend.trend === 'down' ? 'down' : 'right'} text-[8px]`}></i>
                      {weekTrend.thisWeek} this week
                    </span>
                  )}
                  <span className="text-xs text-slate-400 font-medium bg-slate-50 rounded-lg px-2 py-1 border border-slate-100">
                    Last 7 days
                  </span>
                </div>
              </div>

              {activityLoading ? (
                <div className="py-6 text-center text-slate-400">
                  <i className="fas fa-circle-notch fa-spin text-xl text-indigo-300 mb-2 block"></i>
                  <p className="text-xs">Loading activity…</p>
                </div>
              ) : showChart ? (
                <>
                  <ActivityChart files={chartFiles} />
                  {/* Show a note if files exist but none in last 7 days */}
                  {weekTrend.thisWeek === 0 && (
                    <p className="text-center text-xs text-slate-400 mt-2">
                      No uploads in the last 7 days
                    </p>
                  )}
                </>
              ) : (
                <div className="py-6 text-center text-slate-400">
                  <i className="fas fa-chart-bar text-3xl text-slate-200 mb-2 block"></i>
                  <p className="text-xs">No upload data yet</p>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {storage?.file_count ?? 0} total file{(storage?.file_count ?? 0) !== 1 ? 's' : ''} in workspace
                </span>
                <Link to="/files" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                  View All →
                </Link>
              </div>
            </div>

            {/* Recent Files */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex-1">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-900">Recent Files</h2>
                <Link to="/files" className="text-sm font-medium text-indigo-600 hover:underline">View All</Link>
              </div>
              <div className="space-y-1">
                {recentFiles.length > 0 ? (
                  recentFiles.map((file) => {
                    const isShared = shares.some((s) => s.file_id === file.id && s.status === 'active')
                    return (
                      <div
                        key={file.id}
                        onClick={() => setSelectedRecentFile(file)}
                        className="group flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition hover:border-slate-200 hover:bg-slate-50 cursor-pointer"
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-${getFileColor(file.mime_type)}-50 text-${getFileColor(file.mime_type)}-600`}>
                          <i className={`fas ${getFileIcon(file.mime_type)} text-sm`}></i>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{file.original_name}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            {file.file_size_display}
                            {isShared && (
                              <><span>•</span><i className="fas fa-share-alt text-[10px]"></i><span>Shared</span></>
                            )}
                          </p>
                        </div>
                        <button className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-200 transition text-xs">
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
          </div>

          {/* ── Col 3: Quick Actions + NEW Storage Health tips ────────────── */}
          <div className="flex flex-col gap-6">
            <div className="relative overflow-hidden rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-600 via-indigo-600 to-purple-600 p-5 text-white shadow-lg shadow-indigo-500/30">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="relative">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 mb-0.5">Navigation</p>
                <h2 className="text-base font-semibold text-white mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  {[
                    { to: '/files',   icon: 'fa-cloud-arrow-up', label: 'Upload Files' },
                    { to: '/sharing', icon: 'fa-share-nodes',    label: 'Share Files' },
                    { to: '/storage', icon: 'fa-database',       label: 'Manage Storage' },
                    { to: '/settings',icon: 'fa-cog',            label: 'Settings' },
                  ].map(({ to, icon, label }) => (
                    <Link key={to} to={to} className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm transition hover:bg-white/20">
                      <span className="flex items-center gap-2.5 text-sm font-medium">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 shrink-0">
                          <i className={`fas ${icon} text-xs`}></i>
                        </span>
                        {label}
                      </span>
                      <i className="fas fa-arrow-right text-xs opacity-60"></i>
                    </Link>
                  ))}
                </div>

                {/* Storage mini-bar */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-indigo-200 font-medium">Storage</span>
                    <span className="text-indigo-200">{usedPercentage}% used</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-white/70 transition-all duration-700"
                      style={{ width: `${usedPercentage}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-indigo-300 mt-1.5">
                    {storage?.used_mb ?? 0} MB of {storage?.total_gb ?? 1} GB used
                  </p>
                </div>
              </div>
            </div>

            {/* ── NEW: Storage Health card ─────────────────────────────── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                  <i className="fas fa-lightbulb text-amber-500 text-xs"></i>
                </div>
                <h2 className="text-sm font-semibold text-slate-900">Storage Health</h2>
              </div>
              <div className="space-y-2">
                {/* Tip 1: usage level */}
                <div className={`flex items-start gap-2.5 rounded-xl p-2.5 ${
                  usedPercentage >= 80 ? 'bg-red-50' : usedPercentage >= 50 ? 'bg-amber-50' : 'bg-slate-50'
                }`}>
                  <i className={`fas ${usedPercentage >= 80 ? 'fa-triangle-exclamation text-red-500' : 'fa-circle-check text-emerald-500'} text-xs mt-0.5 shrink-0`}></i>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {usedPercentage >= 80
                      ? 'Storage is almost full. Delete or move files to free space.'
                      : usedPercentage >= 50
                        ? 'Over halfway used. Consider cleaning up older files.'
                        : `Storage is healthy — ${100 - usedPercentage}% still available.`}
                  </p>
                </div>
                {/* Tip 2: trash reminder if storageDash has trash info */}
                {(storageDash?.trash_count ?? 0) > 0 && (
                  <div className="flex items-start gap-2.5 rounded-xl p-2.5 bg-orange-50">
                    <i className="fas fa-trash text-orange-400 text-xs mt-0.5 shrink-0"></i>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {storageDash.trash_count} file{storageDash.trash_count !== 1 ? 's' : ''} in trash.{' '}
                      <Link to="/trash" className="text-indigo-600 font-medium hover:underline">Empty trash</Link> to free space.
                    </p>
                  </div>
                )}
                {/* Tip 3: uploads this week */}
                <div className="flex items-start gap-2.5 rounded-xl p-2.5 bg-indigo-50">
                  <i className="fas fa-arrow-up-from-bracket text-indigo-400 text-xs mt-0.5 shrink-0"></i>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {weekTrend.thisWeek > 0
                      ? `${weekTrend.thisWeek} file${weekTrend.thisWeek !== 1 ? 's' : ''} uploaded this week.`
                      : 'No uploads this week yet.'}
                    {weekTrend.trend === 'up' && weekTrend.lastWeek > 0 && (
                      <span className="text-emerald-600 font-medium"> Up from {weekTrend.lastWeek} last week.</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── Insights Strip ──────────────────────────────────────────────── */}
        {/* Full-width row of 4 compact metric tiles — fills the space below  */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">

          {/* Tile 1: Avg file size */}
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <i className="fas fa-weight-hanging text-sm"></i>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Avg Size</p>
              <p className="text-sm font-bold text-slate-900 truncate">{fmtBytes(avgFileBytes)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">per file</p>
            </div>
          </div>

          {/* Tile 2: Shared ratio */}
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <i className="fas fa-share-nodes text-sm"></i>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Shared</p>
              <p className="text-sm font-bold text-slate-900">{sharedRatio}%</p>
              <p className="text-[10px] text-slate-400 mt-0.5">of your files</p>
            </div>
          </div>

          {/* Tile 3: Most active upload day */}
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <i className="fas fa-calendar-day text-sm"></i>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Top Day</p>
              <p className="text-sm font-bold text-slate-900">{mostActiveDay ?? '—'}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">most uploads</p>
            </div>
          </div>

          {/* Tile 4: This week vs last week */}
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              weekTrend.trend === 'up' ? 'bg-emerald-50 text-emerald-600'
              : weekTrend.trend === 'down' ? 'bg-red-50 text-red-500'
              : 'bg-slate-50 text-slate-500'
            }`}>
              <i className={`fas text-sm ${
                weekTrend.trend === 'up' ? 'fa-arrow-trend-up'
                : weekTrend.trend === 'down' ? 'fa-arrow-trend-down'
                : 'fa-minus'
              }`}></i>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">This Week</p>
              <p className="text-sm font-bold text-slate-900">{weekTrend.thisWeek} uploads</p>
              <p className="text-[10px] mt-0.5 font-medium" style={{
                color: weekTrend.trend === 'up' ? '#10b981' : weekTrend.trend === 'down' ? '#ef4444' : '#94a3b8'
              }}>
                {weekTrend.lastWeek > 0
                  ? `vs ${weekTrend.lastWeek} last week`
                  : 'no data last week'}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
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