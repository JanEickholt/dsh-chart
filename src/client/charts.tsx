/**
 * Recharts-backed chart renderers for the show_chart toolview. The model only
 * emits the JSON spec; every pixel is the library's — deterministic geometry,
 * hover tooltips, and axis auto-thinning. Styling uses DSH design tokens
 * (`--dsw-static-*`) for series and `currentColor` for theme-safe axes.
 *
 * Bundled inline (the client-bundle contract is one self-registering file,
 * no code-split chunks), so the whole lib ships inside lib/client.js.
 *
 * @module dsh-chart/client/charts
 */

import type { ReactNode } from 'react'
import { Bar, BarChart as RechartsBarChart, CartesianGrid, Cell, Legend, Line, LineChart as RechartsLineChart, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ChartSpec } from '../chart-spec.ts'

/** Series palette: static design tokens, cycled by index; visible on light and dark themes. */
const SERIES_COLORS: readonly string[] = [
  'var(--dsw-static-blue-500)',
  'var(--dsw-static-green-500)',
  'var(--dsw-static-amber-500)',
  'var(--dsw-static-deepseek-500)',
  'var(--dsw-static-red-500)',
]

const seriesColor = (index: number): string => SERIES_COLORS[index % SERIES_COLORS.length]!

/** Compact value text: at most 2 decimals, trailing zeros trimmed. */
export function formatValue(value: number): string {
  return String(Math.round(value * 100) / 100)
}

const truncate = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

const CHART_HEIGHT = 220

const axisTick = { fill: 'currentColor', fontSize: 10, opacity: 0.65 } as const
const tooltipStyle = { fontSize: 12 } as const
const legendStyle = { fontSize: 12 } as const

interface Row {
  readonly label: string
  readonly value: number
}

const rowsOf = (spec: ChartSpec): Row[] => spec.labels.map((label, index) => ({ label, value: spec.values[index] ?? 0 }))

const tooltipFormatter = (value: number | string): string => formatValue(Number(value))

interface ChartProps {
  readonly spec: ChartSpec
}

/** Pie: shares of a whole. Negative and zero values are not slices (pie semantics). */
export function PieChart({ spec }: ChartProps): ReactNode {
  const rows = rowsOf(spec).filter((row) => row.value > 0)
  if (rows.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <RechartsPieChart>
        <Pie data={rows} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius="80%" isAnimationActive={false}>
          {rows.map((row, index) => <Cell key={row.label} fill={seriesColor(index)} />)}
        </Pie>
        <Legend wrapperStyle={legendStyle} />
        <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} />
      </RechartsPieChart>
    </ResponsiveContainer>
  )
}

/** Bar: discrete-value comparison. Baseline at zero; negative bars draw downward. */
export function BarChart({ spec }: ChartProps): ReactNode {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <RechartsBarChart data={rowsOf(spec)} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
        <XAxis
          dataKey="label"
          tick={axisTick}
          tickFormatter={(label: string) => truncate(label, 10)}
          axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={axisTick} tickFormatter={tooltipFormatter} axisLine={false} tickLine={false} width={42} />
        <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} />
        <Bar dataKey="value" fill={seriesColor(0)} maxBarSize={48} radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

/** Line: trend over ordered points. Y domain auto-scales. */
export function LineChart({ spec }: ChartProps): ReactNode {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <RechartsLineChart data={rowsOf(spec)} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
        <XAxis
          dataKey="label"
          tick={axisTick}
          tickFormatter={(label: string) => truncate(label, 10)}
          axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={axisTick} tickFormatter={tooltipFormatter} axisLine={false} tickLine={false} width={42} />
        <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} />
        <Line dataKey="value" type="monotone" stroke={seriesColor(0)} strokeWidth={2} dot={{ r: 2.5, fill: seriesColor(0) }} isAnimationActive={false} />
      </RechartsLineChart>
    </ResponsiveContainer>
  )
}

const cellBorderStyle = '1px solid color-mix(in srgb, currentColor 12%, transparent)'
const headCellStyle = { textAlign: 'left', padding: '2px 8px', fontWeight: 500, borderBottom: '1px solid color-mix(in srgb, currentColor 25%, transparent)' } as const
const cellStyle = { padding: '2px 8px', borderBottom: cellBorderStyle } as const

/** Raw data as a table: accessibility + fallback view of the same spec. */
export function DataTable({ spec, labelHead, valueHead }: ChartProps & { readonly labelHead: string; readonly valueHead: string }): ReactNode {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, marginTop: 8 }}>
      <thead>
        <tr>
          <th style={headCellStyle}>{labelHead}</th>
          <th style={headCellStyle}>{valueHead}</th>
        </tr>
      </thead>
      <tbody>
        {spec.labels.map((label, index) => (
          <tr key={index}>
            <td style={cellStyle}>{label}</td>
            <td style={cellStyle}>{formatValue(spec.values[index] ?? 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
