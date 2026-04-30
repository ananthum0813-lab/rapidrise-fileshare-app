import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSelector, useDispatch } from 'react-redux'
import { changePassword } from '@/api/authApi'
import { editProfile } from '@/store/authSlice'
import { passwordRules, getApiError } from '@/utils/validators'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function Settings() {
  const { user, loading, error } = useSelector((s) => s.auth)
  const dispatch = useDispatch()
  const [changing, setChanging] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [success, setSuccess] = useState(null)
  const [editingProfile, setEditingProfile] = useState(false)

  const {
    register: field, handleSubmit, watch, reset,
    formState: { errors },
  } = useForm({ mode: 'onTouched' })

  const {
    register: profileField, handleSubmit: handleProfileSubmit, reset: resetProfile,
    formState: { errors: profileErrors },
  } = useForm({ 
    mode: 'onTouched',
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      date_of_birth: user?.date_of_birth || '',
    }
  })

  const newPassword = watch('new_password')
  const avatarUrl = `https://ui-avatars.com/api/?name=${user?.first_name || 'U'}&background=6366f1&color=fff&size=128`

  useEffect(() => { reset() }, [reset])
  useEffect(() => { resetProfile() }, [resetProfile, user])

  const onSubmit = async (data) => {
    setChanging(true)
    setErrorMsg(null)
    setSuccess(null)

    try {
      await changePassword({
        old_password: data.old_password,
        new_password: data.new_password,
        confirm_password: data.confirm_password,
      })
      setSuccess('Password changed successfully!')
      reset()
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      setErrorMsg(getApiError(err))
    } finally {
      setChanging(false)
    }
  }

  const onProfileSubmit = async (data) => {
    const profileData = {}
    if (data.first_name !== user?.first_name) profileData.first_name = data.first_name
    if (data.last_name !== user?.last_name) profileData.last_name = data.last_name
    if (data.date_of_birth !== user?.date_of_birth) profileData.date_of_birth = data.date_of_birth
    
    if (Object.keys(profileData).length === 0) {
      setSuccess('No changes made.')
      return
    }

    try {
      await dispatch(editProfile(profileData)).unwrap()
      setSuccess('Profile updated successfully!')
      setEditingProfile(false)
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      setErrorMsg(err || 'Failed to update profile.')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <header className="mb-8">
          <h2 className="text-3xl font-bold text-indigo-900">Account Settings</h2>
          <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm">
            <i className="fas fa-user-shield text-indigo-400"></i>
            Manage your identity and security preferences
          </p>
        </header>

        {success && <Alert type="success" message={success} className="mb-6 rounded-2xl shadow-sm" />}
        {errorMsg && <Alert type="error" message={errorMsg} className="mb-6 rounded-2xl shadow-sm" />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Profile Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-50">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <i className="fas fa-id-card text-indigo-500"></i> Personal Info
                </h3>
                {!editingProfile && (
                  <button 
                    onClick={() => setEditingProfile(true)}
                    className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors"
                  >
                    Edit Profile
                  </button>
                )}
              </div>

              {!editingProfile ? (
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="relative group">
                    <img src={avatarUrl} className="w-24 h-24 rounded-[2rem] border-4 border-indigo-50 shadow-inner" alt="User" />
                    <div className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 border-4 border-white rounded-full"></div>
                  </div>
                  
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Full Name</p>
                      <p className="font-bold text-gray-800">{user?.first_name} {user?.last_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Email Address</p>
                      <p className="font-bold text-gray-800 truncate">{user?.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Birth Date</p>
                      <p className="font-bold text-gray-800">
                        {user?.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Member Since</p>
                      <p className="font-bold text-gray-800">{new Date(user?.date_joined).getFullYear()}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="First Name" {...profileField('first_name')} error={profileErrors.first_name?.message} className="bg-gray-50 border-none rounded-2xl" />
                    <Input label="Last Name" {...profileField('last_name')} error={profileErrors.last_name?.message} className="bg-gray-50 border-none rounded-2xl" />
                  </div>
                  <Input label="Birth Date" type="date" {...profileField('date_of_birth')} error={profileErrors.date_of_birth?.message} className="bg-gray-50 border-none rounded-2xl" />
                  
                  <div className="flex gap-3 pt-4">
                    <button type="submit" disabled={loading} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                      {loading ? <i className="fas fa-spinner fa-spin mr-2"></i> : 'Save Changes'}
                    </button>
                    <button type="button" onClick={() => setEditingProfile(false)} className="px-6 py-3 text-gray-400 font-bold text-sm hover:text-gray-600">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Change Password Card */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-50">
              <h3 className="text-xl font-bold text-gray-800 mb-8 flex items-center gap-2">
                <i className="fas fa-lock text-orange-400"></i> Security & Password
              </h3>
              
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid grid-cols-1 gap-5">
                  <Input
                    label="Current Password"
                    type="password"
                    placeholder="••••••••"
                    {...field('old_password', { required: 'Required' })}
                    error={errors.old_password?.message}
                    className="bg-gray-50 border-none rounded-2xl"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Input
                      label="New Password"
                      type="password"
                      placeholder="••••••••"
                      {...field('new_password', passwordRules)}
                      error={errors.new_password?.message}
                      className="bg-gray-50 border-none rounded-2xl"
                    />
                    <Input
                      label="Confirm Password"
                      type="password"
                      placeholder="••••••••"
                      {...field('confirm_password', {
                        required: 'Required',
                        validate: (v) => v === newPassword || 'Mismatch',
                      })}
                      error={errors.confirm_password?.message}
                      className="bg-gray-50 border-none rounded-2xl"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={changing} className="px-8 py-4 bg-indigo-900 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-black transition-all flex items-center gap-2">
                    {changing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-shield-halved"></i>}
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Information & Actions */}
          <div className="space-y-6">
            {/* Quick Actions Card */}
            <div className="bg-indigo-900 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
               <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>
               <h4 className="font-bold mb-4 flex items-center gap-2">
                 <i className="fas fa-circle-info text-indigo-300"></i> Account Safety
               </h4>
               <p className="text-indigo-100 text-xs leading-relaxed mb-6">
                 Your security is our priority. Your password is encrypted before storage and we never store plain text keys.
               </p>
               <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                    <i className="fas fa-envelope-circle-check text-green-400"></i>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Email Verified</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                    <i className="fas fa-microchip text-indigo-300"></i>
                    <span className="text-[10px] font-bold uppercase tracking-wider">AES-256 Encryption</span>
                  </div>
               </div>
            </div>

            {/* Logout/Danger Zone Placeholder */}
            {/* <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-red-50">
               <h4 className="font-bold text-red-500 mb-4">Danger Zone</h4>
               <p className="text-gray-400 text-xs mb-6">Once you delete your account, there is no going back. Please be certain.</p>
               <button className="w-full py-3 text-red-500 font-bold text-xs border-2 border-red-50 rounded-2xl hover:bg-red-50 transition-colors">
                 Deactivate Account
               </button>
            </div> */}
          </div>

        </div>
      </div>
    </div>
  )
}