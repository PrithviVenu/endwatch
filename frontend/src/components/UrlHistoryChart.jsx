import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import * as urlsApi from '../api/urls.js'

const AXIS_STROKE = '#9ca3af'
const GRID_STROKE = '#222222'
const LINE_STROKE = '#22c55e'
const DOT_UP = '#22c55e'
const DOT_DOWN = '#ef4444'
const TOOLTIP_BG = '#111111'
const TOOLTIP_BORDER = '#222222'

function formatAxisTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const timeStr =
    label != null
      ? new Date(label).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      : d.checkedAt
        ? new Date(d.checkedAt).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })
        : ''
  return (
    <div
      className="rounded border p-3 text-sm shadow-lg"
      style={{
        backgroundColor: TOOLTIP_BG,
        borderColor: TOOLTIP_BORDER,
        color: '#ffffff',
      }}
    >
      {timeStr ? (
        <p className="text-xs" style={{ color: AXIS_STROKE }}>
          {timeStr}
        </p>
      ) : null}
      <p className="mt-1 font-medium">Status: {d.status ?? '—'}</p>
      <p className="mt-1">
        Response:{' '}
        {d.responseTime != null ? `${d.responseTime} ms` : '—'}
      </p>
      {d.error ? (
        <p className="mt-2 text-[#ef4444]">Error: {d.error}</p>
      ) : null}
    </div>
  )
}

function renderDot(props) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null || !payload) return null
  const fill = payload.status === 'UP' ? DOT_UP : DOT_DOWN
  return <circle cx={cx} cy={cy} r={3} fill={fill} />
}

export default function UrlHistoryChart({ urlId, hours }) {
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setFetchError('')
      try {
        const data = await urlsApi.getHistory(urlId, hours)
        if (!cancelled) {
          setPoints(data.results ?? [])
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err.response?.data?.error ?? 'Failed to load history')
          setPoints([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [urlId, hours])

  const chartData = points.map((r) => ({
    ...r,
    checkedAt: r.checkedAt,
    responseTime: r.responseTime ?? null,
  }))

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center bg-card">
        <Loader2 className="h-8 w-8 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex h-[300px] items-center justify-center bg-card text-sm text-down">
        {fetchError}
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center bg-card text-sm text-gray-400">
        No check data in this time range.
      </div>
    )
  }

  return (
    <div className="h-[300px] w-full bg-card">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            stroke={GRID_STROKE}
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="checkedAt"
            tickFormatter={formatAxisTime}
            stroke={AXIS_STROKE}
            tick={{ fill: AXIS_STROKE, fontSize: 12 }}
            tickLine={{ stroke: AXIS_STROKE }}
            axisLine={{ stroke: AXIS_STROKE }}
          />
          <YAxis
            dataKey="responseTime"
            stroke={AXIS_STROKE}
            tick={{ fill: AXIS_STROKE, fontSize: 12 }}
            tickLine={{ stroke: AXIS_STROKE }}
            axisLine={{ stroke: AXIS_STROKE }}
            width={48}
            label={{
              value: 'ms',
              position: 'insideLeft',
              fill: AXIS_STROKE,
              fontSize: 12,
            }}
            domain={[0, 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="responseTime"
            stroke={LINE_STROKE}
            strokeWidth={2}
            dot={renderDot}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
