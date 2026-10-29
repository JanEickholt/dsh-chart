/**
 * Recharts-backed chart renderers for the show_chart toolview. The model only
 * emits the JSON spec; every pixel is the library's — deterministic geometry,
 * hover tooltips, and axis auto-thinning. Series use the fixed categorical
 * palette from ../chart-spec.ts, validated against both the light and dark
 * chat surfaces (it replaces the DSH static tokens, whose blue-500 and
 * deepseek-500 are ΔE 3.6 apart and met as neighbouring slices); axes use
 * `currentColor` and the tooltip DSH alias tokens (`--dsw-alias-*`) so text
 * stays readable in either theme.
 *
 * Bundled inline (the client-bundle contract is one self-registering file,
 * no code-split chunks), so the whole lib ships inside lib/client.js.
 *
 * @module dsh-chart/client/charts
 */

import type { ReactNode } from 'react'
import { Bar, BarChart as RechartsBarChart, CartesianGrid, Cell, Line, LineChart as RechartsLineChart, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ellipsize, formatTick, formatValue, OTHER_COLOR, SERIES_COLORS, sliceColor, TEXT_LIMITS, type ChartSpec, type PieSlice } from '../chart-spec.ts'

/** Single-series bar and line color: palette slot 1. */
const seriesColor = SERIES_COLORS[0]!

const CHART_HEIGHT = 220

const axisTick = { fill: 'currentColor', fontSize: 10, opacity: 0.65 } as const
// recharts defaults the tooltip box to #fff while its label inherits the chat's
// text color, which leaves the label invisible on the dark theme.
const tooltipStyle = {
  fontSize: 12,
  backgroundColor: 'var(--dsw-alias-bg-layer-1, #fff)',
  border: '1px solid var(--dsw-alias-border-l2, #ccc)',
  color: 'var(--dsw-alias-label-primary, inherit)',
  // Labels are shown in full here (axis and legend ellipsize them), so wrap
  // long ones instead of recharts' default nowrap box.
  whiteSpace: 'normal',
  maxWidth: 320,
  overflowWrap: 'anywhere',
} as const
// Item rows default to the entry color, and pie entries carry none, so recharts
// falls back to #000: unreadable on the dark theme. Text wears the text token.
const tooltipItemStyle = { color: 'var(--dsw-alias-label-primary, inherit)' } as const
// The default bar hover cursor is a solid #ccc block, glaring on the dark theme.
const barCursor = { fill: 'currentColor', fillOpacity: 0.08 } as const
const legendStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '2px 12px',
  margin: '4px 0 0',
  padding: 0,
  listStyle: 'none',
  fontSize: 12,
} as const
const legendItemStyle = { display: 'inline-flex', alignItems: 'center', gap: 4 } as const
const swatchStyle = { width: 10, height: 10, borderRadius: 2, flex: 'none' } as const
const axisLabel = (label: string): string => ellipsize(label, TEXT_LIMITS.axis)

interface Row {
  readonly label: string
  readonly value: number
}

const rowsOf = (spec: ChartSpec): Row[] => spec.labels.map((label, index) => ({ label, value: spec.values[index] ?? 0 }))

const tooltipFormatter = (value: number | string): string => formatValue(Number(value))
const tickFormatter = (value: number | string): string => formatTick(Number(value))

interface ChartProps {
  readonly spec: ChartSpec
}

/** Fill of pie slice `index`: palette slots, neutral grey for the folded "Other" slice. */
const sliceFill = (slices: readonly PieSlice[], index: number): string =>
  slices[index]!.folded !== undefined ? OTHER_COLOR : sliceColor(index, slices.length)

/**
 * Pie: shares of a whole, drawn from {@link pieSlices} (positive values,
 * at most MAX_SLICES with the smallest folded into "Other"). The legend is
 * HTML below the plot rather than recharts' in-SVG legend, which took its
 * height out of the fixed chart box and shrank the pie as entries wrapped.
 */
export function PieChart({ slices }: { readonly slices: readonly PieSlice[] }): ReactNode {
  if (slices.length === 0) return null
  return (
    <div>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <RechartsPieChart>
          <Pie data={[...slices]} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius="90%" stroke="var(--dsw-alias-bg-base, #fff)" isAnimationActive={false}>
            {/* Keyed by position: models do repeat labels (e.g. "1/3", "1/6", "1/6", "1/3"). */}
            {slices.map((_slice, index) => <Cell key={index} fill={sliceFill(slices, index)} />)}
          </Pie>
          <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
        </RechartsPieChart>
      </ResponsiveContainer>
      <ul style={legendStyle}>
        {slices.map((slice, index) => {
          const shown = ellipsize(slice.label, TEXT_LIMITS.legend)
          return (
            <li key={index} style={legendItemStyle} title={shown === slice.label ? undefined : slice.label}>
              <span aria-hidden style={{ ...swatchStyle, background: sliceFill(slices, index) }} />
              {shown}
            </li>
          )
        })}
      </ul>
    </div>
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
          tickFormatter={axisLabel}
          axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={axisTick} tickFormatter={tickFormatter} axisLine={false} tickLine={false} width={42} />
        <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} cursor={barCursor} />
        <Bar dataKey="value" fill={seriesColor} maxBarSize={48} radius={[2, 2, 0, 0]} isAnimationActive={false} />
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
          tickFormatter={axisLabel}
          axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={axisTick} tickFormatter={tickFormatter} axisLine={false} tickLine={false} width={42} />
        <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
        <Line dataKey="value" type="monotone" stroke={seriesColor} strokeWidth={2} dot={{ r: 2.5, fill: seriesColor }} isAnimationActive={false} />
      </RechartsLineChart>
    </ResponsiveContainer>
  )
}

const cellBorderStyle = '1px solid color-mix(in srgb, currentColor 12%, transparent)'
const headCellStyle = { textAlign: 'left', padding: '2px 8px', fontWeight: 500, borderBottom: '1px solid color-mix(in srgb, currentColor 25%, transparent)' } as const
const cellStyle = { padding: '2px 8px', borderBottom: cellBorderStyle, overflowWrap: 'anywhere' } as const

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
