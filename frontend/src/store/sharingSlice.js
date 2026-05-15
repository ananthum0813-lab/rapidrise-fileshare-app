import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import {
  getAllFiles as apiGetAllFiles,
  getShares,
  createShare as apiCreateShare,
  revokeShare as apiRevokeShare,
  deleteShare as apiDeleteShare,
  createZipShare as apiCreateZipShare,
  getZipShares as apiGetZipShares,
  revokeZipShare as apiRevokeZipShare,
  deleteZipShare as apiDeleteZipShare,
  getGlobalAnalytics as apiGetGlobalAnalytics,
  getShareAnalytics as apiGetShareAnalytics,
  getFileRequests,
  createFileRequest as apiCreateRequest,
  closeFileRequest as apiCloseRequest,
  getInbox,
  reviewSubmission as apiReview,
  deleteInfectedFile as apiDeleteInfectedFile,
  removeInboxItem as apiRemoveInboxItem,
} from '@/api/sharingApi'

// ── All-files thunk ───────────────────────────────────────────────────────────
export const fetchAllFiles = createAsyncThunk(
  'sharing/fetchAllFiles',
  async (search = '', { rejectWithValue }) => {
    try {
      const { data } = await apiGetAllFiles(search)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load files.')
    }
  },
)

// ── Single-file share thunks ──────────────────────────────────────────────────
export const fetchShares = createAsyncThunk(
  'sharing/fetchShares',
  async ({ page = 1, status = '', file_id = '' } = {}, { rejectWithValue }) => {
    try {
      const { data } = await getShares(page, status, file_id)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load shares.')
    }
  },
)

export const share = createAsyncThunk(
  'sharing/share',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await apiCreateShare(formData)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to share file.')
    }
  },
)

export const revoke = createAsyncThunk(
  'sharing/revoke',
  async (shareId, { rejectWithValue }) => {
    try {
      await apiRevokeShare(shareId)
      return shareId
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to revoke share.')
    }
  },
)

export const deleteShare = createAsyncThunk(
  'sharing/deleteShare',
  async (shareId, { rejectWithValue }) => {
    try {
      await apiDeleteShare(shareId)
      return shareId
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete share.')
    }
  },
)

// ── ZIP share thunks ──────────────────────────────────────────────────────────
export const createZipShare = createAsyncThunk(
  'sharing/createZipShare',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await apiCreateZipShare(formData)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create ZIP share.')
    }
  },
)

export const fetchZipShares = createAsyncThunk(
  'sharing/fetchZipShares',
  async ({ page = 1, status = '' } = {}, { rejectWithValue }) => {
    try {
      const { data } = await apiGetZipShares(page, status)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load ZIP shares.')
    }
  },
)

export const revokeZipShare = createAsyncThunk(
  'sharing/revokeZipShare',
  async (zipShareId, { rejectWithValue }) => {
    try {
      await apiRevokeZipShare(zipShareId)
      return zipShareId
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to revoke ZIP share.')
    }
  },
)

export const deleteZipShare = createAsyncThunk(
  'sharing/deleteZipShare',
  async (zipShareId, { rejectWithValue }) => {
    try {
      await apiDeleteZipShare(zipShareId)
      return zipShareId
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete ZIP share.')
    }
  },
)

// ── Analytics ─────────────────────────────────────────────────────────────────
export const fetchGlobalAnalytics = createAsyncThunk(
  'sharing/fetchGlobalAnalytics',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await apiGetGlobalAnalytics()
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load analytics.')
    }
  },
)

export const fetchShareAnalytics = createAsyncThunk(
  'sharing/fetchShareAnalytics',
  async (shareId, { rejectWithValue }) => {
    try {
      const { data } = await apiGetShareAnalytics(shareId)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load analytics.')
    }
  },
)

// ── Request thunks ────────────────────────────────────────────────────────────
export const fetchRequests = createAsyncThunk(
  'sharing/fetchRequests',
  async ({ page = 1, status = '' } = {}, { rejectWithValue }) => {
    try {
      const { data } = await getFileRequests(page, status)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load requests.')
    }
  },
)

export const createRequest = createAsyncThunk(
  'sharing/createRequest',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await apiCreateRequest(formData)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create request.')
    }
  },
)

export const closeRequest = createAsyncThunk(
  'sharing/closeRequest',
  async (id, { rejectWithValue }) => {
    try {
      await apiCloseRequest(id)
      return id
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to close request.')
    }
  },
)

