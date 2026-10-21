/**
 * Wire contract for the show_chart tool: the validated spec shared by the
 * host tool (execution + canonical output value) and the client toolview
 * (inline SVG rendering). Pure module — no runtime imports, safe in both the
 * node and browser bundles.
 *
 * @module dsh-chart/chart-spec
 */

export const CHART_TYPES = ['pie', 'bar', 'line'] as const
export type ChartType = (typeof CHART_TYPES)[number]

/**
 * Upper bound on data points. Past this the inline chart degrades; the model
 * should aggregate or summarize instead. Enforced by parseChartSpec.
 */
export const MAX_POINTS = 100

/** Schema-validated tool arguments (the parameters declaration in ./index.ts mirrors this shape). */
export interface ChartToolArgs {
  readonly type: ChartType
  readonly title?: string
  readonly labels: readonly string[]
  readonly values: readonly number[]
  readonly seriesName?: string
}

/**
 * Canonical chart spec — the tool's declared output value and the client's
 * render input. Arrays are mutable: the value schema's inferred type carries
 * mutable arrays and value-object properties cannot be marked required
 * (compileValueSchema: allowRequired: false), so the canonical shape matches
 * the inferred type directly.
 */
export interface ChartSpec {
  readonly type: ChartType
  readonly title?: string
  labels: string[]
  values: number[]
  readonly seriesName?: string
}

function isChartType(type: unknown): type is ChartType {
  return typeof type === 'string' && (CHART_TYPES as readonly string[]).includes(type)
}

/** Build the canonical output value: exact property set, arrays copied. */
export function buildChartSpec(args: ChartToolArgs): ChartSpec {
  const spec: { type: ChartType; title?: string; labels: string[]; values: number[]; seriesName?: string } = {
    type: args.type,
    labels: [...args.labels],
    values: [...args.values],
  }
  if (args.title !== undefined) spec.title = args.title
  if (args.seriesName !== undefined) spec.seriesName = args.seriesName
  return spec
}

/**
 * Validate an arbitrary payload as a chart spec. Single validation authority
 * for both halves: host execute (schema pre-validated args) and client rows
 * (untrusted logged argsRaw).
 */
export function parseChartSpec(raw: unknown): ChartSpec | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  if (!isChartType(record.type)) return null
  if (!Array.isArray(record.labels) || !Array.isArray(record.values)) return null
  const count = record.labels.length
  if (count === 0 || count !== record.values.length || count > MAX_POINTS) return null
  if (!record.labels.every((label): label is string => typeof label === 'string')) return null
  if (!record.values.every((value): value is number => typeof value === 'number' && Number.isFinite(value))) return null
  if (record.title !== undefined && typeof record.title !== 'string') return null
  if (record.seriesName !== undefined && typeof record.seriesName !== 'string') return null
  return buildChartSpec({
    type: record.type,
    labels: record.labels,
    values: record.values,
    ...(record.title !== undefined ? { title: record.title } : {}),
    ...(record.seriesName !== undefined ? { seriesName: record.seriesName } : {}),
  })
}

/** Parse a call's raw JSON argument string; null on malformed JSON. */
export function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Sum of non-negative values — pie renderings need a positive total. */
export function pieTotal(spec: ChartSpec): number {
  return spec.values.reduce((sum, value) => sum + Math.max(value, 0), 0)
}
