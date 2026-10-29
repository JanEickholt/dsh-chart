/**
 * dsh-chart — host half.
 *
 * Registers the show_chart tool: the model passes a small JSON spec (type,
 * labels, values) and gets a canonical confirmation value back, while the web
 * client renders the chart inline in the chat row (see ./client). The spec
 * itself is the artifact — no files are written, no subprocess spawned.
 *
 * @module dsh-chart
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { CHART_TYPES, MAX_POINTS, checkChartSpec } from './chart-spec.ts'

export const name = 'chart'

/** Services required before activation. */
export const inject = ['tools']

/** Structural surface of the harness tool registry (packages/core/tools service 'tools'). */
interface ToolsLike {
  register(definition: unknown): () => void
}

const showChart = defineTool({
  name: 'show_chart',
  description:
    'Render a chart inline in the chat from labeled numeric data. Use whenever the user wants statistics visualized '
    + '(pie for shares of a whole, bar for comparing discrete values, line for a trend over ordered points). '
    + 'Prefer this over ASCII art, tables of raw numbers, or writing image/SVG files.',
  parameters: {
    type: {
      type: 'string',
      enum: [...CHART_TYPES],
      required: true,
      description: `Chart kind. pie: shares of a whole (non-negative values). bar: compare discrete values. line: trend over ordered points. One of: ${CHART_TYPES.join(' | ')}.`,
    },
    title: {
      type: 'string',
      description: 'Short chart title shown above the chart.',
    },
    labels: {
      type: 'array',
      items: { type: 'string' },
      required: true,
      description: `Category labels, aligned with values by index. 1 to ${MAX_POINTS} entries.`,
    },
    values: {
      type: 'array',
      items: { type: 'number' },
      required: true,
      description: 'Numeric values, aligned with labels by index. Finite numbers only.',
    },
    seriesName: {
      type: 'string',
      description: 'Optional name of the data series (shown as a small legend note).',
    },
  },
  output: {
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: [...CHART_TYPES] },
        title: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } },
        values: { type: 'array', items: { type: 'number' } },
        seriesName: { type: 'string' },
      },
      additionalProperties: false,
    },
    render: (_args, value) => {
      // Value-object properties are optional in the inferred type (output
      // schemas cannot mark properties required); the canonical value from
      // execute always carries type/labels/values.
      const count = value.labels?.length ?? 0
      const type = value.type ?? 'chart'
      return [
        { type: 'text' as const, text: `Chart displayed: ${type}${value.title !== undefined ? ` "${value.title}"` : ''} — ${count} ${type === 'pie' ? 'slices' : 'points'}.` },
      ]
    },
  },
  presentCall: (args) => ({
    card: 'generic' as const,
    title: `Chart: ${args.title ?? args.type}`,
  }),
  // presentResult omitted: the generic card keeps the pending title and renders the confirmation text.
  isConcurrencySafe: () => true,
  async execute(args) {
    const checked = checkChartSpec(args)
    if ('error' in checked) throw new Error(`invalid chart spec: ${checked.error}`)
    return checked.spec
  },
})

export function apply(ctx: Context): void {
  const tools = (ctx as unknown as { tools?: ToolsLike }).tools
  if (!tools) return
  ctx.effect(() => tools.register(showChart), 'tools: show_chart')
}
