/**
 * Files.jsx — Fixed version
 *
 * Fixes vs original:
 *  1. handleToggleFavorite: await dispatch(fetchFiles(...)) so the list
 *     refreshes correctly after star/unstar (no stale-state flicker).
 *  2. handleDelete: await dispatch(remove(fileId)) before clearing confirm
 *     state and refreshing storage — prevents race condition.
 *  3. All other features (drag-drop, duplicate detection, rename, preview,
 *     pagination) are 100% preserved.
 */

import { useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchFiles, upload, remove, fetchStorage, rename } from '@/store/filesSlice'
import {
  downloadFile,
  toggleFavorite,
  computeSHA256,
  checkDuplicate,
  deleteFile as apiDeleteFile,
} from '@/api/filesApi'
import Alert from '@/components/ui/Alert'
import DuplicateModal from '@/components/DuplicateModal'
import { resolveFileName, stageFiles } from '@/utils/fileNaming'

export default function Files() {
  const dispatch = useDispatch()
  const { files, pagination, loading, uploading, storage, error } = useSelector((s) => s.files)

  // ── UI state ──────────────────────────────────────────────────────────────
  const [dragActive,      setDragActive]      = useState(false)
  const [search,          setSearch]          = useState('')
  const [ordering,        setOrdering]        = useState('-uploaded_at')
  const [selectedFiles,   setSelectedFiles]   = useState([])
  const [renamedCount,    setRenamedCount]     = useState(0)
  const [uploadSuccess,   setUploadSuccess]   = useState(null)
  const [deleteConfirm,   setDeleteConfirm]   = useState(null)
  const [previewFile,     setPreviewFile]     = useState(null)
  const [previewBlobUrl,  setPreviewBlobUrl]  = useState(null)
  const [previewLoading,  setPreviewLoading]  = useState(false)
  const [renameFile,      setRenameFile]      = useState(null)
  const [newFileName,     setNewFileName]     = useState('')
  const [renameError,     setRenameError]     = useState(null)
  const [starLoading,     setStarLoading]     = useState({})
  const [localFavs,       setLocalFavs]       = useState({})

  // ── Duplicate detection state ─────────────────────────────────────────────
  const [duplicateQueue,    setDuplicateQueue]    = useState([])
  const [duplicateModal,    setDuplicateModal]    = useState(null)
  const [checkedFiles,      setCheckedFiles]      = useState([])
  const [duplicateChecking, setDuplicateChecking] = useState(false)

  const fileInputRef = useRef()
  const filesRef     = useRef(files)
  useEffect(() => { filesRef.current = files }, [files])

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchFiles())
    dispatch(fetchStorage())
  }, [dispatch])

  useEffect(() => {
    const map = {}
    files.forEach((f) => { map[f.id] = f.is_favorite })
    setLocalFavs(map)
  }, [files])

  // ── Derived current page (clamped) ────────────────────────────────────────
  const currentPage = Math.min(
    pagination.current_page ?? 1,
    pagination.total_pages  ?? 1,
  )

  const goToPage = (page) => {
    const safe = Math.max(1, Math.min(page, pagination.total_pages ?? 1))
    dispatch(fetchFiles({ page: safe, search, ordering }))
  }

  // ── Preview blob URL ──────────────────────────────────────────────────────
  useEffect(() => {
    if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null) }
    if (!previewFile) return
    const isMedia = previewFile.mime_type?.includes('image') ||
      previewFile.mime_type?.includes('video') || previewFile.mime_type?.includes('audio')
    if (!isMedia) return
    let cancelled = false
    setPreviewLoading(true)
    downloadFile(previewFile.id)
      .then(({ data }) => { if (!cancelled) setPreviewBlobUrl(URL.createObjectURL(data)) })
      .catch(() => { if (!cancelled) setPreviewBlobUrl(null) })
      .finally(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  }, [previewFile]) // eslint-disable-line

  useEffect(() => () => { if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl) }, [previewBlobUrl])

  useEffect(() => {
    if (!uploadSuccess) return
    const t = setTimeout(() => setUploadSuccess(null), 4000)
    return () => clearTimeout(t)
  }, [uploadSuccess])

  // ── File helpers ──────────────────────────────────────────────────────────
  const getFileExtension            = (name) => { const p = name.split('.'); return p.length > 1 ? '.' + p[p.length - 1] : '' }
  const getFileNameWithoutExtension = (name) => { const e = getFileExtension(name); return e ? name.slice(0, -e.length) : name }

  const getFileIcon = (mime) => {
    if (!mime)                                                  return 'fa-file text-slate-400'
    if (mime.includes('pdf'))                                   return 'fa-file-pdf text-red-400'
    if (mime.includes('image'))                                 return 'fa-image text-blue-400'
    if (mime.includes('video'))                                 return 'fa-video text-purple-400'
    if (mime.includes('word') || mime.includes('document'))     return 'fa-file-word text-blue-600'
    if (mime.includes('spreadsheet') || mime.includes('sheet')) return 'fa-file-excel text-green-500'
    if (mime.includes('zip') || mime.includes('archive'))       return 'fa-file-zipper text-orange-400'
    if (mime.includes('audio'))                                 return 'fa-file-audio text-pink-400'
    if (mime.includes('text'))                                  return 'fa-file-lines text-gray-400'
    return 'fa-file text-slate-400'
  }

  const usedPercentage = storage ? Math.round((storage.used_bytes / storage.total_bytes) * 100) : 0

  // ── SHA-256 duplicate check pipeline ─────────────────────────────────────
  const runDuplicateChecks = async (rawFiles) => {
    if (!rawFiles.length) return
    setDuplicateChecking(true)
    const cleared = []
    const dupes   = []

    for (const f of rawFiles) {
      try {
        const sha256   = await computeSHA256(f)
        const { data } = await checkDuplicate(sha256)
        if (data.data?.is_duplicate) {
          dupes.push({ file: f, existingFile: data.data.existing_file })
        } else {
          cleared.push(f)
        }
      } catch {
        cleared.push(f)
      }
    }

    setDuplicateChecking(false)

    if (dupes.length > 0) {
      setCheckedFiles(cleared)
      setDuplicateQueue(dupes)
      setDuplicateModal(dupes[0])
    } else {
      _stageAll(cleared)
    }
  }

  const resolveDuplicate = (action, file) => {
    const [current, ...remaining] = duplicateQueue
    let extra = null

    if (action === 'rename') {
      extra = resolveFileName(file, new Set(filesRef.current.map((f) => f.original_name)))
    } else if (action === 'replace') {
      if (current?.existingFile?.id) {
        apiDeleteFile(current.existingFile.id).catch(() => {})
      }
      extra = file
    }

    const nextChecked = extra ? [...checkedFiles, extra] : [...checkedFiles]

    if (remaining.length > 0) {
      setDuplicateQueue(remaining)
      setDuplicateModal(remaining[0])
      setCheckedFiles(nextChecked)
    } else {
      setDuplicateQueue([])
      setDuplicateModal(null)
      setCheckedFiles([])
      _stageAll(nextChecked)
    }
  }

  const _stageAll = (rawFiles) => {
    if (!rawFiles.length) return
    const { resolved, renamedCount } = stageFiles(rawFiles, filesRef.current)
    setSelectedFiles(resolved)
    setRenamedCount(renamedCount)
  }

  // ── Entry points ──────────────────────────────────────────────────────────
  const openFilePicker = (e) => { if (e) e.stopPropagation(); fileInputRef.current?.click() }

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(e.type !== 'dragleave')
  }
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(false)
    runDuplicateChecks(Array.from(e.dataTransfer.files))
  }
  const handleFileSelect = (e) => {
    runDuplicateChecks(Array.from(e.target.files || []))
    e.target.value = ''
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFiles.length) return
    const count  = selectedFiles.length
    const result = await dispatch(upload(selectedFiles))
    if (!result.error) {
      setUploadSuccess(
        count === 1
          ? `"${selectedFiles[0].name}" uploaded successfully!`
          : `${count} files uploaded successfully!`,
      )
      await dispatch(fetchFiles({ search, ordering }))
      dispatch(fetchStorage())
    }
    setSelectedFiles([])
    setRenamedCount(0)
  }

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = async (file) => {
    try {
      const { data } = await downloadFile(file.id)
      const url = window.URL.createObjectURL(data)
      const a   = document.createElement('a')
      a.href = url; a.download = file.original_name; a.click()
      window.URL.revokeObjectURL(url)
    } catch { alert('Download failed.') }
  }

  // ── Delete (soft — moves to trash) ───────────────────────────────────────
  // FIX: await the dispatch so storage refresh happens after the delete lands
  const handleDelete = async (fileId) => {
    await dispatch(remove(fileId))
    setDeleteConfirm(null)
    dispatch(fetchStorage())
  }

  // ── Star / Favourite ──────────────────────────────────────────────────────
  // FIX: await fetchFiles so the list reflects the server state correctly
  const handleToggleFavorite = async (file) => {
    // Optimistic UI — flip immediately
    setLocalFavs((prev) => ({ ...prev, [file.id]: !prev[file.id] }))
    setStarLoading((prev) => ({ ...prev, [file.id]: true }))
    try {
      await toggleFavorite(file.id)
      // FIX: await so the star state doesn't flicker back
      await dispatch(fetchFiles({ page: currentPage, search, ordering }))
    } catch {
      // Roll back optimistic update on error
      setLocalFavs((prev) => ({ ...prev, [file.id]: file.is_favorite }))
      alert('Failed to update favourite.')
    } finally {
      setStarLoading((prev) => ({ ...prev, [file.id]: false }))
    }
  }

  // ── Rename ────────────────────────────────────────────────────────────────
  const handleRename = async () => {
    if (!newFileName.trim()) { setRenameError('Filename cannot be empty.'); return }
    const ext        = getFileExtension(renameFile.original_name)
    const fullNew    = newFileName.trim() + ext
    const nameExists = files.some(
      (f) => f.original_name.toLowerCase() === fullNew.toLowerCase() && f.id !== renameFile.id,
    )
    if (nameExists) { setRenameError(`A file named "${fullNew}" already exists.`); return }
    const result = await dispatch(rename({ fileId: renameFile.id, newName: newFileName }))
    if (!result.error) {
      setRenameFile(null); setNewFileName(''); setRenameError(null)
    } else {
      setRenameError(result.payload || 'Rename failed.')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#f8fafc] min-h-screen">

      <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" aria-hidden="true" />

      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-indigo-900">My Storage</h2>
            <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm">
              <i className="fas fa-folder-open text-indigo-400"></i>
              Total {storage?.file_count ?? 0} files stored
            </p>
          </div>
          <button type="button" onClick={openFilePicker}
            className="px-5 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2 w-full sm:w-auto justify-center">
            <i className="fas fa-plus"></i> New Upload
          </button>
        </header>

        {error && <Alert type="error" message={error} className="mb-6 rounded-2xl" />}

        {/* Duplicate-check progress indicator */}
        {duplicateChecking && (
          <div className="mb-6 flex items-center gap-3 px-5 py-4 bg-blue-50 border border-blue-200 rounded-2xl shadow-sm">
            <i className="fas fa-spinner fa-spin text-blue-500"></i>
            <div>
              <p className="text-sm font-bold text-blue-800">Checking for duplicate files…</p>
              <p className="text-xs text-blue-500">Computing file fingerprints</p>
            </div>
          </div>
        )}

        {/* Upload success toast */}
        {uploadSuccess && (
          <div className="mb-6 flex items-center gap-3 px-5 py-4 bg-green-50 border border-green-200 rounded-2xl shadow-sm">
            <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="fas fa-circle-check text-green-600"></i>
            </div>
            <p className="text-sm font-bold text-green-800 flex-1">{uploadSuccess}</p>
            <button type="button" onClick={() => setUploadSuccess(null)} className="text-green-400 hover:text-green-600">
              <i className="fas fa-times text-sm"></i>
            </button>
          </div>
        )}

        {/* Storage bar + Dropzone */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Storage Status</span>
                <i className="fas fa-database text-orange-400"></i>
              </div>
              <h3 className="text-2xl font-bold text-gray-800">{usedPercentage}% Full</h3>
              <p className="text-xs text-gray-400 mt-1">{storage?.used_mb} MB of {storage?.total_gb} GB used</p>
            </div>
            <div className="mt-6">
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${usedPercentage}%` }} />
              </div>
            </div>
          </div>

          <div
            role="button" tabIndex={0}
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            onClick={openFilePicker} onKeyDown={(e) => e.key === 'Enter' && openFilePicker()}
            className={`lg:col-span-2 rounded-3xl p-6 border-2 border-dashed transition-all cursor-pointer flex items-center justify-center gap-6 select-none
              ${dragActive ? 'border-indigo-400 bg-indigo-50/50' : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/20'}`}
          >
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-2xl pointer-events-none">
              <i className={`fas ${duplicateChecking || uploading ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`}></i>
            </div>
            <div className="pointer-events-none">
              <p className="font-bold text-gray-800">Drop files here to upload</p>
              <p className="text-sm text-gray-400">Duplicates are detected &amp; handled automatically</p>
            </div>
          </div>
        </div>

        {/* Selected files staging banner */}
        {selectedFiles.length > 0 && (
          <div className="bg-indigo-900 rounded-3xl p-6 mb-8 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-indigo-200">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                <i className="fas fa-file-circle-plus text-xl"></i>
              </div>
              <div className="min-w-0">
                <p className="font-bold">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} ready to upload
                </p>
                <p className="text-xs text-indigo-200 truncate">
                  {selectedFiles.map((f) => f.name).join(', ').slice(0, 60)}
                  {selectedFiles.map((f) => f.name).join(', ').length > 60 ? '…' : ''}
                </p>
                {renamedCount > 0 && (
                  <p className="text-xs text-amber-300 font-semibold mt-1 flex items-center gap-1">
                    <i className="fas fa-triangle-exclamation"></i>
                    {renamedCount} file{renamedCount !== 1 ? 's were' : ' was'} renamed to avoid conflicts
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto flex-shrink-0">
              <button type="button" onClick={() => { setSelectedFiles([]); setRenamedCount(0) }}
                className="px-4 py-2 text-sm font-bold text-indigo-200 hover:text-white transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleUpload} disabled={uploading}
                className="px-6 py-2 bg-white text-indigo-900 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-all flex items-center gap-2 disabled:opacity-60">
                {uploading
                  ? <><i className="fas fa-spinner fa-spin"></i> Uploading…</>
                  : <><i className="fas fa-upload"></i> Start Upload</>}
              </button>
            </div>
          </div>
        )}

        {/* File list */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h4 className="font-bold text-gray-800 flex items-center gap-2">
              <i className="fas fa-list text-indigo-500"></i> All Files
            </h4>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={ordering}
                onChange={(e) => { setOrdering(e.target.value); dispatch(fetchFiles({ page: 1, search, ordering: e.target.value })) }}
                className="px-3 py-2 bg-gray-50 border-none rounded-xl text-xs font-bold text-gray-500 focus:ring-2 focus:ring-indigo-100 cursor-pointer"
              >
                <option value="-uploaded_at">Newest First</option>
                <option value="uploaded_at">Oldest First</option>
                <option value="original_name">Name A–Z</option>
                <option value="-original_name">Name Z–A</option>
                <option value="-file_size">Largest First</option>
                <option value="file_size">Smallest First</option>
              </select>
              <div className="relative w-full sm:w-72">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-xs"></i>
                <input
                  type="text" placeholder="Search files…" value={search}
                  onChange={(e) => { setSearch(e.target.value); dispatch(fetchFiles({ page: 1, search: e.target.value, ordering })) }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
          </div>

          <div className="p-2">
            {loading && !files.length ? (
              <div className="py-20 text-center text-gray-400">
                <i className="fas fa-circle-notch fa-spin text-3xl mb-4"></i>
                <p className="text-sm">Fetching your files…</p>
              </div>
            ) : files.length === 0 ? (
              <div className="py-20 text-center text-gray-400">
                <i className="fas fa-folder-open text-4xl mb-4 opacity-20"></i>
                <p className="text-sm">No files found</p>
                <button type="button" onClick={openFilePicker}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all">
                  Upload your first file
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-y-1">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-gray-400">
                      <th className="px-4 py-2 font-bold">File Name</th>
                      <th className="px-4 py-2 font-bold hidden md:table-cell">Size</th>
                      <th className="px-4 py-2 font-bold hidden sm:table-cell">Uploaded</th>
                      <th className="px-4 py-2 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => {
                      const isFav = localFavs[file.id] ?? file.is_favorite
                      return (
                        <tr key={file.id} className="group hover:bg-indigo-50/50 transition-colors">
                          <td className="px-4 py-3 rounded-l-2xl">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                <i className={`fas ${getFileIcon(file.mime_type)} text-base`}></i>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-bold text-gray-800 truncate max-w-[120px] sm:max-w-xs">{file.original_name}</p>
                                  {isFav && <i className="fas fa-star text-yellow-400 text-[10px] flex-shrink-0"></i>}
                                </div>
                                <p className="text-[10px] text-gray-400 uppercase md:hidden">{file.file_size_display}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-sm text-gray-500">{file.file_size_display}</span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-sm text-gray-500">{new Date(file.uploaded_at).toLocaleDateString()}</span>
                          </td>
                          <td className="px-4 py-3 rounded-r-2xl text-right">
                            <div className="flex justify-end items-center gap-1">
                              <button type="button" onClick={() => setPreviewFile(file)}
                                className="p-2 text-gray-400 hover:text-indigo-600 transition-colors" title="Preview">
                                <i className="fas fa-eye text-sm"></i>
                              </button>
                              <button type="button" onClick={() => handleDownload(file)}
                                className="p-2 text-gray-400 hover:text-indigo-600 transition-colors" title="Download">
                                <i className="fas fa-download text-sm"></i>
                              </button>
                              <button type="button" onClick={() => handleToggleFavorite(file)}
                                disabled={!!starLoading[file.id]}
                                className={`p-2 transition-colors disabled:opacity-50 ${isFav ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-400 hover:text-yellow-400'}`}
                                title={isFav ? 'Remove from starred' : 'Add to starred'}>
                                <i className={`fas ${starLoading[file.id] ? 'fa-spinner fa-spin' : 'fa-star'} text-sm`}></i>
                              </button>
                              <button type="button"
                                onClick={() => { setRenameFile(file); setNewFileName(getFileNameWithoutExtension(file.original_name)); setRenameError(null) }}
                                className="p-2 text-gray-400 hover:text-amber-500 transition-colors" title="Rename">
                                <i className="fas fa-pen-to-square text-sm"></i>
                              </button>
                              <button type="button" onClick={() => setDeleteConfirm(file.id)}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Move to trash">
                                <i className="fas fa-trash-can text-sm"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        {(pagination.total_pages ?? 1) > 1 && (() => {
          const totalPages = pagination.total_pages
          const canPrev    = currentPage > 1
          const canNext    = currentPage < totalPages

          const nums = []
          for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
              nums.push(i)
            }
          }
          const items = []
          nums.forEach((n, idx) => {
            if (idx > 0 && n - nums[idx - 1] > 1) items.push('ellipsis-' + n)
            items.push(n)
          })

          return (
            <div className="mt-8 flex justify-center items-center gap-2 flex-wrap">
              <button type="button" disabled={!canPrev} onClick={() => goToPage(currentPage - 1)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-500 disabled:opacity-30 hover:border-indigo-300 transition-all"
                aria-label="Previous page">
                <i className="fas fa-chevron-left text-xs"></i>
              </button>

              {items.map((item) =>
                typeof item === 'string' && item.startsWith('ellipsis') ? (
                  <span key={item} className="w-10 h-10 flex items-center justify-center text-gray-400 text-sm select-none">…</span>
                ) : (
                  <button key={item} type="button" onClick={() => goToPage(item)}
                    aria-current={item === currentPage ? 'page' : undefined}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold border transition-all ${
                      item === currentPage
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                        : 'bg-white text-gray-600 border-gray-100 hover:border-indigo-300'
                    }`}>
                    {item}
                  </button>
                )
              )}

              <button type="button" disabled={!canNext} onClick={() => goToPage(currentPage + 1)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-500 disabled:opacity-30 hover:border-indigo-300 transition-all"
                aria-label="Next page">
                <i className="fas fa-chevron-right text-xs"></i>
              </button>

              <span className="w-full text-center text-xs text-gray-400 mt-1 select-none">
                Page {currentPage} of {totalPages}
              </span>
            </div>
          )
        })()}
      </div>

      {/* ══ MODALS ══ */}

      {duplicateModal && (
        <DuplicateModal
          duplicateFile={duplicateModal.existingFile}
          newFileName={duplicateModal.file.name}
          onRename={() => resolveDuplicate('rename', duplicateModal.file)}
          onReplace={() => resolveDuplicate('replace', duplicateModal.file)}
          onCancel={() => resolveDuplicate('cancel', duplicateModal.file)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-indigo-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-6">
              <i className="fas fa-trash-can"></i>
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Move to Trash?</h3>
            <p className="text-sm text-center text-gray-500 mb-8">You can restore it within 30 days.</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="py-3 font-bold text-gray-400 hover:text-gray-600">Cancel</button>
              <button type="button" onClick={() => handleDelete(deleteConfirm)}
                className="py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100">
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {renameFile && (
        <div className="fixed inset-0 bg-indigo-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <i className="fas fa-pen-to-square text-indigo-500"></i> Rename File
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 rounded-2xl">
                <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Current Name</p>
                <p className="text-sm font-medium text-indigo-900 truncate">{renameFile.original_name}</p>
              </div>
              {renameError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                  <i className="fas fa-circle-exclamation text-red-500 mt-0.5 flex-shrink-0"></i>
                  <p className="text-xs font-bold text-red-600">{renameError}</p>
                </div>
              )}
              <div className="relative">
                <input type="text" value={newFileName}
                  onChange={(e) => { setNewFileName(e.target.value); setRenameError(null) }}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-800 focus:ring-2 focus:ring-indigo-100"
                  placeholder="New filename…" autoFocus />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
                  {getFileExtension(renameFile.original_name)}
                </span>
              </div>
              <p className="text-xs text-gray-500">Extension is protected and cannot be changed</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-8">
              <button type="button" onClick={() => { setRenameFile(null); setRenameError(null) }}
                className="py-3 font-bold text-gray-400 hover:text-gray-600">Cancel</button>
              <button type="button" onClick={handleRename} disabled={!newFileName.trim()}
                className="py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {previewFile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-900 text-lg">File Preview</h3>
              <button type="button" onClick={() => setPreviewFile(null)} className="text-gray-400 hover:text-gray-600 text-xl">
                <i className="fas fa-times"></i>
              </button>
            </div>

            {previewFile.mime_type?.includes('image') ? (
              <div className="mb-6 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center min-h-[120px]">
                {previewLoading
                  ? <div className="py-12 flex flex-col items-center gap-3 text-gray-400"><i className="fas fa-circle-notch fa-spin text-2xl text-indigo-400"></i><p className="text-xs">Loading preview…</p></div>
                  : previewBlobUrl
                    ? <img src={previewBlobUrl} alt={previewFile.original_name} className="w-full max-h-72 object-contain" />
                    : <div className="py-12 flex flex-col items-center gap-2 text-gray-400"><i className="fas fa-image text-4xl text-blue-300"></i><p className="text-sm">Preview unavailable</p></div>
                }
              </div>
            ) : previewFile.mime_type?.includes('video') ? (
              <div className="mb-6 rounded-2xl overflow-hidden bg-black">
                {previewLoading
                  ? <div className="py-12 flex flex-col items-center gap-3"><i className="fas fa-circle-notch fa-spin text-2xl text-white"></i><p className="text-xs text-gray-300">Loading video…</p></div>
                  : previewBlobUrl ? <video controls className="w-full max-h-64" src={previewBlobUrl} /> : null
                }
              </div>
            ) : previewFile.mime_type?.includes('audio') ? (
              <div className="mb-6 p-6 bg-indigo-50 rounded-2xl">
                {previewLoading
                  ? <div className="flex items-center justify-center gap-3 text-indigo-400 py-2"><i className="fas fa-circle-notch fa-spin"></i><span className="text-sm">Loading audio…</span></div>
                  : previewBlobUrl ? <audio controls className="w-full" src={previewBlobUrl} /> : null
                }
              </div>
            ) : (
              <div className="mb-6 bg-gray-50 rounded-2xl p-12 text-center border border-gray-100">
                <i className={`fas ${getFileIcon(previewFile.mime_type)} text-6xl mb-3`}></i>
                <p className="text-sm text-gray-500 capitalize mt-2">{previewFile.mime_type?.split('/')[0] || 'File'} file</p>
                <p className="text-xs text-gray-400 mt-1">Download to open this file</p>
              </div>
            )}

            <div className="space-y-3 mb-6">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Filename</p>
                <p className="text-sm font-bold text-gray-800 break-all">{previewFile.original_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Size</p>
                  <p className="text-sm font-bold text-gray-800">{previewFile.file_size_display}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Type</p>
                  <p className="text-sm font-bold text-gray-800 break-all">{previewFile.mime_type || 'Unknown'}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Uploaded</p>
                <p className="text-sm font-bold text-gray-800">{new Date(previewFile.uploaded_at).toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { handleDownload(previewFile); setPreviewFile(null) }}
                className="py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2">
                <i className="fas fa-download"></i> Download
              </button>
              <button type="button" onClick={() => { handleToggleFavorite(previewFile); setPreviewFile(null) }}
                disabled={!!starLoading[previewFile.id]}
                className={`py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                  (localFavs[previewFile.id] ?? previewFile.is_favorite)
                    ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                <i className="fas fa-star"></i>
                {(localFavs[previewFile.id] ?? previewFile.is_favorite) ? 'Unstar' : 'Star'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}