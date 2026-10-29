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
 * (untrusted logged argsRaw). Failures name the first violated constraint so
 * the model can repair its call.
 */
export function checkChartSpec(raw: unknown): { readonly spec: ChartSpec } | { readonly error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { error: 'arguments must be a JSON object' }
  const record = raw as Record<string, unknown>
  if (!isChartType(record.type)) return { error: `type must be one of ${CHART_TYPES.join(' | ')}` }
  if (!Array.isArray(record.labels)) return { error: 'labels must be an array of strings' }
  if (!Array.isArray(record.values)) return { error: 'values must be an array of numbers' }
  const count = record.labels.length
  if (count === 0) return { error: 'labels and values must not be empty' }
  if (count !== record.values.length) {
    return { error: `labels has ${count} entries but values has ${record.values.length}; they must align by index` }
  }
  if (count > MAX_POINTS) return { error: `${count} points exceed the limit of ${MAX_POINTS}; aggregate the data first` }
  const badLabel = record.labels.findIndex((label) => typeof label !== 'string')
  if (badLabel !== -1) return { error: `labels[${badLabel}] must be a string` }
  const badValue = record.values.findIndex((value) => typeof value !== 'number' || !Number.isFinite(value))
  if (badValue !== -1) return { error: `values[${badValue}] must be a finite number` }
  if (record.title !== undefined && typeof record.title !== 'string') return { error: 'title must be a string' }
  if (record.seriesName !== undefined && typeof record.seriesName !== 'string') return { error: 'seriesName must be a string' }
  return {
    spec: buildChartSpec({
      type: record.type,
      labels: record.labels as string[],
      values: record.values as number[],
      ...(record.title !== undefined ? { title: record.title } : {}),
      ...(record.seriesName !== undefined ? { seriesName: record.seriesName } : {}),
    }),
  }
}

/** {@link checkChartSpec} without the reason: the spec, or null when invalid. */
export function parseChartSpec(raw: unknown): ChartSpec | null {
  const checked = checkChartSpec(raw)
  return 'spec' in checked ? checked.spec : null
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

/**
 * Compact value text. Magnitudes of 1 and above keep at most 2 decimals;
 * smaller magnitudes keep 3 significant digits so 0.014 does not collapse to
 * 0.01 (or 0.004 to 0). Trailing zeros are trimmed.
 */
export function formatValue(value: number): string {
  if (Math.abs(value) >= 1 || value === 0) return String(Math.round(value * 100) / 100)
  return String(Number(value.toPrecision(3)))
}

const compactFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

/** Axis tick text: thousands and up in compact notation (12.5K, 3M) so ticks fit the narrow axis. */
export function formatTick(value: number): string {
  return Math.abs(value) >= 1000 ? compactFormat.format(value) : formatValue(value)
}

/**
 * Categorical series palette in fixed order: blue, orange, aqua, yellow,
 * magenta, green, violet, red. Validated as adjacent pairs for both chat
 * surfaces (#fff light, #151517 dark): every slot inside the lightness band
 * and >= 3:1 against the surface, worst adjacent colour-vision-deficiency
 * ΔE 8.4 and normal-vision ΔE 19.3 (OKLab ×100).
 */
export const SERIES_COLORS: readonly string[] = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
]

/**
 * Slot for the last slice when plain cycling would make it clash with the
 * first slice it touches: slot 0 (blue again) or slot 6 (violet, ΔE 1.9
 * from blue under protanopia). The substitutes also clear the floors against
 * the preceding slice (red for slot 0's case, green for slot 6's).
 */
const WRAP_SUBSTITUTE: Readonly<Record<number, number>> = { 0: 5, 6: 7 }

/**
 * Colour of slice `index` of a `count`-slice pie: slots cycle in fixed order,
 * and the last slice, which closes the ring next to slice 0, avoids colours
 * indistinguishable from slice 0's.
 */
export function sliceColor(index: number, count: number): string {
  const slot = index % SERIES_COLORS.length
  const last = count > 1 && index === count - 1
  return SERIES_COLORS[last ? WRAP_SUBSTITUTE[slot] ?? slot : slot]!
}
