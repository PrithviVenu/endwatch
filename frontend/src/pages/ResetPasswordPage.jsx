import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import * as authApi from '../api/auth.js'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState('')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setToken(searchParams.get('token')?.trim() ?? '')
  }, [searchParams])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!token) {
      setError('Missing reset token.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      navigate('/login', {
        replace: true,
        state: { passwordReset: true },
      })
    } catch (err) {
      setError(err.response?.data?.error ?? 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-xl border border-border-custom bg-card p-8">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-white">
          Endwatch
        </h1>
        <p className="mt-2 text-center text-sm text-gray-400">
          Choose a new password
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error ? (
            <p className="text-sm text-down" role="alert">
              {error}
            </p>
          ) : null}

          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border-custom bg-hover px-4 py-3 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
          />
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-border-custom bg-hover px-4 py-3 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Resetting…
              </span>
            ) : (
              'Reset password'
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-400">
          <Link to="/login" className="text-accent hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}

