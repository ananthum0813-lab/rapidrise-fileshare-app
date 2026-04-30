import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchFiles, fetchStorage } from '@/store/filesSlice'
import { fetchShares } from '@/store/sharingSlice'

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
  const { files, storage } = useSelector((s) => s.files)
  const { shares } = useSelector((s) => s.sharing)
  const [greeting, setGreeting] = useState('')
  const [searchQuery, setSearchQuery] = useState('') // ✅ NEW: Track search query
  const [searchResults, setSearchResults] = useState([]) // ✅ NEW: Store search results

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

  // ✅ NEW: Handle search - fetch files based on query
  const handleSearch = (query) => {
    setSearchQuery(query)
    if (query.trim()) {
      dispatch(fetchFiles({ search: query }))
    } else {
      dispatch(fetchFiles({ page: 1 }))
    }
  }

  const usedPercentage = storage ? Math.round((storage.used_bytes / storage.total_bytes) * 100) : 0
  const recentFiles = files.slice(0, 3)
  const activeShares = shares.filter((s) => s.status === 'active').length

  const avatarUrl = `https://ui-avatars.com/api/?name=${user?.first_name || 'User'}&background=random`

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
      {/* Header */}
      <header className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-3xl font-bold text-indigo-900 flex items-center gap-2">
             {greeting}, <span className="text-indigo-600">{user?.first_name ?? 'User'}!</span>
          </h2>
          <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm">
            <i className="fas fa-calendar-alt text-indigo-400"></i>{' '}
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* ✅ UPDATED: Functional Search Bar */}
          <div className="relative hidden md:block">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              placeholder="Search Files, folders..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl w-80 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <button className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 relative">
            <i className="fas fa-bell"></i>
            <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <img src={avatarUrl} className="w-12 h-12 rounded-2xl border-2 border-white shadow-md" alt="Avatar" />
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Files */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50">
          <div className="flex justify-between items-start mb-4">
            <p className="text-gray-400 font-bold text-xs uppercase tracking-wider">Total Files</p>
            <div className="bg-blue-50 p-2 rounded-lg text-blue-500">
              <i className="fas fa-file-alt"></i>
            </div>
          </div>
          <h3 className="text-3xl font-bold text-gray-800">{storage?.file_count ?? 0}</h3>
          <p className="text-xs text-gray-400 mb-4">in your account</p>
          <Link to="/files" className="text-indigo-600 text-xs font-bold flex items-center gap-1">
            View All <i className="fas fa-arrow-right"></i>
          </Link>
        </div>

        {/* Active Shares */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50">
          <div className="flex justify-between items-start mb-4">
            <p className="text-gray-400 font-bold text-xs uppercase tracking-wider">Active Shares</p>
            <div className="bg-purple-50 p-2 rounded-lg text-purple-500">
              <i className="fas fa-share-nodes"></i>
            </div>
          </div>
          <h3 className="text-3xl font-bold text-gray-800">{activeShares}</h3>
          <p className="text-xs text-gray-400 mb-4">shared files</p>
          <Link to="/sharing" className="text-indigo-600 text-xs font-bold flex items-center gap-1">
            View All <i className="fas fa-arrow-right"></i>
          </Link>
        </div>

        {/* Storage Used */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50">
          <div className="flex justify-between items-start mb-4">
            <p className="text-gray-400 font-bold text-xs uppercase tracking-wider">Storage Used</p>
            <div className="bg-orange-50 p-2 rounded-lg text-orange-400">
              <i className="fas fa-database"></i>
            </div>
          </div>
          <h3 className="text-3xl font-bold text-gray-800">{storage?.used_mb ?? 0} MB</h3>
          <p className="text-xs text-gray-400 mb-4">Used of {storage?.total_gb ?? 1} GB</p>
          <Link to="/files" className="text-indigo-600 text-xs font-bold flex items-center gap-1">
            Manage <i className="fas fa-arrow-right"></i>
          </Link>
        </div>

        {/* Usage Percentage */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50">
          <div className="flex justify-between items-start mb-4">
            <p className="text-gray-400 font-bold text-xs uppercase tracking-wider">Usage</p>
            <div className="bg-green-50 p-2 rounded-lg text-green-500">
              <i className="fas fa-cloud-arrow-up"></i>
            </div>
          </div>
          <h3 className="text-3xl font-bold text-gray-800">{usedPercentage}%</h3>
          <p className="text-xs text-gray-400 mb-4">space remaining</p>
          <div className="text-indigo-600 text-xs font-bold flex items-center gap-1">Active</div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
        {/* Storage Usage Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-gray-50">
          <h4 className="font-bold text-gray-800 mb-8 flex items-center gap-2">
            <i className="fas fa-database text-blue-600"></i> Storage Usage
          </h4>
          <div className="flex flex-col sm:flex-row items-center gap-8 lg:gap-12">
            {/* Donut Chart */}
            <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90">
                <circle cx="80" cy="80" r="70" fill="transparent" stroke="#f3f4f6" strokeWidth="12" />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="transparent"
                  stroke="#3b82f6"
                  strokeWidth="12"
                  strokeDasharray="440"
                  strokeDashoffset={440 - (440 * usedPercentage) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-bold block">{usedPercentage}%</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-tighter">
                  {storage?.used_mb}MB / {storage?.total_gb}GB
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ UPDATED: Recent Files - Now respects search results */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-gray-50">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-bold text-gray-800 flex items-center gap-2">
              <i className="fas fa-clock text-blue-600"></i> {searchQuery ? 'Search Results' : 'Recent Files'}
            </h4>
            <Link to="/files" className="text-xs font-bold text-indigo-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-4">
            {files.length > 0 ? (
              files.slice(0, 3).map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-indigo-50 transition cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-indigo-500 text-xl">
                      <i
                        className={`fas ${
                          file.mime_type?.includes('pdf')
                            ? 'fa-file-pdf text-red-500'
                            : file.mime_type?.includes('image')
                            ? 'fa-image text-blue-400'
                            : 'fa-file-alt'
                        }`}
                      ></i>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800 truncate max-w-[100px]">
                        {file.original_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {file.file_size_display}
                      </p>
                    </div>
                  </div>
                  <i className="fas fa-chevron-right text-gray-300 text-xs"></i>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">
                {searchQuery ? 'No files match your search.' : 'No recent files found.'}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 shadow-sm border border-gray-50">
          <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
            <i className="fas fa-bolt text-yellow-500"></i> Quick Actions
          </h4>
          <div className="space-y-3">
            <Link
              to="/files"
              className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <i className="fas fa-cloud-upload-alt"></i>
                <span className="font-bold text-sm">Upload Files</span>
              </div>
              <i className="fas fa-chevron-right text-xs opacity-50"></i>
            </Link>

            <Link
              to="/sharing"
              className="flex items-center justify-between p-4 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <i className="fas fa-share-nodes"></i>
                <span className="font-bold text-sm">Share Files</span>
              </div>
              <i className="fas fa-chevron-right text-xs opacity-50"></i>
            </Link>

            <Link
              to="/settings"
              className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <i className="fas fa-cog"></i>
                <span className="font-bold text-sm">Settings</span>
              </div>
              <i className="fas fa-chevron-right text-xs opacity-50"></i>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}