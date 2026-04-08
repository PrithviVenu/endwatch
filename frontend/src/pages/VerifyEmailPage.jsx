import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import * as authApi from '../api/auth.js'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''
  const [status, setStatus] = useState(() => (token ? 'loading' : 'error'))
  const [error, setError] = useState(() =>
    token ? '' : 'Missing verification token.',
  )

  useEffect(() => {
    if (!token) {
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        await authApi.verifyEmail(token)
        if (!cancelled) setStatus('success')
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setError(
            err.response?.data?.error ??
              'Invalid or expired verification link.',
          )
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-xl border border-border-custom bg-card p-8">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-white">
          Endwatch
        </h1>
        <p className="mt-2 text-center text-sm text-gray-400">
          Email verification
        </p>

        <div className="mt-8 text-center">
          {status === 'loading' ? (
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="text-sm">Verifying your email…</p>
            </div>
          ) : null}

          {status === 'success' ? (
            <div className="space-y-4">
              <p className="text-sm text-up">
                Your email has been verified. You can sign in now.
              </p>
              <Link
                to="/login"
                className="inline-block rounded-lg bg-accent px-6 py-3 font-medium text-white transition hover:opacity-90"
              >
                Go to login
              </Link>
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="space-y-4">
              <p className="text-sm text-down" role="alert">
                {error}
              </p>
              <Link
                to="/login"
                className="inline-block text-sm text-accent hover:underline"
              >
                Back to login
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
