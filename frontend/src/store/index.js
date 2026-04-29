import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import filesReducer from './filesSlice'
import sharingReducer from './sharingSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    files: filesReducer,
    sharing: sharingReducer,
  },
})