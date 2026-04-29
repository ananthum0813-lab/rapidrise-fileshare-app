import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { loginUser, registerUser, logoutUser, getProfile, updateProfile } from '@/api/authApi'

// ── Thunks ────────────────────────────────────────────────────────────────────

// LOGIN — stores tokens + user, sets isAuthenticated
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

// REGISTER — creates account only, does NOT log the user in
// After success → navigate to /login (handled in component)
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

// LOGOUT — blacklist token on backend, clear everything locally
export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { getState }) => {
    const refreshToken = getState().auth.refreshToken
    try {
      await logoutUser(refreshToken)
    } catch (_) {
      // Always clear locally even if backend call fails
    }
  }
)

// VERIFY SESSION — called on app load to validate the stored token
// If token is expired/invalid → 401 → axios interceptor clears tokens
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

// UPDATE PROFILE — update user profile information
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const saveTokens = (access, refresh) => {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}

const clearTokens = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState = {
  user: null,
  accessToken: localStorage.getItem('access_token') || null,
  refreshToken: localStorage.getItem('refresh_token') || null,

  // isAuthenticated starts false — only true after verifySession confirms the token is valid
  // This prevents stale/expired tokens from bypassing ProtectedRoute
  isAuthenticated: false,

  // Tracks whether the app has finished the initial session check
  sessionChecked: false,

  loading: false,
  error: null,
  fieldErrors: null,
}

// ── Slice ─────────────────────────────────────────────────────────────────────

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

    // ── Verify Session (app startup) ─────────────────────────────────────
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
        // Token was invalid — clear everything
        state.user = null
        state.accessToken = null
        state.refreshToken = null
        state.isAuthenticated = false
        state.sessionChecked = true
        clearTokens()
      })

    // ── Login ─────────────────────────────────────────────────────────────
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

    // ── Register ──────────────────────────────────────────────────────────
    // Registration does NOT log the user in.
    // Tokens from backend are discarded — user must go through /login.
    builder
      .addCase(register.pending, (state) => {
        state.loading = true
        state.error = null
        state.fieldErrors = null
      })
      .addCase(register.fulfilled, (state) => {
        state.loading = false
        // Intentionally NOT setting isAuthenticated or tokens
      })
      .addCase(register.rejected, (state, { payload }) => {
        state.loading = false
        state.error = payload?.message || 'Registration failed.'
        state.fieldErrors = payload?.errors || null
      })

    // ── Logout ────────────────────────────────────────────────────────────
    builder.addCase(logout.fulfilled, (state) => {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      state.isAuthenticated = false
      state.error = null
      state.fieldErrors = null
      clearTokens()
    })

    // ── Edit Profile ───────────────────────────────────────────────────────
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