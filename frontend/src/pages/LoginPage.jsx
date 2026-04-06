import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as authApi from '../api/auth.js'

export default function LoginPage() {
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
      const data = await authApi.login(email, password)
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      localStorage.setItem('user', JSON.stringify(data.user))
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error ?? 'Login failed')
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
        <p className="mt-2 text-center text-sm text-gray-400">Sign in to continue</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error ? (
            <p className="mt-2 text-sm text-down" role="alert">
              {error}
            </p>
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
