import api from '@/api/axios'

// ── Files ─────────────────────────────────────────────────────────────────────

export const getFiles = (page = 1, search = '', ordering = '-uploaded_at') =>
  api.get('/api/files/', { params: { page, search, ordering } })

/**
 * Compute SHA-256 of a File/Blob in the browser using SubtleCrypto.
 * Returns the hex string.
 */
export async function computeSHA256(file) {
  const buffer     = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Check if a file with the given sha256 already exists in the user's storage.
 */
export const checkDuplicate = (sha256) =>
  api.post('/api/files/check-duplicate/', { sha256 })

/**
 * Upload one or more File objects.
 */
export const uploadFiles = (files) => {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  return api.post('/api/files/upload/', form, {
    headers: { 'Content-Type': undefined },
  })
}

// FIX: DELETE hits FileDetailView.delete() → calls file_obj.delete_file() → soft delete (move to trash)
export const deleteFile = (fileId) => api.delete(`/api/files/${fileId}/`)

export const downloadFile = (fileId) =>
  api.get(`/api/files/${fileId}/download/`, { responseType: 'blob' })

export const renameFile = (fileId, newName) =>
  api.post(`/api/files/${fileId}/rename/`, { new_name: newName })

export const getStorageInfo = () => api.get('/api/files/storage/')

// ── Favourites ────────────────────────────────────────────────────────────────

export const toggleFavorite = (fileId) =>
  api.post(`/api/files/${fileId}/favorite/`)

export const getFavorites = (page = 1) =>
  api.get('/api/files/favorites/', { params: { page } })

// ── Trash ─────────────────────────────────────────────────────────────────────

export const getTrash = (page = 1) =>
  api.get('/api/files/trash/', { params: { page } })

// FIX: POST to /restore/ hits RestoreFileView → calls file_obj.restore_file()
export const restoreFile = (fileId) =>
  api.post(`/api/files/${fileId}/restore/`)

// FIX: POST to /delete-permanently/ hits PermanentlyDeleteView → calls file_obj.permanently_delete()
export const permanentlyDelete = (fileId) =>
  api.post(`/api/files/${fileId}/delete-permanently/`)

export const emptyTrash = () =>
  api.post('/api/files/trash/empty/')

// ── Batch operations ──────────────────────────────────────────────────────────

export const batchDelete = (fileIds) =>
  api.post('/api/files/batch-delete/', { file_ids: fileIds })

export const batchRestore = (fileIds) =>
  api.post('/api/files/batch-restore/', { file_ids: fileIds })