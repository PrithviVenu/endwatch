import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as authApi from '../api/auth.js'

export default function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await authApi.signup(email, password)
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error ?? 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-border-custom bg-card p-8">
        <h1 className="mb-6 text-2xl font-semibold text-white">Create account</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error ? (
            <p className="text-sm text-down" role="alert">
              {error}
            </p>
          ) : null}
          <label className="flex flex-col gap-1 text-left text-sm">
            <span className="text-white/80">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-border-custom bg-background px-3 py-2 text-white outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-left text-sm">
            <span className="text-white/80">Password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded border border-border-custom bg-background px-3 py-2 text-white outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded bg-accent py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Sign up'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-white/60">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
