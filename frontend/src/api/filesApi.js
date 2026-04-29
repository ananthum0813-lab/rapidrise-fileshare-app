import api from './axios'

const FILES = '/api/files'

export const getFiles = (page = 1, search = '', ordering = '-uploaded_at') =>
  api.get(`${FILES}/`, { params: { page, search, ordering } })

export const uploadFiles = (files) => {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  return api.post(`${FILES}/upload/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const getFileDetail = (id) =>
  api.get(`${FILES}/${id}/`)

export const downloadFile = (id) =>
  api.get(`${FILES}/${id}/download/`, { responseType: 'blob' })

export const deleteFile = (id) =>
  api.delete(`${FILES}/${id}/`)

export const renameFile = (id, newName) =>
  api.post(`${FILES}/${id}/rename/`, { new_name: newName })

export const getStorageInfo = () =>
  api.get(`${FILES}/storage/`)
  api.get(`${FILES}/storage/`)