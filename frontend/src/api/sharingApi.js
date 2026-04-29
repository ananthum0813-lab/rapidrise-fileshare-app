import api from './axios'

const SHARING = '/api/sharing'

// Authenticated endpoints
export const getShares = (page = 1, status = '') =>
  api.get(`${SHARING}/`, { params: { page, status } })

export const createShare = (data) =>
  api.post(`${SHARING}/create/`, data)

export const revokeShare = (id) =>
  api.post(`${SHARING}/${id}/revoke/`)

// Public endpoints (no auth required)
export const getPublicShareInfo = (token) =>
  api.get(`${SHARING}/public/${token}/`)

export const downloadPublicShare = (token) =>
  api.get(`${SHARING}/public/${token}/download/`, { responseType: 'blob' })