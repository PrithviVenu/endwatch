import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import * as urlsApi from '../api/urls.js'

const AXIS_STROKE = '#9ca3af'
const GRID_STROKE = '#222222'
const LINE_STROKE = '#22c55e'
const DOWN_LINE_STROKE = '#ef4444'
const DOT_UP = '#22c55e'
const DOT_DOWN = '#ef4444'
const TOOLTIP_BG = '#111111'
const TOOLTIP_BORDER = '#222222'
const DOWN_BAND_OPACITY = 0.12

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

  const baseData = points.map((r) => ({
    ...r,
    checkedAt: r.checkedAt,
    responseTime: r.responseTime ?? null,
  }))

  const downIntervals = (() => {
    const intervals = []
    let downStart = null

    for (const p of baseData) {
      const t = p?.checkedAt
      if (!t) continue
      const isDown = p.status === 'DOWN'
      const isUp = p.status === 'UP'

      if (downStart == null) {
        if (isDown) downStart = t
        continue
      }

      if (isUp) {
        intervals.push({ start: downStart, end: t })
        downStart = null
      }
    }

    if (downStart != null) {
      const last = baseData[baseData.length - 1]
      if (last?.checkedAt) {
        intervals.push({ start: downStart, end: last.checkedAt })
      }
    }

    return intervals.filter((it) => it.start && it.end && it.start !== it.end)
  })()

  const chartData = (() => {
    let lastUpRt = null
    let lastKnownRt = null
    let inDown = false
    return baseData.map((p) => {
      const isUp = p.status === 'UP'
      const isDown = p.status === 'DOWN'
      const rt = p.responseTime ?? null

      if (rt != null) lastKnownRt = rt
      if (isUp && rt != null) lastUpRt = rt

      const isDownEnd = isUp && inDown
      if (isDown) inDown = true
      if (isUp) inDown = false

      const downBaseline = lastUpRt ?? lastKnownRt ?? 0

      return {
        ...p,
        rtUp: isUp ? rt : null,
        rtDown: isDown ? downBaseline : isDownEnd ? downBaseline : null,
        dotY: isUp ? rt : isDown ? downBaseline : null,
      }
    })
  })()

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
          {downIntervals.map((it) => (
            <ReferenceArea
              key={`${it.start}-${it.end}`}
              x1={it.start}
              x2={it.end}
              fill={DOWN_LINE_STROKE}
              fillOpacity={DOWN_BAND_OPACITY}
              ifOverflow="extendDomain"
            />
          ))}
          <XAxis
            dataKey="checkedAt"
            tickFormatter={formatAxisTime}
            stroke={AXIS_STROKE}
            tick={{ fill: AXIS_STROKE, fontSize: 12 }}
            tickLine={{ stroke: AXIS_STROKE }}
            axisLine={{ stroke: AXIS_STROKE }}
          />
          <YAxis
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
            dataKey="rtUp"
            stroke={LINE_STROKE}
            strokeWidth={2}
            dot={false}
            activeDot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="rtDown"
            stroke={DOWN_LINE_STROKE}
            strokeWidth={1.75}
            strokeDasharray="4 3"
            dot={false}
            activeDot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="dotY"
            stroke="transparent"
            strokeWidth={0}
            dot={renderDot}
            activeDot={{ r: 5 }}
            connectNulls={false}
            isAnimationActive={false}
            legendType="none"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
