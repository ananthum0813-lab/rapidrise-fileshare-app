import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { changePassword } from '@/api/authApi'
import { passwordRules, getApiError } from '@/utils/validators'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function Settings() {
  const { user } = useSelector((s) => s.auth)
  const [changing, setChanging] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const {
    register: field, handleSubmit, watch, reset,
    formState: { errors },
  } = useForm({ mode: 'onTouched' })

  const newPassword = watch('new_password')

  useEffect(() => { reset() }, [reset])

  const onSubmit = async (data) => {
    setChanging(true)
    setError(null)
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
      setError(getApiError(err))
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Account Settings</h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">Manage your profile and security.</p>
          </div>

          {/* Profile Section */}
          <div className="card p-4 sm:p-6 mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Profile Information</h2>

            <div className="space-y-4 sm:space-y-6 text-sm">
              <div>
                <p className="text-gray-500 text-xs sm:text-sm font-medium uppercase tracking-wide">Email address</p>
                <p className="text-gray-900 font-medium mt-1 break-all">{user?.email}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <p className="text-gray-500 text-xs sm:text-sm font-medium uppercase tracking-wide">First name</p>
                  <p className="text-gray-900 font-medium mt-1">{user?.first_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs sm:text-sm font-medium uppercase tracking-wide">Last name</p>
                  <p className="text-gray-900 font-medium mt-1">{user?.last_name}</p>
                </div>
              </div>

              <div>
                <p className="text-gray-500 text-xs sm:text-sm font-medium uppercase tracking-wide">Date of birth</p>
                <p className="text-gray-900 font-medium mt-1">
                  {user?.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString() : '—'}
                </p>
              </div>

              <div>
                <p className="text-gray-500 text-xs sm:text-sm font-medium uppercase tracking-wide">Member since</p>
                <p className="text-gray-900 font-medium mt-1">
                  {new Date(user?.date_joined).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <button className="mt-6 text-brand-600 hover:text-brand-700 text-sm font-medium transition-colors opacity-50 cursor-not-allowed">
              Edit profile (coming soon)
            </button>
          </div>

          {/* Change Password Section */}
          <div className="card p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Change Password</h2>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <Input
                label="Current password"
                type="password"
                required
                placeholder="Your current password"
                error={errors.old_password?.message}
                {...field('old_password', { required: 'Current password is required.' })}
              />

              <Input
                label="New password"
                type="password"
                required
                placeholder="Min. 8 chars with number & symbol"
                hint="Must include a letter, number, and special character."
                error={errors.new_password?.message}
                {...field('new_password', passwordRules)}
              />

              <Input
                label="Confirm new password"
                type="password"
                required
                placeholder="Repeat your new password"
                error={errors.confirm_password?.message}
                {...field('confirm_password', {
                  required: 'Please confirm your password.',
                  validate: (v) => v === newPassword || 'Passwords do not match.',
                })}
              />

              {error && <Alert type="error" message={error} />}
              {success && <Alert type="success" message={success} />}

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button type="submit" variant="primary" loading={changing} className="w-full sm:w-auto">
                  Update Password
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => reset()}
                  className="w-full sm:w-auto"
                >
                  Reset
                </Button>
              </div>
            </form>
          </div>

          {/* Security Info */}
          <div className="mt-6 p-4 sm:p-5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900">
            <p className="font-semibold mb-2">🔒 Password Security</p>
            <p className="text-xs sm:text-sm leading-relaxed">
              Your password is hashed and never stored in plain text. After you change your password, you'll need to sign in again on all devices.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}