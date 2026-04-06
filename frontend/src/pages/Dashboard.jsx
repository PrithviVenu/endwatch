import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import * as urlsApi from '../api/urls.js'

function formatRelativeTime(iso) {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diffSec = Math.floor((Date.now() - t) / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`
  return `${Math.floor(diffSec / 86400)} day${diffSec >= 172800 ? 's' : ''} ago`
}

function formatUptime(pct) {
  if (pct == null || Number.isNaN(Number(pct))) return '—'
  return `${Number(pct).toFixed(1)}%`
}

const ADD_INTERVAL_OPTIONS = [1, 5, 15, 30, 60]

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [urls, setUrls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addText, setAddText] = useState('')
  const [addIntervalMin, setAddIntervalMin] = useState(5)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const fetchAll = useCallback(async () => {
    setError('')
    try {
      const [statsData, urlsData] = await Promise.all([
        urlsApi.getStats(),
        urlsApi.getUrls(),
      ])
      setStats(statsData)
      setUrls(urlsData.urls ?? [])
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 30_000)
    return () => clearInterval(id)
  }, [fetchAll])

  function logout() {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    navigate('/login', { replace: true })
  }

  async function handleAddUrls(e) {
    e.preventDefault()
    const lines = addText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (lines.length === 0) return
    setAddSubmitting(true)
    try {
      const urls = lines.map((address) => ({
        address,
        intervalMin: addIntervalMin,
      }))
      await urlsApi.addUrls(urls)
      setAddText('')
      setAddIntervalMin(5)
      setAddOpen(false)
      await fetchAll()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to add URLs')
    } finally {
      setAddSubmitting(false)
    }
  }

  async function handleManualCheck() {
    setChecking(true)
    try {
      await urlsApi.triggerCheck()
      await fetchAll()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Check failed')
    } finally {
      setChecking(false)
    }
  }

  async function handleDelete(id) {
    setDeletingId(id)
    try {
      await urlsApi.deleteUrl(id)
      await fetchAll()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to delete URL')
    } finally {
      setDeletingId(null)
    }
  }

  const total = stats?.total ?? 0
  const upCount = stats?.up ?? 0
  const downCount = stats?.down ?? 0
  const uptime = formatUptime(stats?.uptimePct)

  return (
    <div className="min-h-screen bg-background p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Endwatch</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAddIntervalMin(5)
              setAddOpen(true)
            }}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add URLs
          </button>
          <button
            type="button"
            disabled={checking}
            onClick={handleManualCheck}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-60"
          >
            {checking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Manual check
              </>
            )}
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-border-custom bg-hover px-4 py-2 text-sm text-white hover:bg-card"
          >
            Log out
          </button>
        </div>
      </header>

      {error ? (
        <p className="mb-4 text-sm text-down" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !stats ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border-custom bg-card p-6">
              <div className="flex items-center gap-2 text-gray-400">
                <Globe className="h-5 w-5" />
                <span className="text-sm">Total URLs</span>
              </div>
              <p className="mt-1 text-3xl font-bold text-white">{total}</p>
            </div>
            <div className="rounded-xl border border-border-custom bg-card p-6">
              <div className="flex items-center gap-2 text-up">
                <Activity className="h-5 w-5" />
                <span className="text-sm text-gray-400">URLs Up</span>
              </div>
              <p className="mt-1 text-3xl font-bold text-up">{upCount}</p>
            </div>
            <div className="rounded-xl border border-border-custom bg-card p-6">
              <div className="flex items-center gap-2 text-down">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm text-gray-400">URLs Down</span>
              </div>
              <p className="mt-1 text-3xl font-bold text-down">{downCount}</p>
            </div>
            <div className="rounded-xl border border-border-custom bg-card p-6">
              <div className="flex items-center gap-2 text-accent">
                <BarChart3 className="h-5 w-5" />
                <span className="text-sm text-gray-400">Uptime % (24h)</span>
              </div>
              <p className="mt-1 text-3xl font-bold text-accent">{uptime}</p>
            </div>
          </section>

          <div className="mt-8 overflow-hidden rounded-xl border border-border-custom bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="bg-hover text-xs uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3 font-medium">URL</th>
                    <th className="px-4 py-3 font-medium">Label</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Response</th>
                    <th className="px-4 py-3 font-medium">Last checked</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {urls.length === 0 ? (
                    <tr className="border-t border-border-custom">
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No URLs yet. Add some with &quot;Add URLs&quot;.
                      </td>
                    </tr>
                  ) : (
                    urls.map((row) => {
                      const latest = row.latestCheck
                      const st = latest?.status
                      const isUp = st === 'UP'
                      return (
                        <tr
                          key={row.id}
                          className="border-t border-border-custom transition hover:bg-hover"
                        >
                          <td className="max-w-[240px] px-4 py-3">
                            <span
                              className="block truncate font-mono text-white"
                              title={row.address}
                            >
                              {row.address}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {row.label ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            {!latest ? (
                              <span className="text-xs text-gray-500">—</span>
                            ) : isUp ? (
                              <span className="rounded-full bg-up/10 px-2 py-1 text-xs font-medium text-up">
                                UP
                              </span>
                            ) : (
                              <span className="rounded-full bg-down/10 px-2 py-1 text-xs font-medium text-down">
                                DOWN
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {latest?.responseTime != null
                              ? `${latest.responseTime} ms`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {formatRelativeTime(latest?.checkedAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              disabled={deletingId === row.id}
                              onClick={() => handleDelete(row.id)}
                              className="inline-flex rounded p-1.5 text-gray-400 transition hover:bg-hover hover:text-down disabled:opacity-50"
                              aria-label="Delete URL"
                            >
                              {deletingId === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {addOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="presentation"
          onClick={() => !addSubmitting && setAddOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border-custom bg-card p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-urls-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-urls-title" className="text-lg font-semibold text-white">
              Add URLs
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              One URL per line. Duplicates for your account are updated.
            </p>
            <form onSubmit={handleAddUrls} className="mt-4">
              <textarea
                value={addText}
                onChange={(e) => setAddText(e.target.value)}
                placeholder="https://example.com&#10;https://another.org"
                className="h-32 w-full rounded-lg border border-border-custom bg-hover p-3 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
              />
              <label className="mt-4 block text-sm text-gray-400">
                Check interval (applies to all URLs)
                <select
                  value={addIntervalMin}
                  onChange={(e) => setAddIntervalMin(Number(e.target.value))}
                  className="mt-2 w-full cursor-pointer rounded-lg border border-border-custom bg-hover px-4 py-3 text-white focus:border-accent focus:outline-none"
                >
                  {ADD_INTERVAL_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  disabled={addSubmitting}
                  className="rounded-lg border border-border-custom px-4 py-2 text-white hover:bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
                >
                  {addSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding…
                    </span>
                  ) : (
                    'Add URLs'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