// ── Inbox thunks ──────────────────────────────────────────────────────────────
export const fetchInbox = createAsyncThunk(
  'sharing/fetchInbox',
  async ({ page = 1, status = '', source_type = '', scan_status = '' } = {}, { rejectWithValue }) => {
    try {
      const { data } = await getInbox(page, status, source_type, scan_status)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load inbox.')
    }
  },
)

export const reviewInboxItem = createAsyncThunk(
  'sharing/reviewInboxItem',
  async ({ id, action, note = '' }, { rejectWithValue }) => {
    try {
      const { data } = await apiReview(id, action, note)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update submission.')
    }
  },
)

/** Hard-delete an infected/scan_failed file + its inbox row. */
export const deleteInfectedFile = createAsyncThunk(
  'sharing/deleteInfectedFile',
  async (submissionId, { rejectWithValue }) => {
    try {
      await apiDeleteInfectedFile(submissionId)
      return submissionId
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete file.')
    }
  },
)

/**
 * Remove any inbox entry (with smart file handling).
 * Infected files → hard-deleted.  Safe files → only the row is removed.
 */
export const removeInboxItem = createAsyncThunk(
  'sharing/removeInboxItem',
  async (submissionId, { rejectWithValue }) => {
    try {
      await apiRemoveInboxItem(submissionId)
      return submissionId
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to remove item.')
    }
  },
)

