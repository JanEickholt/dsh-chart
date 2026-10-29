/**
 * End-of-turn chart embed: renders this turn's successful show_chart specs at
 * the turn tail — after the final assistant message — so charts stay visible
 * when thinking rows and tool calls above collapse. Failed and invalid calls
 * stay in their tool rows (see ChartRow).
 *
 * @module dsh-chart/client/ChartTail
 */

import { memo, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { parseChartSpec, pieTotal, safeParse, type ChartSpec } from '../chart-spec.ts'
import { BarChart, DataTable, LineChart, PieChart } from './charts.tsx'
import type { ChartLocaleKey } from './locale.ts'

type Translate = (key: ChartLocaleKey, params?: Record<string, string | number>) => string

/** Identity-stable observable over one Turn's data (dsh-client-store ObservableSnapshot). */
interface TurnDataSourceLike {
  readonly getSnapshot: () => readonly ToolChatDataLike[]
  readonly subscribe: (listener: () => void) => () => void
}
/** Structural snapshot seats; see dsh-client-ui-chat contract (ChatSnapshot / ChatNodeStore). */
interface ChatSnapshotLike {
  readonly nodes: {
    readonly turnDataSource?: (turn: number, kind: 'tool-call') => TurnDataSourceLike
  }
}
/** ToolChatData: payload of one `tool-call` Chat node. */
interface ToolChatDataLike {
  readonly root?: unknown
}
/** TurnLocation from dsh-client-ui-conversation; only the turn ordinal is read. */
interface TurnLocationLike {
  readonly turn: number
}
type UseChatLike = <T>(select: (snapshot: ChatSnapshotLike) => T) => T

/** Tool-call node roots across phases — same shapes the toolview row sees. */
function readCall(root: object): readonly [name: string | undefined, argsRaw: string | undefined, isError: boolean] {
  const record = root as {
    readonly kind?: unknown
    readonly call?: { readonly name?: unknown; readonly argsRaw?: unknown } | null
    readonly isError?: unknown
    readonly name?: unknown
    readonly argsRaw?: unknown
  }
  if (record.kind === 'tool-result') {
    return [
      typeof record.call?.name === 'string' ? record.call.name : undefined,
      typeof record.call?.argsRaw === 'string' ? record.call.argsRaw : undefined,
      record.isError === true,
    ]
  }
  return [
    typeof record.name === 'string' ? record.name : undefined,
    typeof record.argsRaw === 'string' ? record.argsRaw : undefined,
    false,
  ]
}

/** One charted call: its raw args (identity for reuse) and the parsed spec. */
interface ChartEntry {
  readonly argsRaw: string
  readonly spec: ChartSpec
}

/**
 * Collect valid show_chart calls from a call tree (root first, then PTC
 * sub-calls). `reuse` maps raw args to the spec parsed on a previous pass so
 * unchanged calls keep their spec identity and memoized charts skip redraws.
 */
function collectCharts(block: unknown, found: ChartEntry[], reuse: ReadonlyMap<string, ChartSpec>): void {
  if (block === null || typeof block !== 'object') return
  const [name, argsRaw, isError] = readCall(block)
  if (name === 'show_chart' && !isError && typeof argsRaw === 'string') {
    const spec = reuse.get(argsRaw) ?? parseChartSpec(safeParse(argsRaw))
    if (spec !== null) found.push({ argsRaw, spec })
  }
  const subCalls = (block as { readonly subCalls?: unknown }).subCalls
  if (Array.isArray(subCalls)) for (const child of subCalls) collectCharts(child, found, reuse)
}

/** Every valid show_chart call in this turn's tool-call nodes, in call order. */
function turnCharts(calls: readonly ToolChatDataLike[], reuse: ReadonlyMap<string, ChartSpec>): ChartEntry[] {
  const found: ChartEntry[] = []
  for (const call of calls) collectCharts(call.root, found, reuse)
  return found
}

const EMPTY_CALLS: readonly ToolChatDataLike[] = []
const EMPTY_SOURCE: TurnDataSourceLike = { getSnapshot: () => EMPTY_CALLS, subscribe: () => () => {} }

const dataToggleStyle = {
  background: 'none',
  border: 'none',
  padding: '2px 0',
  marginTop: 8,
  fontSize: 11,
  color: 'inherit',
  opacity: 0.6,
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
} as const

const ChartTailEntry = memo(function ChartTailEntry({ spec, t }: { readonly spec: ChartSpec; readonly t: Translate }): ReactNode {
  const [tableOpen, setTableOpen] = useState(false)
  return (
    <div style={{ padding: '10px 2px 4px', maxWidth: 640 }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{spec.title !== undefined ? spec.title : t('row.title')}</div>
      {spec.seriesName !== undefined && <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>{spec.seriesName}</div>}
      {spec.type === 'pie'
        ? (pieTotal(spec) > 0 ? <PieChart spec={spec} /> : <p style={{ fontSize: 13 }}>{t('row.empty')}</p>)
        : spec.type === 'bar' ? <BarChart spec={spec} /> : <LineChart spec={spec} />}
      <button type="button" style={dataToggleStyle} aria-expanded={tableOpen} onClick={() => { setTableOpen(!tableOpen) }}>{t('row.data')}</button>
      {tableOpen && <DataTable spec={spec} labelHead={t('row.label')} valueHead={spec.seriesName ?? t('row.value')} />}
    </div>
  )
})

export interface ChartTailProps {
  /** Owning Turn; the turn ordinal inside keys the Location index. */
  readonly turn: TurnLocationLike
  /** Remount key advanced by the framework; unused. */
  readonly seq: number
  readonly openFile: (path: string) => void
  /** Standard session selector hook over the conversation snapshot. */
  readonly useChat: UseChatLike
  readonly t: Translate
}

export function ChartTail(props: ChartTailProps): ReactNode {
  const { turn, useChat, t } = props
  // Subscribe to this Turn's tool-call data only. The Chat snapshot object is
  // republished on every store mutation (each streamed delta), so selecting it
  // whole re-rendered every completed Turn's charts while a later Turn
  // streamed. `nodes` and its per-(turn, kind) sources are identity-stable,
  // and a source's array changes only when one of its members does.
  const source = useChat((s) => s.nodes.turnDataSource?.(turn.turn, 'tool-call') ?? EMPTY_SOURCE)
  const calls = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot)
  const charts = useTurnCharts(calls)
  if (charts.length === 0) return null
  return (
    <div>
      {charts.map((chart, index) => <ChartTailEntry key={index} spec={chart.spec} t={t} />)}
    </div>
  )
}

/**
 * Parse the Turn's charts, reusing the previous pass's spec objects for calls
 * whose raw args are unchanged: another call in the same Turn settling must
 * not hand the memoized entries fresh specs and redraw every chart.
 */
function useTurnCharts(calls: readonly ToolChatDataLike[]): readonly ChartEntry[] {
  const previous = useRef<ReadonlyMap<string, ChartSpec>>(new Map())
  return useMemo(() => {
    const charts = turnCharts(calls, previous.current)
    previous.current = new Map(charts.map((chart) => [chart.argsRaw, chart.spec]))
    return charts
  }, [calls])
}
