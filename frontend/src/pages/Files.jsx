import { useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchFiles, upload, remove, fetchStorage, rename } from '@/store/filesSlice'
import { downloadFile } from '@/api/filesApi'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'

export default function Files() {
  const dispatch = useDispatch()
  const { files, pagination, loading, uploading, storage, error } = useSelector((s) => s.files)
  const [dragActive, setDragActive] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [renameFile, setRenameFile] = useState(null)
  const [newFileName, setNewFileName] = useState('')
  const [renameError, setRenameError] = useState(null) // ✅ NEW: For unique filename validation
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
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDownload = async (file) => {
    try {
      const { data } = await downloadFile(file.id)
      const url = window.URL.createObjectURL(data)
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

  // ✅ UPDATED: handleRename with frontend uniqueness validation
  const handleRename = async () => {
    if (!newFileName.trim()) {
      setRenameError('Filename cannot be empty.')
      return
    }

    // Construct full filename with extension
    const ext = getFileExtension(renameFile.original_name)
    const fullNewName = newFileName.trim() + ext

    // ✅ CHECK: Filename uniqueness (excluding current file)
    const nameExists = files.some(
      (f) => f.original_name.toLowerCase() === fullNewName.toLowerCase() && f.id !== renameFile.id
    )

    if (nameExists) {
      setRenameError(`You already have a file named "${fullNewName}". Please choose a different name.`)
      return
    }

    // ✅ PROCEED: If unique, dispatch rename action
    await dispatch(rename({ fileId: renameFile.id, newName: newFileName }))
    setRenameFile(null)
    setNewFileName('')
    setRenameError(null)
  }

  const getFileExtension = (filename) => {
    const parts = filename.split('.')
    return parts.length > 1 ? '.' + parts[parts.length - 1] : ''
  }

  const getFileNameWithoutExtension = (filename) => {
    const ext = getFileExtension(filename)
    return ext ? filename.slice(0, -ext.length) : filename
  }

  const usedPercentage = storage ? Math.round((storage.used_bytes / storage.total_bytes) * 100) : 0

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <header className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-3xl font-bold text-indigo-900">My Storage</h2>
            <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm">
              <i className="fas fa-folder-open text-indigo-400"></i>
              Total {storage?.file_count ?? 0} files stored
            </p>
          </div>
          <div className="flex gap-3">
             <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2"
             >
               <i className="fas fa-plus"></i> New Upload
             </button>
          </div>
        </header>

        {error && <Alert type="error" message={error} className="mb-6 rounded-2xl" />}

        {/* Top Row: Storage & Upload Dropzone */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Storage Details */}
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

          {/* Hidden Input & Interaction Logic for Dropzone */}
          <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />

          {/* Upload Dropzone */}
          <div 
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`lg:col-span-2 rounded-3xl p-6 border-2 border-dashed transition-all cursor-pointer flex items-center justify-center gap-6
              ${dragActive ? 'border-indigo-400 bg-indigo-50/50' : 'border-gray-200 bg-white hover:border-indigo-300'}`}
          >
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-2xl">
              <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`}></i>
            </div>
            <div>
              <p className="font-bold text-gray-800">Drop files here to upload</p>
              <p className="text-sm text-gray-400">Or click to browse your computer</p>
            </div>
          </div>
        </div>

        {/* Selected Files Preview Modal-style (only if files selected) */}
        {selectedFiles.length > 0 && (
          <div className="bg-indigo-900 rounded-3xl p-6 mb-8 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-indigo-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                <i className="fas fa-file-circle-plus text-xl"></i>
              </div>
              <div>
                <p className="font-bold">{selectedFiles.length} files selected</p>
                <p className="text-xs text-indigo-200">Ready to sync to your cloud storage</p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => setSelectedFiles([])} className="px-4 py-2 text-sm font-bold text-indigo-200 hover:text-white transition-colors">Cancel</button>
              <button 
                onClick={handleUpload}
                disabled={uploading}
                className="px-6 py-2 bg-white text-indigo-900 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-all flex items-center gap-2"
              >
                {uploading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-upload"></i>}
                Start Upload
              </button>
            </div>
          </div>
        )}

        {/* Search & Main File List */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h4 className="font-bold text-gray-800 flex items-center gap-2">
              <i className="fas fa-list text-indigo-500"></i> All Files
            </h4>
            <div className="relative w-full sm:w-72">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-xs"></i>
              <input 
                type="text" 
                placeholder="Search files..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  dispatch(fetchFiles({ search: e.target.value }))
                }}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="p-2">
            {loading && !files.length ? (
              <div className="py-20 text-center text-gray-400">
                <i className="fas fa-circle-notch fa-spin text-3xl mb-4"></i>
                <p className="text-sm">Fetching your files...</p>
              </div>
            ) : files.length === 0 ? (
              <div className="py-20 text-center text-gray-400">
                <i className="fas fa-folder-open text-4xl mb-4 opacity-20"></i>
                <p className="text-sm">No files found matching your criteria</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-gray-400">
                      <th className="px-4 py-2 font-bold">File Name</th>
                      <th className="px-4 py-2 font-bold hidden md:table-cell">Size</th>
                      <th className="px-4 py-2 font-bold hidden sm:table-cell">Uploaded</th>
                      <th className="px-4 py-2 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => (
                      <tr key={file.id} className="group hover:bg-indigo-50/50 transition-colors">
                        <td className="px-4 py-3 rounded-l-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                              <i className={`fas ${file.mime_type?.includes('pdf') ? 'fa-file-pdf text-red-400' : file.mime_type?.includes('image') ? 'fa-image text-blue-400' : 'fa-file-alt'}`}></i>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-800 truncate max-w-[140px] sm:max-w-xs">{file.original_name}</p>
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
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setPreviewFile(file)} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"><i className="fas fa-eye text-sm"></i></button>
                            <button onClick={() => handleDownload(file)} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"><i className="fas fa-download text-sm"></i></button>
                            <button 
                              onClick={() => {
                                setRenameFile(file)
                                setNewFileName(getFileNameWithoutExtension(file.original_name))
                                setRenameError(null) // ✅ Clear error when opening modal
                              }} 
                              className="p-2 text-gray-400 hover:text-amber-500 transition-colors"
                            >
                              <i className="fas fa-pen-to-square text-sm"></i>
                            </button>
                            <button onClick={() => setDeleteConfirm(file.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><i className="fas fa-trash-can text-sm"></i></button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
              disabled={!pagination.previous}
              onClick={() => dispatch(fetchFiles({ page: pagination.current_page - 1 }))}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-500 disabled:opacity-30 hover:border-indigo-300 transition-all"
            >
              <i className="fas fa-chevron-left text-xs"></i>
            </button>
            <span className="text-sm font-bold text-gray-600">
              Page {pagination.current_page} of {pagination.total_pages}
            </span>
            <button
              disabled={!pagination.next}
              onClick={() => dispatch(fetchFiles({ page: pagination.current_page + 1 }))}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-500 disabled:opacity-30 hover:border-indigo-300 transition-all"
            >
              <i className="fas fa-chevron-right text-xs"></i>
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-indigo-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-6">
              <i className="fas fa-trash-can"></i>
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Delete File?</h3>
            <p className="text-sm text-center text-gray-500 mb-8">This action is permanent and cannot be undone.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="py-3 font-bold text-gray-400 hover:text-gray-600">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ UPDATED: Rename Modal with Uniqueness Validation */}
      {renameFile && (
        <div className="fixed inset-0 bg-indigo-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <i className="fas fa-pen-to-square text-indigo-500"></i> Rename File
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 rounded-2xl">
                <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Current Name</p>
                <p className="text-sm font-medium text-indigo-900 truncate">{renameFile.original_name}</p>
              </div>
              
              {/* ✅ NEW: Show error if filename already exists */}
              {renameError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs font-bold text-red-600">{renameError}</p>
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => {
                    setNewFileName(e.target.value)
                    setRenameError(null) // ✅ Clear error when typing
                  }}
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-800 focus:ring-2 focus:ring-indigo-100"
                  placeholder="New filename..."
                  autoFocus
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                  {getFileExtension(renameFile.original_name)}
                </span>
              </div>
              <p className="text-xs text-gray-500">Extension is protected and cannot be changed</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-8">
              <button 
                onClick={() => {
                  setRenameFile(null)
                  setRenameError(null)
                }} 
                className="py-3 font-bold text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
              <button 
                onClick={handleRename}
                disabled={!newFileName.trim()}
                className="py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-indigo-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-900">File Details</h3>
              <button onClick={() => setPreviewFile(null)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times"></i></button>
            </div>
            <div className="space-y-4 mb-8">
               <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Filename</span>
                  <span className="text-sm font-bold text-gray-800 break-all">{previewFile.original_name}</span>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Size</span>
                    <span className="text-sm font-bold text-gray-800">{previewFile.file_size_display}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</span>
                    <span className="text-sm font-bold text-gray-800 uppercase">{previewFile.mime_type?.split('/')[1] || 'File'}</span>
                  </div>
               </div>
            </div>
            <button 
              onClick={() => { handleDownload(previewFile); setPreviewFile(null); }}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
              <i className="fas fa-download"></i> Download Now
            </button>
          </div>
        </div>
      )}
    </div>
  )
}