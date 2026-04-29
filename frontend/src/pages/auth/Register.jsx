import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { register, clearError } from '@/store/authSlice'
import {
  emailRules, passwordRules,
  firstNameRules, lastNameRules, dateOfBirthRules,
} from '@/utils/validators'
import AuthLayout from '@/components/layout/AuthLayout'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'

export default function Register() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading, error, isAuthenticated } = useSelector((s) => s.auth)

  const {
    register: field, handleSubmit, watch, setError,
    formState: { errors },
  } = useForm({ mode: 'onTouched' })

  const password = watch('password')

  useEffect(() => { dispatch(clearError()) }, [dispatch])

  // If already logged in, skip registration
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  const onSubmit = async (formData) => {
    const result = await dispatch(register(formData))

    if (register.rejected.match(result)) {
      // Map backend field errors onto the form
      const fieldErrors = result.payload?.errors
      if (fieldErrors && typeof fieldErrors === 'object') {
        Object.entries(fieldErrors).forEach(([key, msgs]) => {
          if (key !== 'non_field_errors') {
            setError(key, {
              type: 'server',
              message: Array.isArray(msgs) ? msgs[0] : String(msgs),
            })
          }
        })
      }
      return
    }

    // SUCCESS — go to login with a success message
    navigate('/login', {
      replace: true,
      state: { successMessage: 'Account created! Please sign in.' },
    })
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start sharing files securely in minutes."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First name" required placeholder="Jane"
            error={errors.first_name?.message}
            {...field('first_name', firstNameRules)}
          />
          <Input
            label="Last name" required placeholder="Doe"
            error={errors.last_name?.message}
            {...field('last_name', lastNameRules)}
          />
        </div>

        <Input
          label="Email address" type="email" required placeholder="jane@example.com"
          error={errors.email?.message}
          {...field('email', emailRules)}
        />

        <Input
          label="Date of birth" type="date" required
          error={errors.date_of_birth?.message}
          {...field('date_of_birth', dateOfBirthRules)}
        />

        <Input
          label="Password" type="password" required
          placeholder="Min. 8 chars with number & symbol"
          hint="Must include a letter, number, and special character."
          error={errors.password?.message}
          {...field('password', passwordRules)}
        />

        <Input
          label="Confirm password" type="password" required
          placeholder="Repeat your password"
          error={errors.confirm_password?.message}
          {...field('confirm_password', {
            required: 'Please confirm your password.',
            validate: (v) => v === password || 'Passwords do not match.',
          })}
        />

        {error && <Alert type="error" message={error} />}

        <Button type="submit" variant="primary" fullWidth loading={loading} className="mt-1">
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-600 font-medium hover:text-brand-700 transition-colors">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}