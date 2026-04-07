import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as authApi from '../api/auth.js'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setMessage('If that email exists, a reset link has been sent.')
    } catch (err) {
      setError(err.response?.data?.error ?? 'Request failed')
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
          Reset your password
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {message ? (
            <p className="text-sm text-up" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-down" role="alert">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send reset link'}
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

