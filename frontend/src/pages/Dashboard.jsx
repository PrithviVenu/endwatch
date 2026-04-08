import { Fragment, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import * as urlsApi from '../api/urls.js'
import UrlHistoryChart from '../components/UrlHistoryChart.jsx'

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

const HISTORY_PRESETS = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
]

function createEmptyHeaderRow() {
  return { id: crypto.randomUUID(), key: '', value: '' }
}

function getHeaderPairs(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return []
  return Object.entries(headers)
    .filter(([k, v]) => typeof k === 'string' && k.trim() !== '' && typeof v === 'string')
    .sort(([a], [b]) => a.localeCompare(b))
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [urls, setUrls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addAddress, setAddAddress] = useState('')
  const [addLabel, setAddLabel] = useState('')
  const [addMethod, setAddMethod] = useState('GET')
  const [addHeadersRows, setAddHeadersRows] = useState(() => [
    createEmptyHeaderRow(),
  ])
  const [addRequestBody, setAddRequestBody] = useState('')
  const [addIntervalMin, setAddIntervalMin] = useState(5)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkingByUrl, setCheckingByUrl] = useState({})
  const [deletingId, setDeletingId] = useState(null)
  const [expandedUrlId, setExpandedUrlId] = useState(null)
  const [historyHoursByUrl, setHistoryHoursByUrl] = useState({})
  const [slaByUrl, setSlaByUrl] = useState({})
  const [slaLoadingByUrl, setSlaLoadingByUrl] = useState({})

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
    const id = setInterval(fetchAll, 10_000)
    return () => clearInterval(id)
  }, [fetchAll])

  function logout() {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    navigate('/login', { replace: true })
  }

  async function handleAddUrl(e) {
    e.preventDefault()
    const address = addAddress.trim()
    if (!address) return
    const label = addLabel.trim()
    const method = addMethod

    const headers = addHeadersRows.reduce((acc, row) => {
      const k = row.key.trim()
      if (!k) return acc
      acc[k] = row.value
      return acc
    }, {})

    const requestBodyAllowed = method !== 'GET' && method !== 'HEAD'
    const requestBody = requestBodyAllowed ? addRequestBody : ''

    setAddSubmitting(true)
    try {
      await urlsApi.addUrl({
        address,
        label: label === '' ? null : label,
        intervalMin: addIntervalMin,
        method,
        headers,
        requestBody: requestBody === '' ? null : requestBody,
      })
      try {
        // Best-effort: enqueue checks immediately so new URLs show status quickly.
        await urlsApi.triggerCheck()
        toast.success('URL created. Initial check triggered — results will appear in a few seconds.')
      } catch {
        // Ignore; scheduler will pick it up soon anyway.
      }
      setAddAddress('')
      setAddLabel('')
      setAddMethod('GET')
      setAddHeadersRows([createEmptyHeaderRow()])
      setAddRequestBody('')
      setAddIntervalMin(5)
      setAddOpen(false)
      await fetchAll()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to add URL')
    } finally {
      setAddSubmitting(false)
    }
  }

  async function handleManualCheck() {
    setChecking(true)
    try {
      await urlsApi.triggerCheck()
      toast.success('Manual check triggered — please wait a few seconds for results to update.')
    } catch (err) {
      setError(err.response?.data?.error ?? 'Check failed')
    } finally {
      setChecking(false)
    }
  }

  async function handleManualCheckUrl(id) {
    setCheckingByUrl((prev) => ({ ...prev, [id]: true }))
    try {
      await urlsApi.triggerCheckForUrl(id)
      toast.success('Manual check triggered — please wait a few seconds for results to update.')
    } catch (err) {
      setError(err.response?.data?.error ?? 'Check failed')
    } finally {
      setCheckingByUrl((prev) => ({ ...prev, [id]: false }))
    }
  }

  async function handleDelete(id) {
    setDeletingId(id)
    try {
      await urlsApi.deleteUrl(id)
      toast.success('URL deleted.')
      setExpandedUrlId((cur) => (cur === id ? null : cur))
      setHistoryHoursByUrl((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setSlaByUrl((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setSlaLoadingByUrl((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      await fetchAll()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to delete URL')
    } finally {
      setDeletingId(null)
    }
  }

  async function toggleRowExpand(id) {
    setExpandedUrlId((prev) => (prev === id ? null : id))
    if (slaByUrl[id] || slaLoadingByUrl[id]) return
    setSlaLoadingByUrl((prev) => ({ ...prev, [id]: true }))
    try {
      const data = await urlsApi.getSla(id)
      setSlaByUrl((prev) => ({ ...prev, [id]: data }))
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to load SLA metrics')
    } finally {
      setSlaLoadingByUrl((prev) => ({ ...prev, [id]: false }))
    }
  }

  function setHistoryHoursForUrl(id, hours) {
    setHistoryHoursByUrl((prev) => ({ ...prev, [id]: hours }))
  }

  function uptimeColorClass(pct) {
    if (pct == null || Number.isNaN(Number(pct))) return 'text-gray-400'
    const n = Number(pct)
    if (n >= 99) return 'text-up'
    if (n >= 95) return 'text-accent'
    return 'text-down'
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
              setAddAddress('')
              setAddLabel('')
              setAddMethod('GET')
              setAddHeadersRows([createEmptyHeaderRow()])
              setAddRequestBody('')
              setAddOpen(true)
            }}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add URL
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
                Manual Check All URLs
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
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="bg-hover text-xs uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3 font-medium">URL</th>
                    <th className="px-4 py-3 font-medium">Label</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Headers</th>
                    <th className="px-4 py-3 font-medium">Body</th>
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
                        colSpan={9}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No URLs yet. Add one with &quot;Add URL&quot;.
                      </td>
                    </tr>
                  ) : (
                    urls.map((row) => {
                      const latest = row.latestCheck
                      const st = latest?.status
                      const isUp = st === 'UP'
                      const expanded = expandedUrlId === row.id
                      const chartHours = historyHoursByUrl[row.id] ?? 24
                      const sla = slaByUrl[row.id]
                      const slaLoading = slaLoadingByUrl[row.id]
                      const method = row.method ?? 'GET'
                      const headerPairs = getHeaderPairs(row.headers)
                      const headerCount = headerPairs.length
                      const requestBody = row.requestBody ?? null
                      const rowChecking = checkingByUrl[row.id] === true
                      return (
                        <Fragment key={row.id}>
                          <tr
                            onClick={() => toggleRowExpand(row.id)}
                            className={`cursor-pointer border-t border-border-custom transition hover:bg-hover ${
                              expanded ? 'bg-hover/50' : ''
                            }`}
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
                              <span className="rounded bg-hover px-2 py-1 font-mono text-xs text-white">
                                {method}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-300">
                              {headerCount === 0 ? (
                                '—'
                              ) : (
                                <span className="rounded bg-hover px-2 py-1 text-xs text-white">
                                  {headerCount}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-300">
                              {requestBody ? (
                                <span className="rounded bg-hover px-2 py-1 text-xs text-white">
                                  {new Blob([requestBody]).size >= 1024
                                    ? `${Math.round(
                                        (new Blob([requestBody]).size / 1024) * 10,
                                      ) / 10} kb`
                                    : `${new Blob([requestBody]).size} b`}
                                </span>
                              ) : (
                                '—'
                              )}
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
                                disabled={rowChecking}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleManualCheckUrl(row.id)
                                }}
                                className="mr-1 inline-flex items-center gap-2 rounded-lg bg-hover px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                                aria-label="Manual check URL"
                              >
                                {rowChecking ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Checking...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="h-4 w-4" />
                                    Manual Check
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === row.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(row.id)
                                }}
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
                          {expanded ? (
                            <tr className="border-t border-border-custom bg-background">
                              <td colSpan={9} className="px-4 pb-4 pt-0">
                                <div className="mt-2 rounded-xl border border-border-custom bg-card p-4">
                                  <div className="mb-4 grid gap-3 md:grid-cols-2">
                                    <div className="rounded-xl border border-border-custom bg-card p-4">
                                      <p className="text-xs uppercase tracking-wider text-gray-400">
                                        Request config
                                      </p>
                                      <div className="mt-3 space-y-2 text-sm">
                                        <p className="text-gray-400">
                                          Method:{' '}
                                          <span className="font-mono text-white">
                                            {method}
                                          </span>
                                        </p>
                                        <div>
                                          <p className="text-gray-400">Headers</p>
                                          {headerCount === 0 ? (
                                            <p className="mt-1 text-gray-500">—</p>
                                          ) : (
                                            <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-border-custom bg-hover p-3 font-mono text-xs text-white">
                                              {headerPairs.map(([k, v]) => (
                                                <div key={k} className="truncate">
                                                  <span className="text-gray-300">
                                                    {k}:
                                                  </span>{' '}
                                                  {v}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        <div>
                                          <p className="text-gray-400">Body</p>
                                          {!requestBody ? (
                                            <p className="mt-1 text-gray-500">—</p>
                                          ) : (
                                            <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-border-custom bg-hover p-3 text-xs text-white">
                                              {requestBody}
                                            </pre>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="rounded-xl border border-border-custom bg-card p-4">
                                      <p className="text-xs uppercase tracking-wider text-gray-400">
                                        History
                                      </p>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {HISTORY_PRESETS.map(({ label, hours }) => (
                                          <button
                                            key={label}
                                            type="button"
                                            onClick={() =>
                                              setHistoryHoursForUrl(row.id, hours)
                                            }
                                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                                              chartHours === hours
                                                ? 'bg-accent text-white'
                                                : 'bg-hover text-gray-400 hover:text-white'
                                            }`}
                                          >
                                            {label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <UrlHistoryChart
                                    urlId={row.id}
                                    hours={chartHours}
                                  />

                                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                                    {['24h', '7d', '30d'].map((k) => {
                                      const m = sla?.[k]
                                      const pct = m?.uptimePct
                                      return (
                                        <div
                                          key={k}
                                          className="rounded-xl border border-border-custom bg-card p-4"
                                        >
                                          <p className="text-xs uppercase tracking-wider text-gray-400">
                                            {k}
                                          </p>
                                          {slaLoading ? (
                                            <div className="mt-3 flex items-center gap-2 text-gray-400">
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                              <span className="text-sm">Loading…</span>
                                            </div>
                                          ) : (
                                            <>
                                              <p
                                                className={`mt-2 text-3xl font-bold ${uptimeColorClass(
                                                  pct,
                                                )}`}
                                              >
                                                {formatUptime(pct)}
                                              </p>
                                              <div className="mt-3 space-y-1 text-sm text-gray-400">
                                                <p>
                                                  Checks:{' '}
                                                  <span className="text-white">
                                                    {m?.totalChecks ?? 0}
                                                  </span>
                                                </p>
                                                <p>
                                                  Failures:{' '}
                                                  <span className="text-white">
                                                    {m?.failures ?? 0}
                                                  </span>
                                                </p>
                                                <p>
                                                  Avg RT:{' '}
                                                  <span className="text-white">
                                                    {m?.avgResponseTime != null
                                                      ? `${m.avgResponseTime} ms`
                                                      : '—'}
                                                  </span>
                                                </p>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
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
              Add URL
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Duplicates for your account are updated.
            </p>
            <form onSubmit={handleAddUrl} className="mt-4 space-y-3">
              <div className="space-y-2">
                <input
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  placeholder="https://google.com"
                  className="w-full rounded-lg border border-border-custom bg-hover px-3 py-2 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
                />
                <input
                  type="text"
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  placeholder="Label (optional)"
                  className="w-full rounded-lg border border-border-custom bg-hover px-3 py-2 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm text-gray-400">
                  Method
                  <select
                    value={addMethod}
                    onChange={(e) => {
                      const next = e.target.value
                      setAddMethod(next)
                      if (next === 'GET' || next === 'HEAD') {
                        setAddRequestBody('')
                      }
                    }}
                    className="mt-2 w-full cursor-pointer rounded-lg border border-border-custom bg-hover px-4 py-3 text-white focus:border-accent focus:outline-none"
                  >
                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(
                      (m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="block text-sm text-gray-400">
                  Check interval
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
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-400">Headers</p>
                {addHeadersRows.map((row) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={row.key}
                      onChange={(e) => {
                        const v = e.target.value
                        setAddHeadersRows((rows) =>
                          rows.map((r) =>
                            r.id === row.id ? { ...r, key: v } : r,
                          ),
                        )
                      }}
                      placeholder="Header name"
                      className="min-w-0 flex-1 rounded-lg border border-border-custom bg-hover px-3 py-2 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
                    />
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) => {
                        const v = e.target.value
                        setAddHeadersRows((rows) =>
                          rows.map((r) =>
                            r.id === row.id ? { ...r, value: v } : r,
                          ),
                        )
                      }}
                      placeholder="Value"
                      className="min-w-0 flex-1 rounded-lg border border-border-custom bg-hover px-3 py-2 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={addHeadersRows.length <= 1 || addSubmitting}
                      onClick={() =>
                        setAddHeadersRows((rows) =>
                          rows.length <= 1
                            ? rows
                            : rows.filter((r) => r.id !== row.id),
                        )
                      }
                      className="shrink-0 rounded p-2 text-gray-400 transition hover:text-down disabled:pointer-events-none disabled:opacity-30"
                      aria-label="Remove header"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={addSubmitting}
                  onClick={() =>
                    setAddHeadersRows((rows) => [...rows, createEmptyHeaderRow()])
                  }
                  className="text-sm text-accent hover:underline disabled:opacity-50"
                >
                  + Add header
                </button>
              </div>

              <label className="block text-sm text-gray-400">
                Request body
                <textarea
                  value={addRequestBody}
                  onChange={(e) => setAddRequestBody(e.target.value)}
                  disabled={addMethod === 'GET' || addMethod === 'HEAD'}
                  placeholder={
                    addMethod === 'GET' || addMethod === 'HEAD'
                      ? 'Not allowed for GET/HEAD'
                      : 'Optional'
                  }
                  rows={4}
                  className="mt-2 w-full resize-y rounded-lg border border-border-custom bg-hover px-3 py-2 font-mono text-white placeholder-gray-500 focus:border-accent focus:outline-none disabled:opacity-50"
                />
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
                    'Add URL'
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
