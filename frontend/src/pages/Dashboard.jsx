import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchFiles, fetchStorage } from '@/store/filesSlice'
import { fetchShares } from '@/store/sharingSlice'

// Icons (SVG inline - no external library needed)
const FileIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
const ShareIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
const StorageIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
const UploadIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
const ChevronRightIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
const ArrowUpIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>

const formatBytes = (bytes) => {
  if (bytes === undefined || bytes === null) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = Number(bytes)
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(1)} ${units[index]}`
}

const timeAgo = (date) => {
  if (!date) return 'Unknown'
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function Dashboard() {
  const dispatch = useDispatch()
  const { user } = useSelector((s) => s.auth)
  const { files, pagination, storage } = useSelector((s) => s.files)
  const { shares } = useSelector((s) => s.sharing)
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  useEffect(() => {
    dispatch(fetchFiles({ page: 1 }))
    dispatch(fetchStorage())
    dispatch(fetchShares({ page: 1 }))
  }, [dispatch])

  const usedPercentage = storage ? Math.round((storage.used_bytes / storage.total_bytes) * 100) : 0
  const recentFiles = files.slice(0, 5)
  const activeShares = shares.filter((s) => s.status === 'active').length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Section */}
      <div className="px-4 md:px-8 lg:px-10 py-8 lg:py-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              {greeting}, {user?.first_name ?? 'Guest'}
            </h1>
            <p className="text-gray-500 text-sm md:text-base">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8 lg:mb-10">
            {/* Total Files */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Total Files</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">{storage?.file_count ?? 0}</p>
                  <p className="text-xs text-gray-400 mt-2">in your account</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
                  <FileIcon />
                </div>
              </div>
            </div>

            {/* Active Shares */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Active Shares</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">{activeShares}</p>
                  <p className="text-xs text-gray-400 mt-2">shared files</p>
                </div>
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-500 shrink-0">
                  <ShareIcon />
                </div>
              </div>
            </div>

            {/* Storage Used */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Storage Used</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">{storage ? `${storage.used_mb}` : '0'} MB</p>
                  <p className="text-xs text-gray-400 mt-2">of {storage?.total_gb ?? 1} GB</p>
                </div>
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 shrink-0">
                  <StorageIcon />
                </div>
              </div>
            </div>

            {/* Storage Percentage */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Usage</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">{usedPercentage}%</p>
                  <p className="text-xs text-gray-400 mt-2">space remaining</p>
                </div>
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
                  <ArrowUpIcon />
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Left Column - Storage & Quick Actions */}
            <div className="lg:col-span-1 space-y-6">
              {/* Storage Visualization */}
              {storage && (
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900 mb-6">Storage Usage</h2>

                  {/* Circular Progress */}
                  <div className="flex justify-center mb-6">
                    <div className="relative w-40 h-40">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          className="text-gray-100"
                        />
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 70}
                          strokeDashoffset={2 * Math.PI * 70 * (1 - usedPercentage / 100)}
                          className="text-brand-500 transition-all duration-1000"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-gray-900">{usedPercentage}%</span>
                        <span className="text-xs text-gray-400 mt-1">Full</span>
                      </div>
                    </div>
                  </div>

                  {/* Storage Details */}
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Used</span>
                      <span className="font-medium text-gray-900">{storage.used_mb} MB</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(usedPercentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{storage.used_mb} MB</span>
                      <span>{storage.total_gb} GB</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <Link
                    to="/files"
                    className="flex items-center justify-between p-4 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <UploadIcon />
                      <span className="font-medium">Upload Files</span>
                    </div>
                    <ChevronRightIcon />
                  </Link>

                  <Link
                    to="/sharing"
                    className="flex items-center justify-between p-4 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ShareIcon />
                      <span className="font-medium">Share Files</span>
                    </div>
                    <ChevronRightIcon />
                  </Link>

                  <Link
                    to="/settings"
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="font-medium">Settings</span>
                    </div>
                    <ChevronRightIcon />
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Column - Recent Files */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-gray-900">Recent Files</h2>
                  <Link
                    to="/files"
                    className="text-sm font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
                  >
                    View all <ChevronRightIcon />
                  </Link>
                </div>

                {recentFiles.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <FileIcon />
                    </div>
                    <p className="text-gray-500 text-sm">No files uploaded yet</p>
                    <p className="text-gray-400 text-xs mt-1">Upload your first file to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 text-xs font-bold">
                            {file.original_name.split('.').pop()?.toUpperCase().slice(0, 3) || 'FILE'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.original_name}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {file.file_size_display} • {timeAgo(file.uploaded_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-medium text-gray-600">{file.mime_type.split('/')[1]?.toUpperCase()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {pagination.count > 5 && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <Link
                      to="/files"
                      className="block text-center text-sm font-medium text-brand-600 hover:text-brand-700 py-2"
                    >
                      View all {pagination.count} files
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}