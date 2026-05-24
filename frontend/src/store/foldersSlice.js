/**
 * store/foldersSlice.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Redux slice for the Folders feature.
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import {
  getFolders,
  createFolder as apiCreate,
  getFolderDetail as apiGetDetail,
  updateFolder as apiUpdate,
  deleteFolder as apiDelete,
  addFilesToFolder as apiAddFiles,
  removeFilesFromFolder as apiRemoveFiles,
  shareFolderFiles as apiShare,
} from '@/api/foldersApi'


export const fetchFolders = createAsyncThunk(
  'folders/fetchFolders',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await getFolders()
      return data.data        // { folders: [...], count: N }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load folders.')
    }
  }
)

export const fetchFolderDetail = createAsyncThunk(
  'folders/fetchFolderDetail',
  async (folderId, { rejectWithValue }) => {
    try {
      const { data } = await apiGetDetail(folderId)
      return data.data        // full folder with files[]
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load folder.')
    }
  }
)

export const createFolder = createAsyncThunk(
  'folders/createFolder',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await apiCreate(payload)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create folder.')
    }
  }
)

export const updateFolder = createAsyncThunk(
  'folders/updateFolder',
  async ({ folderId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await apiUpdate(folderId, payload)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update folder.')
    }
  }
)

export const deleteFolder = createAsyncThunk(
  'folders/deleteFolder',
  async (folderId, { rejectWithValue }) => {
    try {
      await apiDelete(folderId)
      return folderId
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete folder.')
    }
  }
)

export const addFilesToFolder = createAsyncThunk(
  'folders/addFiles',
  async ({ folderId, fileIds }, { rejectWithValue }) => {
    try {
      const { data } = await apiAddFiles(folderId, fileIds)
      return { folderId, ...data.data }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to add files.')
    }
  }
)

export const removeFilesFromFolder = createAsyncThunk(
  'folders/removeFiles',
  async ({ folderId, fileIds }, { rejectWithValue }) => {
    try {
      const { data } = await apiRemoveFiles(folderId, fileIds)
      return { folderId, fileIds, ...data.data }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to remove files.')
    }
  }
)

export const shareFolderFiles = createAsyncThunk(
  'folders/share',
  async ({ folderId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await apiShare(folderId, payload)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Share failed.')
    }
  }
)


const initialState = {
  folders:       [],          // summary list
  openFolder:    null,        // full detail (with files[])
  loading:       false,
  detailLoading: false,
  sharing:       false,
  error:         null,
  shareResult:   null,
}

const foldersSlice = createSlice({
  name: 'folders',
  initialState,
  reducers: {
    clearError(state)       { state.error = null },
    clearShareResult(state) { state.shareResult = null },
    clearOpenFolder(state)  { state.openFolder = null },
  },
  extraReducers: (builder) => {

    builder
      .addCase(fetchFolders.pending, (s) => { s.loading = true; s.error = null })
      .addCase(fetchFolders.fulfilled, (s, { payload }) => {
        s.loading = false
        s.folders = payload.folders || []
      })
      .addCase(fetchFolders.rejected, (s, { payload }) => { s.loading = false; s.error = payload })

    builder
      .addCase(fetchFolderDetail.pending, (s) => { s.detailLoading = true; s.error = null })
      .addCase(fetchFolderDetail.fulfilled, (s, { payload }) => {
        s.detailLoading = false
        s.openFolder    = payload
      })
      .addCase(fetchFolderDetail.rejected, (s, { payload }) => { s.detailLoading = false; s.error = payload })

    builder
      .addCase(createFolder.pending,   (s) => { s.loading = true;  s.error = null })
      .addCase(createFolder.fulfilled, (s, { payload }) => {
        s.loading = false
        s.folders = [payload, ...s.folders]
      })
      .addCase(createFolder.rejected, (s, { payload }) => { s.loading = false; s.error = payload })

    builder
      .addCase(updateFolder.pending,   (s) => { s.loading = true;  s.error = null })
      .addCase(updateFolder.fulfilled, (s, { payload }) => {
        s.loading = false
        const idx = s.folders.findIndex((f) => f.id === payload.id)
        if (idx !== -1) s.folders[idx] = payload
        if (s.openFolder?.id === payload.id) s.openFolder = { ...s.openFolder, ...payload }
      })
      .addCase(updateFolder.rejected, (s, { payload }) => { s.loading = false; s.error = payload })

    builder
      .addCase(deleteFolder.fulfilled, (s, { payload: id }) => {
        s.folders = s.folders.filter((f) => f.id !== id)
        if (s.openFolder?.id === id) s.openFolder = null
      })

    builder
      .addCase(addFilesToFolder.fulfilled, (s, { payload }) => {
        const idx = s.folders.findIndex((f) => f.id === payload.folderId)
        if (idx !== -1) s.folders[idx] = { ...s.folders[idx], file_count: (s.folders[idx].file_count || 0) + (payload.added || 0) }
      })

    builder
      .addCase(removeFilesFromFolder.fulfilled, (s, { payload }) => {
        if (s.openFolder?.id === payload.folderId) {
          s.openFolder.files = (s.openFolder.files || []).filter(
            (f) => !payload.fileIds.includes(f.id)
          )
        }
        const idx = s.folders.findIndex((f) => f.id === payload.folderId)
        if (idx !== -1) s.folders[idx] = {
          ...s.folders[idx],
          file_count: Math.max(0, (s.folders[idx].file_count || 0) - (payload.fileIds?.length || 0)),
        }
      })

    builder
      .addCase(shareFolderFiles.pending,   (s) => { s.sharing = true;  s.error = null; s.shareResult = null })
      .addCase(shareFolderFiles.fulfilled, (s, { payload }) => { s.sharing = false; s.shareResult = payload })
      .addCase(shareFolderFiles.rejected,  (s, { payload }) => { s.sharing = false; s.error = payload })
  },
})

export const { clearError, clearShareResult, clearOpenFolder } = foldersSlice.actions
export default foldersSlice.reducer