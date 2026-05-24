import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { loginUser, registerUser, logoutUser, getProfile, updateProfile } from '@/api/authApi'


export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const { data } = await loginUser(credentials)
      return data.data // { tokens: { access, refresh }, user: {...} }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Login failed.')
    }
  }
)

export const register = createAsyncThunk(
  'auth/register',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await registerUser(formData)
      return data.data
    } catch (err) {
      const errors = err.response?.data?.errors
      const message = err.response?.data?.message || 'Registration failed.'
      return rejectWithValue({ message, errors })
    }
  }
)

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { getState }) => {
    const refreshToken = getState().auth.refreshToken
    try {
      await logoutUser(refreshToken)
    } catch (_) {
    }
  }
)

export const verifySession = createAsyncThunk(
  'auth/verifySession',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await getProfile()
      return data.data // user object
    } catch (err) {
      return rejectWithValue('Session expired.')
    }
  }
)

export const editProfile = createAsyncThunk(
  'auth/editProfile',
  async (profileData, { rejectWithValue }) => {
    try {
      const { data } = await updateProfile(profileData)
      return data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Profile update failed.')
    }
  }
)


const saveTokens = (access, refresh) => {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}

const clearTokens = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}


const initialState = {
  user: null,
  accessToken: localStorage.getItem('access_token') || null,
  refreshToken: localStorage.getItem('refresh_token') || null,

  // This prevents stale/expired tokens from bypassing ProtectedRoute
  isAuthenticated: false,

  sessionChecked: false,

  loading: false,
  error: null,
  fieldErrors: null,
}


const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setTokens(state, { payload }) {
      state.accessToken = payload.accessToken
      state.refreshToken = payload.refreshToken
      saveTokens(payload.accessToken, payload.refreshToken)
    },
    clearError(state) {
      state.error = null
      state.fieldErrors = null
    },
  },
  extraReducers: (builder) => {

    builder
      .addCase(verifySession.pending, (state) => {
        state.sessionChecked = false
      })
      .addCase(verifySession.fulfilled, (state, { payload }) => {
        state.user = payload
        state.isAuthenticated = true
        state.sessionChecked = true
      })
      .addCase(verifySession.rejected, (state) => {
        state.user = null
        state.accessToken = null
        state.refreshToken = null
        state.isAuthenticated = false
        state.sessionChecked = true
        clearTokens()
      })

    builder
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, { payload }) => {
        state.loading = false
        state.user = payload.user
        state.accessToken = payload.tokens.access
        state.refreshToken = payload.tokens.refresh
        state.isAuthenticated = true
        state.sessionChecked = true
        saveTokens(payload.tokens.access, payload.tokens.refresh)
      })
      .addCase(login.rejected, (state, { payload }) => {
        state.loading = false
        state.error = payload
      })

    builder
      .addCase(register.pending, (state) => {
        state.loading = true
        state.error = null
        state.fieldErrors = null
      })
      .addCase(register.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(register.rejected, (state, { payload }) => {
        state.loading = false
        state.error = payload?.message || 'Registration failed.'
        state.fieldErrors = payload?.errors || null
      })

    builder.addCase(logout.fulfilled, (state) => {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      state.isAuthenticated = false
      state.error = null
      state.fieldErrors = null
      clearTokens()
    })

    builder
      .addCase(editProfile.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(editProfile.fulfilled, (state, { payload }) => {
        state.loading = false
        state.user = payload
      })
      .addCase(editProfile.rejected, (state, { payload }) => {
        state.loading = false
        state.error = payload
      })

  },
})

export const { setTokens, clearError } = authSlice.actions
export default authSlice.reducer