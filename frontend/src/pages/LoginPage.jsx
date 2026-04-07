import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as authApi from '../api/auth.js'

const VERIFY_EMAIL_ERROR = 'Please verify your email before continuing'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const registered = location.state?.registered === true
  const passwordReset = location.state?.passwordReset === true

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [verifyHint, setVerifyHint] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setVerifyHint(false)
    setResendMessage('')
    setLoading(true)
    try {
      const data = await authApi.login(email, password)
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      localStorage.setItem('user', JSON.stringify(data.user))
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Login failed'
      if (err.response?.status === 403 && msg === VERIFY_EMAIL_ERROR) {
        setVerifyHint(true)
        setError('Please verify your email. Check your inbox.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResendVerification() {
    if (!email.trim()) {
      setResendMessage('Enter your email above first.')
      return
    }
    setResendMessage('')
    setResendLoading(true)
    try {
      const data = await authApi.resendVerification(email.trim())
      setResendMessage(data.message ?? 'If this email is registered, a new link was sent.')
    } catch (err) {
      setResendMessage(err.response?.data?.error ?? 'Could not resend email.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-xl border border-border-custom bg-card p-8">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-white">
          Endwatch
        </h1>
        <p className="mt-2 text-center text-sm text-gray-400">Sign in to continue</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {registered ? (
            <p className="text-sm text-up" role="status">
              Account created. Check your inbox to verify your email, then sign in.
            </p>
          ) : null}
          {passwordReset ? (
            <p className="text-sm text-up" role="status">
              Password reset successful. You can sign in now.
            </p>
          ) : null}

          {error ? (
            <p className="mt-2 text-sm text-down" role="alert">
              {error}
            </p>
          ) : null}

          {verifyHint ? (
            <div className="rounded-lg border border-border-custom bg-hover/50 p-3">
              <button
                type="button"
                disabled={resendLoading}
                onClick={handleResendVerification}
                className="mt-2 text-sm text-accent hover:underline disabled:opacity-50"
              >
                {resendLoading ? 'Sending…' : 'Resend verification email'}
              </button>
              {resendMessage ? (
                <p className="mt-2 text-xs text-gray-400">{resendMessage}</p>
              ) : null}
            </div>
          ) : null}

          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border-custom bg-hover px-4 py-3 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
          />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border-custom bg-hover px-4 py-3 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
          />
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm text-accent hover:underline">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-400">
          No account?{' '}
          <Link to="/signup" className="text-accent hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
