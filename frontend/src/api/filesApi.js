import api from '@/api/axios'

// ── Files ─────────────────────────────────────────────────────────────────────

export const getFiles = (page = 1, search = '', ordering = '-uploaded_at') =>
  api.get('/api/files/', { params: { page, search, ordering } })

/**
 * Upload one or more File objects.
 *
 * IMPORTANT: We must NOT set Content-Type manually here.
 * If the axios instance has a default `Content-Type: application/json` header
 * (very common), it will override the multipart/form-data boundary that the
 * browser generates for FormData — and Django will never see the files.
 *
 * Passing `Content-Type: undefined` tells axios to delete the header entirely
 * for this request, letting the browser/axios auto-detect FormData and set:
 *   Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryXXX
 */
export const uploadFiles = (files) => {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))

  return api.post('/api/files/upload/', form, {
    headers: {
      'Content-Type': undefined,   // ← removes any default; browser sets it
    },
  })
}

export const deleteFile  = (fileId) => api.delete(`/api/files/${fileId}/`)

export const downloadFile = (fileId) =>
  api.get(`/api/files/${fileId}/download/`, { responseType: 'blob' })

export const renameFile = (fileId, newName) =>
  api.post(`/api/files/${fileId}/rename/`, { new_name: newName })

export const getStorageInfo = () => api.get('/api/files/storage/')

// ── Favourites / Starring ─────────────────────────────────────────────────────

export const toggleFavorite = (fileId) =>
  api.post(`/api/files/${fileId}/favorite/`)

export const getFavorites = (page = 1) =>
  api.get('/api/files/favorites/', { params: { page } })

// ── Trash / Recycle bin ───────────────────────────────────────────────────────

export const getTrash = (page = 1) =>
  api.get('/api/files/trash/', { params: { page } })

export const restoreFile = (fileId) =>
  api.post(`/api/files/${fileId}/restore/`)

export const permanentlyDelete = (fileId) =>
  api.post(`/api/files/${fileId}/delete-permanently/`)

export const emptyTrash = () => api.post('/api/files/trash/empty/')

// ── Batch operations ──────────────────────────────────────────────────────────

export const batchDelete = (fileIds) =>
  api.post('/api/files/batch-delete/', { file_ids: fileIds })

export const batchRestore = (fileIds) =>
  api.post('/api/files/batch-restore/', { file_ids: fileIds })