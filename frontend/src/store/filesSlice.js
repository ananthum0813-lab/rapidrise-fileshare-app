import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { getFiles, uploadFiles, deleteFile, getStorageInfo, renameFile } from '@/api/filesApi'

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchFiles = createAsyncThunk(
  'files/fetchFiles',
  async ({ page = 1, search = '', ordering = '-uploaded_at' } = {}, { rejectWithValue }) => {
    try {
      const { data } = await getFiles(page, search, ordering)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch files.')
    }
  }
)

export const upload = createAsyncThunk(
  'files/upload',
  async (files, { rejectWithValue }) => {
    try {
      const { data } = await uploadFiles(files)
      return data.data
    } catch (err) {
      const errors = err.response?.data?.errors || err.response?.data?.message
      return rejectWithValue(errors || 'Upload failed.')
    }
  }
)

export const remove = createAsyncThunk(
  'files/remove',
  async (fileId, { rejectWithValue }) => {
    try {
      await deleteFile(fileId)
      return fileId
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Delete failed.')
    }
  }
)

export const fetchStorage = createAsyncThunk(
  'files/fetchStorage',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await getStorageInfo()
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch storage info.')
    }
  }
)

export const rename = createAsyncThunk(
  'files/rename',
  async ({ fileId, newName }, { rejectWithValue }) => {
    try {
      const { data } = await renameFile(fileId, newName)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Rename failed.')
    }
  }
)

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState = {
  files: [],
  pagination: { count: 0, total_pages: 1, current_page: 1, next: null, previous: null },
  storage: null,
  loading: false,
  uploading: false,
  error: null,
}

// ── Slice ─────────────────────────────────────────────────────────────────────

const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null
    },
    toggleFavoriteOptimistic(state, { payload: fileId }) {
      const file = state.files.find(f => f.id === fileId)
      if (file) {
        file.is_favorite = !file.is_favorite
      }
    },
  },
  extraReducers: (builder) => {

    // ── Fetch Files ─────────────────────────────────────────────────────
    builder
      .addCase(fetchFiles.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchFiles.fulfilled, (state, { payload }) => {
        state.loading = false
        state.files = payload.results || []
        state.pagination = {
          count: payload.count,
          total_pages: payload.total_pages,
          current_page: payload.current_page,
          next: payload.next,
          previous: payload.previous,
        }
      })
      .addCase(fetchFiles.rejected, (state, { payload }) => {
        state.loading = false
        state.error = payload
      })

    // ── Upload Files ────────────────────────────────────────────────────
    // FIX: Handle multiple possible API response shapes defensively.
    // The component now calls fetchFiles after a successful upload, so the
    // slice only needs to flip the uploading flag — it does NOT need to
    // manually splice files into the list.  The optimistic prepend is kept
    // as a fallback in case your API *does* return the uploaded file objects.
    builder
      .addCase(upload.pending, (state) => {
        state.uploading = true
        state.error = null
      })
      .addCase(upload.fulfilled, (state, { payload }) => {
        state.uploading = false

        // Normalise: accept { uploaded: [...] }, { results: [...] }, or a
        // plain array — whatever your API returns.
        const uploaded =
          payload?.uploaded ??      // { uploaded: [...] }
          payload?.results ??       // { results: [...] }
          (Array.isArray(payload) ? payload : null) // bare array

        if (uploaded?.length) {
          // Optimistic prepend so the UI feels instant even before fetchFiles
          // completes.  Duplicates are removed once fetchFiles resolves.
          state.files = [...uploaded, ...state.files]
          state.pagination.count += uploaded.length
        }
        // If the API returns nothing useful, fetchFiles (called by the
        // component after dispatch) will refresh the list correctly.
      })
      .addCase(upload.rejected, (state, { payload }) => {
        state.uploading = false
        state.error = payload
      })

    // ── Delete File ─────────────────────────────────────────────────────
    builder
      .addCase(remove.fulfilled, (state, { payload: fileId }) => {
        state.files = state.files.filter((f) => f.id !== fileId)
        state.pagination.count = Math.max(0, state.pagination.count - 1)
      })

    // ── Fetch Storage ───────────────────────────────────────────────────
    builder
      .addCase(fetchStorage.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchStorage.fulfilled, (state, { payload }) => {
        state.loading = false
        state.storage = payload
      })
      .addCase(fetchStorage.rejected, (state, { payload }) => {
        state.loading = false
        state.error = payload
      })

    // ── Rename File ─────────────────────────────────────────────────────
    builder
      .addCase(rename.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(rename.fulfilled, (state, { payload }) => {
        state.loading = false
        const index = state.files.findIndex((f) => f.id === payload.id)
        if (index !== -1) {
          state.files[index] = payload
        }
      })
      .addCase(rename.rejected, (state, { payload }) => {
        state.loading = false
        state.error = payload
      })
  },
})

export const { clearError, toggleFavoriteOptimistic } = filesSlice.actions
export default filesSlice.reducer