// ── Slice ─────────────────────────────────────────────────────────────────────
const sharingSlice = createSlice({
  name: 'sharing',
  initialState: {
    // All owner files
    allFiles:        [],
    allFilesCount:   0,
    allFilesLoading: false,

    // Single-file shares
    shares:     [],
    pagination: { current_page: 1, total_pages: 1, count: 0, next: null, previous: null },
    sharing:    false,
    error:      null,

    // ZIP shares
    zipShares:     [],
    zipPagination: { current_page: 1, total_pages: 1, count: 0, next: null, previous: null },
    zipSharing:    false,

    // Analytics
    globalAnalytics:  null,
    shareAnalytics:   null,
    analyticsLoading: false,

    // Requests
    requests:          [],
    requestPagination: { current_page: 1, total_pages: 1, count: 0 },
    requestLoading:    false,

    // Inbox
    inbox:             [],
    inboxPagination:   { current_page: 1, total_pages: 1, count: 0 },
    inboxStatusCounts: {},
    scanStatusCounts:  {},
    inboxLoading:      false,
    deletingFile:      false,
    removingItem:      false,
  },
  reducers: {},
  extraReducers: (builder) => {

    // ── All files ─────────────────────────────────────────────────────────────
    builder
      .addCase(fetchAllFiles.pending,   (s) => { s.allFilesLoading = true })
      .addCase(fetchAllFiles.fulfilled, (s, { payload }) => {
        s.allFiles        = payload.files || []
        s.allFilesCount   = payload.count || 0
        s.allFilesLoading = false
      })
      .addCase(fetchAllFiles.rejected,  (s) => { s.allFilesLoading = false })

    // ── Single-file shares ────────────────────────────────────────────────────
    builder
      .addCase(fetchShares.fulfilled, (s, { payload }) => {
        s.shares     = payload.results || []
        s.pagination = {
          current_page: payload.current_page,
          total_pages:  payload.total_pages,
          count:        payload.count,
          next:         payload.next,
          previous:     payload.previous,
        }
      })
      .addCase(share.pending,   (s) => { s.sharing = true;  s.error = null })
      .addCase(share.fulfilled, (s) => { s.sharing = false })
      .addCase(share.rejected,  (s, { payload }) => { s.sharing = false; s.error = payload })
      .addCase(revoke.fulfilled, (s, { payload: id }) => {
        const item = s.shares.find((x) => x.id === id)
        if (item) item.status = 'revoked'
      })
      .addCase(deleteShare.fulfilled, (s, { payload: id }) => {
        s.shares = s.shares.filter((x) => x.id !== id)
      })

    // ── ZIP shares ────────────────────────────────────────────────────────────
    builder
      .addCase(createZipShare.pending,   (s) => { s.zipSharing = true; s.error = null })
      .addCase(createZipShare.fulfilled, (s, { payload }) => {
        s.zipSharing = false
        const newZips = payload.zip_shares || []
        s.zipShares   = [...newZips, ...s.zipShares]
        s.zipPagination = {
          ...s.zipPagination,
          count: (s.zipPagination.count || 0) + newZips.length,
        }
      })
      .addCase(createZipShare.rejected, (s, { payload }) => {
        s.zipSharing = false
        s.error = payload
      })
      .addCase(fetchZipShares.fulfilled, (s, { payload }) => {
        s.zipShares     = payload.results || []
        s.zipPagination = {
          current_page: payload.current_page,
          total_pages:  payload.total_pages,
          count:        payload.count,
          next:         payload.next,
          previous:     payload.previous,
        }
      })
      .addCase(revokeZipShare.fulfilled, (s, { payload: id }) => {
        const item = s.zipShares.find((x) => x.id === id)
        if (item) item.status = 'revoked'
      })
      .addCase(deleteZipShare.fulfilled, (s, { payload: id }) => {
        s.zipShares = s.zipShares.filter((x) => x.id !== id)
      })

    // ── Analytics ─────────────────────────────────────────────────────────────
    builder
      .addCase(fetchGlobalAnalytics.pending,   (s) => { s.analyticsLoading = true })
      .addCase(fetchGlobalAnalytics.fulfilled, (s, { payload }) => {
        s.globalAnalytics  = payload
        s.analyticsLoading = false
      })
      .addCase(fetchGlobalAnalytics.rejected,  (s) => { s.analyticsLoading = false })
      .addCase(fetchShareAnalytics.pending,    (s) => { s.analyticsLoading = true })
      .addCase(fetchShareAnalytics.fulfilled,  (s, { payload }) => {
        s.shareAnalytics   = payload
        s.analyticsLoading = false
      })
      .addCase(fetchShareAnalytics.rejected,   (s) => { s.analyticsLoading = false })

    // ── Requests ──────────────────────────────────────────────────────────────
    builder
      .addCase(fetchRequests.pending,   (s) => { s.requestLoading = true })
      .addCase(fetchRequests.fulfilled, (s, { payload }) => {
        s.requests          = payload.results || []
        s.requestPagination = {
          current_page: payload.current_page,
          total_pages:  payload.total_pages,
          count:        payload.count,
        }
        s.requestLoading = false
      })
      .addCase(fetchRequests.rejected,  (s) => { s.requestLoading = false })
      .addCase(createRequest.fulfilled, (s, { payload }) => {
        if (payload?.id) s.requests.unshift(payload)
      })
      .addCase(closeRequest.fulfilled, (s, { payload: id }) => {
        s.requests = s.requests.filter((r) => r.id !== id)
      })

    // ── Inbox ─────────────────────────────────────────────────────────────────
    builder
      .addCase(fetchInbox.pending,   (s) => { s.inboxLoading = true })
      .addCase(fetchInbox.fulfilled, (s, { payload }) => {
        s.inbox            = payload.results || []
        s.inboxPagination  = {
          current_page: payload.current_page,
          total_pages:  payload.total_pages,
          count:        payload.count,
        }
        s.inboxStatusCounts = payload.status_counts      || {}
        s.scanStatusCounts  = payload.scan_status_counts || {}
        s.inboxLoading      = false
      })
      .addCase(fetchInbox.rejected, (s) => { s.inboxLoading = false })
      .addCase(reviewInboxItem.fulfilled, (s, { payload }) => {
        if (!payload?.id) return
        const idx = s.inbox.findIndex((x) => x.id === payload.id)
        if (idx !== -1) s.inbox[idx] = payload
      })
      // deleteInfectedFile — legacy (still works for backwards compat)
      .addCase(deleteInfectedFile.pending,   (s) => { s.deletingFile = true })
      .addCase(deleteInfectedFile.fulfilled, (s, { payload: id }) => {
        s.inbox        = s.inbox.filter((x) => x.id !== id)
        s.deletingFile = false
      })
      .addCase(deleteInfectedFile.rejected,  (s, { payload }) => {
        s.deletingFile = false
        s.error        = payload
      })
      // removeInboxItem — universal remove
      .addCase(removeInboxItem.pending,   (s) => { s.removingItem = true })
      .addCase(removeInboxItem.fulfilled, (s, { payload: id }) => {
        s.inbox       = s.inbox.filter((x) => x.id !== id)
        s.removingItem = false
      })
      .addCase(removeInboxItem.rejected,  (s, { payload }) => {
        s.removingItem = false
        s.error        = payload
      })
  },
})

export default sharingSlice.reducer