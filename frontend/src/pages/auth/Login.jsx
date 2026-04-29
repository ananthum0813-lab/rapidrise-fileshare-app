import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { login, clearError } from '@/store/authSlice'
import { emailRules } from '@/utils/validators'
import AuthLayout from '@/components/layout/AuthLayout'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'

export default function Login() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { loading, error, isAuthenticated } = useSelector((s) => s.auth)

  const successMessage = location.state?.successMessage || null
  const from = location.state?.from?.pathname || '/dashboard'

  const { register: field, handleSubmit, formState: { errors } } = useForm({ mode: 'onTouched' })

  useEffect(() => { dispatch(clearError()) }, [dispatch])

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true })
  }, [isAuthenticated, navigate, from])

  const onSubmit = async (formData) => {
    const result = await dispatch(login(formData))
    if (login.fulfilled.match(result)) {
      navigate(from, { replace: true })
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your FileShare account.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {successMessage && <Alert type="success" message={successMessage} />}

        <Input
          label="Email address"
          type="email"
          required
          placeholder="jane@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...field('email', emailRules)}
        />

        <div>
          <Input
            label="Password"
            type="password"
            required
            placeholder="Your password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...field('password', { required: 'Password is required.' })}
          />
          <div className="text-right mt-1.5">
            <Link to="/forgot-password" className="text-xs text-brand-600 hover:text-brand-700 transition-colors">
              Forgot password?
            </Link>
          </div>
        </div>

        {error && <Alert type="error" message={error} />}

        <Button type="submit" variant="primary" fullWidth loading={loading} className="mt-1">
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-brand-600 font-medium hover:text-brand-700 transition-colors">
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}