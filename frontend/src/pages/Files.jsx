import { useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchFiles, upload, remove, fetchStorage, rename } from '@/store/filesSlice'
import {
  downloadFile,
  toggleFavorite,
} from '@/api/filesApi'
import Alert from '@/components/ui/Alert'

export default function Files() {
  const dispatch = useDispatch()
  const { files, pagination, loading, uploading, storage, error } = useSelector((s) => s.files)

  const [dragActive, setDragActive]         = useState(false)
  const [search, setSearch]                 = useState('')
  const [ordering, setOrdering]             = useState('-uploaded_at')
  // track current page so star toggle stays on the same page
  const [currentPage, setCurrentPage]       = useState(1)
  const [selectedFiles, setSelectedFiles]   = useState([])
  const [renamedCount, setRenamedCount]     = useState(0)      // how many files were auto-renamed
  const [uploadSuccess, setUploadSuccess]   = useState(null)   // success toast message
  const [deleteConfirm, setDeleteConfirm]   = useState(null)
  const [previewFile, setPreviewFile]       = useState(null)
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [renameFile, setRenameFile]         = useState(null)
  const [newFileName, setNewFileName]       = useState('')
  const [renameError, setRenameError]       = useState(null)
  const [starLoading, setStarLoading]       = useState({})
  const [localFavs, setLocalFavs]           = useState({})

  const fileInputRef = useRef()

  // ── KEY FIX: Keep a ref to `files` so resolveFileName always reads the
  // latest list — avoids the stale-closure bug where handleFileSelect /
  // handleDrop captured an outdated `files` array from an earlier render.
  const filesRef = useRef(files)
  useEffect(() => { filesRef.current = files }, [files])

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchFiles())
    dispatch(fetchStorage())
  }, [dispatch])

  useEffect(() => {
    const map = {}
    files.forEach((f) => { map[f.id] = f.is_favorite })
    setLocalFavs(map)
  }, [files])

  // ── Sync currentPage from redux pagination ───────────────────────────────
  useEffect(() => {
    if (pagination.current_page) setCurrentPage(pagination.current_page)
  }, [pagination.current_page])

  // ── Blob URL for auth-gated media preview ────────────────────────────────
  useEffect(() => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl)
      setPreviewBlobUrl(null)
    }
    if (!previewFile) return

    const isMedia =
      previewFile.mime_type?.includes('image') ||
      previewFile.mime_type?.includes('video') ||
      previewFile.mime_type?.includes('audio')

    if (!isMedia) return

    let cancelled = false
    setPreviewLoading(true)

    downloadFile(previewFile.id)
      .then(({ data }) => { if (!cancelled) setPreviewBlobUrl(URL.createObjectURL(data)) })
      .catch(() => { if (!cancelled) setPreviewBlobUrl(null) })
      .finally(() => { if (!cancelled) setPreviewLoading(false) })

    return () => { cancelled = true }
  }, [previewFile]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl) }
  }, [previewBlobUrl])

  // ── Auto-dismiss upload success toast after 4 s ──────────────────────────
  useEffect(() => {
    if (!uploadSuccess) return
    const t = setTimeout(() => setUploadSuccess(null), 4000)
    return () => clearTimeout(t)
  }, [uploadSuccess])

  // ── Open file picker ──────────────────────────────────────────────────────
  const openFilePicker = (e) => {
    if (e) e.stopPropagation()
    fileInputRef.current?.click()
  }

  // ── resolveFileName ───────────────────────────────────────────────────────
  // Guarantees a unique name BEFORE upload by checking against:
  //   1. Every file already on the server  — read from filesRef (never stale)
  //   2. Every file already staged in this batch  — tracked via pendingNames
  //
  // Why filesRef matters: handleFileSelect / handleDrop are defined once and
  // close over the `files` value from that render. If the user selects files
  // before the first fetchFiles resolves (or after a background refetch)
  // the closed-over `files` could be stale. filesRef.current is always live.
  //
  // Django-suffix awareness: Django renames stored files using patterns like
  // "image_1_.png" or "image_2.png". We strip those suffixes when comparing
  // base names so "image.png", "image_1_.png", "image_2.png" are all treated
  // as the same base "image", preventing Django from doubling up suffixes.
  //
  // Output format: "photo (1).jpg", "photo (2).jpg" … (Windows / GDrive style)
  const resolveFileName = (file, pendingNames = new Set()) => {
    const currentFiles = filesRef.current   // always the latest server list

    // Strip Django-appended numeric suffixes from base names:
    // "image_1_" → "image", "image_2" → "image", "report_3_" → "report"
    const stripDjangoSuffix = (base) =>
      base.replace(/_\d+_?$/, '').replace(/\s+$/, '').trim()

    // Split the incoming file name into base + extension
    const lastDot = file.name.lastIndexOf('.')
    const ext     = lastDot !== -1 ? file.name.slice(lastDot)   : ''        // ".png"
    const base    = lastDot !== -1 ? file.name.slice(0, lastDot) : file.name // "image"
    const cleanBase = stripDjangoSuffix(base).toLowerCase()

    // Build the complete set of names already in use (exact matches)
    const allNames = new Set([
      ...currentFiles.map((f) => f.original_name.toLowerCase()),
      ...Array.from(pendingNames).map((n) => n.toLowerCase()),
    ])

    // Build the set of stripped base names already on the server so we can
    // detect Django-renamed variants (e.g. "image_1_.png" shares base "image")
    const allCleanBases = new Set(
      currentFiles.map((f) => {
        const d = f.original_name.lastIndexOf('.')
        const b = d !== -1 ? f.original_name.slice(0, d) : f.original_name
        return stripDjangoSuffix(b).toLowerCase()
      })
    )

    // Check whether there is any conflict at all
    const exactConflict = allNames.has(file.name.toLowerCase())
    const baseConflict  = allCleanBases.has(cleanBase)

    // No conflict — return the original File object untouched
    if (!exactConflict && !baseConflict) return file

    // Find the lowest free counter: "image (1).png", "image (2).png", …
    let counter   = 1
    let candidate = ''
    do {
      candidate = `${base} (${counter})${ext}`
      counter++
    } while (allNames.has(candidate.toLowerCase()))

    // Re-wrap as a new File with the resolved name
    // (File objects are immutable so we must create a new one)
    return new File([file], candidate, { type: file.type, lastModified: file.lastModified })
  }

  // ── stageFiles — shared by picker + drop ─────────────────────────────────
  // Runs conflict resolution across the whole batch before setting state,
  // so two files with the same name in the same drop both get unique names.
  const stageFiles = (raw) => {
    if (!raw.length) return
    const pendingNames = new Set()
    let renamed = 0
    const resolved = raw.map((f) => {
      const r = resolveFileName(f, pendingNames)
      pendingNames.add(r.name)
      if (r.name !== f.name) renamed++
      return r
    })
    setSelectedFiles(resolved)
    setRenamedCount(renamed)
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(e.type !== 'dragleave')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    stageFiles(Array.from(e.dataTransfer.files))
  }

  // ── File input onChange ───────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    stageFiles(Array.from(e.target.files || []))
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
          : `${count} files uploaded successfully!`
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
      a.href     = url
      a.download = file.original_name
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Download failed.')
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (fileId) => {
    await dispatch(remove(fileId))
    setDeleteConfirm(null)
    dispatch(fetchStorage())
  }

  // ── Star / Favourite ──────────────────────────────────────────────────────
  // pass `page: currentPage` so the list re-fetches the SAME page,
  // not page 1 (which was the bug causing pagination reset on star click).
  const handleToggleFavorite = async (file) => {
    setLocalFavs((prev) => ({ ...prev, [file.id]: !prev[file.id] }))
    setStarLoading((prev) => ({ ...prev, [file.id]: true }))
    try {
      await toggleFavorite(file.id)
      dispatch(fetchFiles({ page: currentPage, search, ordering }))
    } catch {
      setLocalFavs((prev) => ({ ...prev, [file.id]: !prev[file.id] }))
      alert('Failed to update favourite. Please try again.')
    } finally {
      setStarLoading((prev) => ({ ...prev, [file.id]: false }))
    }
  }

  // ── Rename ────────────────────────────────────────────────────────────────
  const handleRename = async () => {
    if (!newFileName.trim()) { setRenameError('Filename cannot be empty.'); return }
    const ext         = getFileExtension(renameFile.original_name)
    const fullNewName = newFileName.trim() + ext
    const nameExists  = files.some(
      (f) => f.original_name.toLowerCase() === fullNewName.toLowerCase() && f.id !== renameFile.id
    )
    if (nameExists) {
      setRenameError(`A file named "${fullNewName}" already exists. Please choose a different name.`)
      return
    }
    await dispatch(rename({ fileId: renameFile.id, newName: newFileName }))
    setRenameFile(null)
    setNewFileName('')
    setRenameError(null)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getFileExtension = (filename) => {
    const parts = filename.split('.')
    return parts.length > 1 ? '.' + parts[parts.length - 1] : ''
  }
  const getFileNameWithoutExtension = (filename) => {
    const ext = getFileExtension(filename)
    return ext ? filename.slice(0, -ext.length) : filename
  }
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

  const usedPercentage = storage
    ? Math.round((storage.used_bytes / storage.total_bytes) * 100)
    : 0

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#f8fafc] min-h-screen">

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        aria-hidden="true"
      />

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
          <button
            type="button"
            onClick={openFilePicker}
            className="px-5 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <i className="fas fa-plus"></i> New Upload
          </button>
        </header>

        {error && <Alert type="error" message={error} className="mb-6 rounded-2xl" />}

        {/* Upload success toast */}
        {uploadSuccess && (
          <div className="mb-6 flex items-center gap-3 px-5 py-4 bg-green-50 border border-green-200 rounded-2xl shadow-sm">
            <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="fas fa-circle-check text-green-600"></i>
            </div>
            <p className="text-sm font-bold text-green-800 flex-1">{uploadSuccess}</p>
            <button
              type="button"
              onClick={() => setUploadSuccess(null)}
              className="text-green-400 hover:text-green-600 transition-colors"
            >
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
              <p className="text-xs text-gray-400 mt-1">{storage?.used_mb}MB of {storage?.total_gb}GB used</p>
            </div>
            <div className="mt-6">
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-1000"
                  style={{ width: `${usedPercentage}%` }}
                />
              </div>
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={openFilePicker}
            onKeyDown={(e) => e.key === 'Enter' && openFilePicker()}
            className={`lg:col-span-2 rounded-3xl p-6 border-2 border-dashed transition-all cursor-pointer
              flex items-center justify-center gap-6 select-none
              ${dragActive
                ? 'border-indigo-400 bg-indigo-50/50'
                : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/20'
              }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-2xl pointer-events-none">
              <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`}></i>
            </div>
            <div className="pointer-events-none">
              <p className="font-bold text-gray-800">Drop files here to upload</p>
              <p className="text-sm text-gray-400">Or click to browse your computer</p>
            </div>
          </div>
        </div>

        {/* Selected files banner */}
        {selectedFiles.length > 0 && (
          <div className="bg-indigo-900 rounded-3xl p-6 mb-8 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-indigo-200">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                <i className="fas fa-file-circle-plus text-xl"></i>
              </div>
              <div className="min-w-0">
                <p className="font-bold">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                </p>
                <p className="text-xs text-indigo-200 truncate">
                  {selectedFiles.map((f) => f.name).join(', ').slice(0, 60)}
                  {selectedFiles.map((f) => f.name).join(', ').length > 60 ? '…' : ''}
                </p>
                {/* Auto-rename notice */}
                {renamedCount > 0 && (
                  <p className="text-xs text-amber-300 font-semibold mt-1 flex items-center gap-1">
                    <i className="fas fa-triangle-exclamation"></i>
                    {renamedCount} file{renamedCount !== 1 ? 's were' : ' was'} renamed to avoid conflicts
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto flex-shrink-0">
              <button
                type="button"
                onClick={() => { setSelectedFiles([]); setRenamedCount(0) }}
                className="px-4 py-2 text-sm font-bold text-indigo-200 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="px-6 py-2 bg-white text-indigo-900 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {uploading
                  ? <><i className="fas fa-spinner fa-spin"></i> Uploading…</>
                  : <><i className="fas fa-upload"></i> Start Upload</>
                }
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
                onChange={(e) => {
                  setOrdering(e.target.value)
                  setCurrentPage(1)
                  dispatch(fetchFiles({ page: 1, search, ordering: e.target.value }))
                }}
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
                  type="text"
                  placeholder="Search files..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setCurrentPage(1)
                    dispatch(fetchFiles({ page: 1, search: e.target.value, ordering }))
                  }}
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
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
                >
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
                                  <p className="text-sm font-bold text-gray-800 truncate max-w-[120px] sm:max-w-xs">
                                    {file.original_name}
                                  </p>
                                  {isFav && (
                                    <i className="fas fa-star text-yellow-400 text-[10px] flex-shrink-0"></i>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-400 uppercase md:hidden">{file.file_size_display}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-sm text-gray-500">{file.file_size_display}</span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-sm text-gray-500">
                              {new Date(file.uploaded_at).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 rounded-r-2xl text-right">
                            <div className="flex justify-end items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setPreviewFile(file)}
                                className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                title="Preview"
                              >
                                <i className="fas fa-eye text-sm"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownload(file)}
                                className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                title="Download"
                              >
                                <i className="fas fa-download text-sm"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleFavorite(file)}
                                disabled={!!starLoading[file.id]}
                                className={`p-2 transition-colors disabled:opacity-50 ${
                                  isFav
                                    ? 'text-yellow-400 hover:text-yellow-500'
                                    : 'text-gray-400 hover:text-yellow-400'
                                }`}
                                title={isFav ? 'Remove from starred' : 'Add to starred'}
                              >
                                <i className={`fas ${starLoading[file.id] ? 'fa-spinner fa-spin' : 'fa-star'} text-sm`}></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRenameFile(file)
                                  setNewFileName(getFileNameWithoutExtension(file.original_name))
                                  setRenameError(null)
                                }}
                                className="p-2 text-gray-400 hover:text-amber-500 transition-colors"
                                title="Rename"
                              >
                                <i className="fas fa-pen-to-square text-sm"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm(file.id)}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                title="Move to trash"
                              >
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
        {pagination.total_pages > 1 && (
          <div className="mt-8 flex justify-center items-center gap-4">
            <button
              type="button"
              disabled={!pagination.previous}
              onClick={() => {
                const page = currentPage - 1
                setCurrentPage(page)
                dispatch(fetchFiles({ page, search, ordering }))
              }}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-500 disabled:opacity-30 hover:border-indigo-300 transition-all"
            >
              <i className="fas fa-chevron-left text-xs"></i>
            </button>
            <span className="text-sm font-bold text-gray-600">
              Page {currentPage} of {pagination.total_pages}
            </span>
            <button
              type="button"
              disabled={!pagination.next}
              onClick={() => {
                const page = currentPage + 1
                setCurrentPage(page)
                dispatch(fetchFiles({ page, search, ordering }))
              }}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-500 disabled:opacity-30 hover:border-indigo-300 transition-all"
            >
              <i className="fas fa-chevron-right text-xs"></i>
            </button>
          </div>
        )}
      </div>

      {/* ══════════ MODALS ══════════ */}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-indigo-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-6">
              <i className="fas fa-trash-can"></i>
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Move to Trash?</h3>
            <p className="text-sm text-center text-gray-500 mb-8">
              The file will be moved to trash. You can restore it within 30 days.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="py-3 font-bold text-gray-400 hover:text-gray-600">
                Cancel
              </button>
              <button type="button" onClick={() => handleDelete(deleteConfirm)} className="py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100">
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
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
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => { setNewFileName(e.target.value); setRenameError(null) }}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-800 focus:ring-2 focus:ring-indigo-100"
                  placeholder="New filename…"
                  autoFocus
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
                  {getFileExtension(renameFile.original_name)}
                </span>
              </div>
              <p className="text-xs text-gray-500">Extension is protected and cannot be changed</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-8">
              <button type="button" onClick={() => { setRenameFile(null); setRenameError(null) }} className="py-3 font-bold text-gray-400 hover:text-gray-600">
                Cancel
              </button>
              <button type="button" onClick={handleRename} disabled={!newFileName.trim()} className="py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-900 text-lg">File Preview</h3>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Media preview via blob URL (auth-safe) */}
            {previewFile.mime_type?.includes('image') ? (
              <div className="mb-6 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center min-h-[120px]">
                {previewLoading ? (
                  <div className="py-12 flex flex-col items-center gap-3 text-gray-400">
                    <i className="fas fa-circle-notch fa-spin text-2xl text-indigo-400"></i>
                    <p className="text-xs">Loading preview…</p>
                  </div>
                ) : previewBlobUrl ? (
                  <img src={previewBlobUrl} alt={previewFile.original_name} className="w-full max-h-72 object-contain" />
                ) : (
                  <div className="py-12 flex flex-col items-center gap-2 text-gray-400">
                    <i className="fas fa-image text-4xl text-blue-300"></i>
                    <p className="text-sm">Preview unavailable</p>
                  </div>
                )}
              </div>
            ) : previewFile.mime_type?.includes('video') ? (
              <div className="mb-6 rounded-2xl overflow-hidden bg-black">
                {previewLoading ? (
                  <div className="py-12 flex flex-col items-center gap-3">
                    <i className="fas fa-circle-notch fa-spin text-2xl text-white"></i>
                    <p className="text-xs text-gray-300">Loading video…</p>
                  </div>
                ) : previewBlobUrl ? (
                  <video controls className="w-full max-h-64" src={previewBlobUrl}>
                    Your browser does not support video preview.
                  </video>
                ) : (
                  <div className="py-12 flex flex-col items-center gap-2 text-gray-400">
                    <i className="fas fa-video text-4xl text-purple-300"></i>
                    <p className="text-sm">Preview unavailable</p>
                  </div>
                )}
              </div>
            ) : previewFile.mime_type?.includes('audio') ? (
              <div className="mb-6 p-6 bg-indigo-50 rounded-2xl">
                {previewLoading ? (
                  <div className="flex items-center justify-center gap-3 text-indigo-400 py-2">
                    <i className="fas fa-circle-notch fa-spin"></i>
                    <span className="text-sm">Loading audio…</span>
                  </div>
                ) : previewBlobUrl ? (
                  <audio controls className="w-full" src={previewBlobUrl} />
                ) : (
                  <p className="text-sm text-center text-gray-500">Audio preview unavailable</p>
                )}
              </div>
            ) : (
              <div className="mb-6 bg-gray-50 rounded-2xl p-12 text-center border border-gray-100">
                <i className={`fas ${getFileIcon(previewFile.mime_type)} text-6xl mb-3`}></i>
                <p className="text-sm text-gray-500 capitalize mt-2">
                  {previewFile.mime_type?.split('/')[0] || 'File'} file
                </p>
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
              <button
                type="button"
                onClick={() => { handleDownload(previewFile); setPreviewFile(null) }}
                className="py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
              >
                <i className="fas fa-download"></i> Download
              </button>
              <button
                type="button"
                onClick={() => { handleToggleFavorite(previewFile); setPreviewFile(null) }}
                disabled={!!starLoading[previewFile.id]}
                className={`py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                  (localFavs[previewFile.id] ?? previewFile.is_favorite)
                    ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
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