import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import {
  getShares,
  createShare as apiCreateShare,
  revokeShare as apiRevokeShare,
  createZipShare as apiCreateZipShare,
  getZipShares as apiGetZipShares,
  revokeZipShare as apiRevokeZipShare,
  getGlobalAnalytics as apiGetGlobalAnalytics,
  getShareAnalytics as apiGetShareAnalytics,
  getFileRequests,
  createFileRequest as apiCreateRequest,
  closeFileRequest as apiCloseRequest,
  getInbox,
  reviewSubmission as apiReview,
  deleteInfectedFile as apiDeleteInfectedFile,
} from '@/api/sharingApi'

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

// ── ZIP share thunks (NEW) ────────────────────────────────────────────────────

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

// ── Analytics thunks ──────────────────────────────────────────────────────────

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

// ── File request thunks ───────────────────────────────────────────────────────

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

// ── Slice ─────────────────────────────────────────────────────────────────────

const sharingSlice = createSlice({
  name: 'sharing',
  initialState: {
    // Single-file shares
    shares:     [],
    pagination: { current_page: 1, total_pages: 1, count: 0, next: null, previous: null },
    sharing:    false,
    error:      null,

    // ZIP shares
    zipShares:       [],
    zipPagination:   { current_page: 1, total_pages: 1, count: 0 },
    zipSharing:      false,

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
  },
  reducers: {},
  extraReducers: (builder) => {

    // ── Single-file shares ────────────────────────────────────────────────────
    builder
      .addCase(fetchShares.fulfilled, (state, { payload }) => {
        state.shares     = payload.results || []
        state.pagination = {
          current_page: payload.current_page,
          total_pages:  payload.total_pages,
          count:        payload.count,
          next:         payload.next,
          previous:     payload.previous,
        }
      })
      .addCase(share.pending,   (state) => { state.sharing = true;  state.error = null })
      .addCase(share.fulfilled, (state) => { state.sharing = false })
      .addCase(share.rejected,  (state, { payload }) => { state.sharing = false; state.error = payload })
      .addCase(revoke.fulfilled, (state, { payload: id }) => {
        const s = state.shares.find((x) => x.id === id)
        if (s) s.status = 'revoked'
      })

    // ── ZIP shares ────────────────────────────────────────────────────────────
    builder
      .addCase(createZipShare.pending,   (state) => { state.zipSharing = true; state.error = null })
      .addCase(createZipShare.fulfilled, (state, { payload }) => {
        state.zipSharing = false
        const newShares = payload.zip_shares || []
        state.zipShares = [...newShares, ...state.zipShares]
      })
      .addCase(createZipShare.rejected,  (state, { payload }) => {
        state.zipSharing = false
        state.error = payload
      })
      .addCase(fetchZipShares.fulfilled, (state, { payload }) => {
        state.zipShares   = payload.results || []
        state.zipPagination = {
          current_page: payload.current_page,
          total_pages:  payload.total_pages,
          count:        payload.count,
        }
      })
      .addCase(revokeZipShare.fulfilled, (state, { payload: id }) => {
        const zs = state.zipShares.find((x) => x.id === id)
        if (zs) zs.status = 'revoked'
      })

    // ── Analytics ─────────────────────────────────────────────────────────────
    builder
      .addCase(fetchGlobalAnalytics.pending,   (state) => { state.analyticsLoading = true })
      .addCase(fetchGlobalAnalytics.fulfilled, (state, { payload }) => {
        state.globalAnalytics  = payload
        state.analyticsLoading = false
      })
      .addCase(fetchGlobalAnalytics.rejected,  (state) => { state.analyticsLoading = false })
      .addCase(fetchShareAnalytics.pending,    (state) => { state.analyticsLoading = true })
      .addCase(fetchShareAnalytics.fulfilled,  (state, { payload }) => {
        state.shareAnalytics   = payload
        state.analyticsLoading = false
      })
      .addCase(fetchShareAnalytics.rejected,   (state) => { state.analyticsLoading = false })

    // ── Requests ──────────────────────────────────────────────────────────────
    builder
      .addCase(fetchRequests.pending,   (state) => { state.requestLoading = true })
      .addCase(fetchRequests.fulfilled, (state, { payload }) => {
        state.requests          = payload.results || []
        state.requestPagination = {
          current_page: payload.current_page,
          total_pages:  payload.total_pages,
          count:        payload.count,
        }
        state.requestLoading = false
      })
      .addCase(fetchRequests.rejected,  (state) => { state.requestLoading = false })
      .addCase(createRequest.fulfilled, (state, { payload }) => {
        if (payload?.id) state.requests.unshift(payload)
      })
      .addCase(closeRequest.fulfilled, (state, { payload: id }) => {
        state.requests = state.requests.filter((r) => r.id !== id)
      })

    // ── Inbox ─────────────────────────────────────────────────────────────────
    builder
      .addCase(fetchInbox.pending,   (state) => { state.inboxLoading = true })
      .addCase(fetchInbox.fulfilled, (state, { payload }) => {
        state.inbox            = payload.results || []
        state.inboxPagination  = {
          current_page: payload.current_page,
          total_pages:  payload.total_pages,
          count:        payload.count,
        }
        state.inboxStatusCounts = payload.status_counts      || {}
        state.scanStatusCounts  = payload.scan_status_counts || {}
        state.inboxLoading      = false
      })
      .addCase(fetchInbox.rejected, (state) => { state.inboxLoading = false })
      .addCase(reviewInboxItem.fulfilled, (state, { payload }) => {
        if (!payload?.id) return
        const idx = state.inbox.findIndex((x) => x.id === payload.id)
        if (idx !== -1) state.inbox[idx] = payload
      })

    // ── Delete infected file ───────────────────────────────────────────────────
    builder
      .addCase(deleteInfectedFile.pending,   (state) => { state.deletingFile = true; state.error = null })
      .addCase(deleteInfectedFile.fulfilled, (state, { payload: id }) => {
        state.inbox       = state.inbox.filter((x) => x.id !== id)
        state.deletingFile = false
      })
      .addCase(deleteInfectedFile.rejected,  (state, { payload }) => {
        state.deletingFile = false
        state.error        = payload
      })
  },
})

export default sharingSlice.reducer