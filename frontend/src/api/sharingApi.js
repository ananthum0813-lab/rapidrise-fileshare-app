import api from './axios'
import axios from 'axios'

const SHARING = '/api/sharing'

// ── Public axios instance (no Authorization header, no auth interceptors) ─────
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
})

// ── Single-file Share management ──────────────────────────────────────────────
export const getShares = (page = 1, status = '', file_id = '') =>
  api.get(`${SHARING}/`, { params: { page, status, file_id } })

export const createShare = (data) =>
  api.post(`${SHARING}/create/`, data)

export const revokeShare = (id) =>
  api.post(`${SHARING}/${id}/revoke/`)

// ── Multi-file ZIP Share management (NEW) ─────────────────────────────────────
/**
 * Create ZIP shares — one per recipient, containing all selected files.
 * @param {object} data — { file_ids: UUID[], recipient_emails: string[],
 *                          expiration_hours: number, message?: string, zip_name?: string }
 */
export const createZipShare = (data) =>
  api.post(`${SHARING}/zip/create/`, data)

export const getZipShares = (page = 1, status = '') =>
  api.get(`${SHARING}/zip/`, { params: { page, status } })

export const revokeZipShare = (id) =>
  api.post(`${SHARING}/zip/${id}/revoke/`)

// Public ZIP share endpoints (no auth)
export const getPublicZipShareInfo = (token) =>
  publicApi.get(`${SHARING}/public/zip/${token}/`)

export const downloadPublicZipShare = (token) =>
  publicApi.get(`${SHARING}/public/zip/${token}/download/`, { responseType: 'blob' })

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getGlobalAnalytics = () =>
  api.get(`${SHARING}/analytics/`)

export const getShareAnalytics = (shareId) =>
  api.get(`${SHARING}/${shareId}/analytics/`)

// ── File Requests ─────────────────────────────────────────────────────────────
export const getFileRequests = (page = 1, status = '') =>
  api.get(`${SHARING}/requests/`, { params: { page, status } })

export const createFileRequest = (data) =>
  api.post(`${SHARING}/requests/`, data)

export const closeFileRequest = (id) =>
  api.delete(`${SHARING}/requests/${id}/`)

// ── Per-recipient upload endpoints (PUBLIC — no auth) ─────────────────────────
export const getRecipientUploadInfo = (token) =>
  publicApi.get(`${SHARING}/requests/upload/${token}/`)

export const submitRecipientUpload = (token, formData, config = {}) =>
  publicApi.post(`${SHARING}/requests/upload/${token}/submit/`, formData, {
    headers: { 'Content-Type': undefined },
    ...config,
  })

// ── Legacy: shared-token public upload (PUBLIC — no auth) ─────────────────────
export const getPublicRequestInfo = (token) =>
  publicApi.get(`${SHARING}/requests/public/${token}/`)

export const uploadToRequest = (token, formData, config = {}) =>
  publicApi.post(`${SHARING}/requests/public/${token}/upload/`, formData, {
    headers: { 'Content-Type': undefined },
    ...config,
  })

// ── Submission Inbox ──────────────────────────────────────────────────────────
export const getInbox = (page = 1, status = '', source_type = '', scan_status = '') =>
  api.get(`${SHARING}/inbox/`, { params: { page, status, source_type, scan_status } })

export const reviewSubmission = (id, action, note = '') =>
  api.post(`${SHARING}/inbox/${id}/review/`, { action, note })

export const deleteInfectedFile = (submissionId) =>
  api.delete(`${SHARING}/inbox/${submissionId}/delete-file/`)

// ── Public single-file share endpoints (PUBLIC — no auth) ─────────────────────
export const getPublicShareInfo = (token) =>
  publicApi.get(`${SHARING}/public/${token}/`)

export const downloadPublicShare = (token) =>
  publicApi.get(`${SHARING}/public/${token}/download/`, { responseType: 'blob' })