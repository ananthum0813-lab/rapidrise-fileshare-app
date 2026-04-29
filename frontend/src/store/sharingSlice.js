import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { getShares, createShare, revokeShare } from '@/api/sharingApi'

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchShares = createAsyncThunk(
  'sharing/fetchShares',
  async ({ page = 1, status = '' } = {}, { rejectWithValue }) => {
    try {
      const { data } = await getShares(page, status)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch shares.')
    }
  }
)

export const share = createAsyncThunk(
  'sharing/share',
  async (shareData, { rejectWithValue }) => {
    try {
      const { data } = await createShare(shareData)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to share file.')
    }
  }
)

export const revoke = createAsyncThunk(
  'sharing/revoke',
  async (shareId, { rejectWithValue }) => {
    try {
      await revokeShare(shareId)
      return shareId
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to revoke share.')
    }
  }
)

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState = {
  shares: [],
  pagination: { count: 0, total_pages: 1, current_page: 1, next: null, previous: null },
  loading: false,
  sharing: false,
  error: null,
}

// ── Slice ─────────────────────────────────────────────────────────────────────

const sharingSlice = createSlice({
  name: 'sharing',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {

    // ── Fetch Shares ────────────────────────────────────────────────────
    builder
      .addCase(fetchShares.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchShares.fulfilled, (state, { payload }) => {
        state.loading = false
        state.shares = payload.results || []
        state.pagination = {
          count: payload.count,
          total_pages: payload.total_pages,
          current_page: payload.current_page,
          next: payload.next,
          previous: payload.previous,
        }
      })
      .addCase(fetchShares.rejected, (state, { payload }) => {
        state.loading = false
        state.error = payload
      })

    // ── Create Share ────────────────────────────────────────────────────
    builder
      .addCase(share.pending, (state) => {
        state.sharing = true
        state.error = null
      })
      .addCase(share.fulfilled, (state, { payload }) => {
        state.sharing = false
        state.shares = [payload, ...state.shares]
        state.pagination.count += 1
      })
      .addCase(share.rejected, (state, { payload }) => {
        state.sharing = false
        state.error = payload
      })

    // ── Revoke Share ────────────────────────────────────────────────────
    builder
      .addCase(revoke.fulfilled, (state, { payload: shareId }) => {
        const share = state.shares.find((s) => s.id === shareId)
        if (share) share.status = 'revoked'
      })

  },
})

export const { clearError } = sharingSlice.actions
export default sharingSlice.reducer