/**
 * End-of-turn chart embed: renders this turn's successful show_chart specs at
 * the turn tail — after the final assistant message — so charts stay visible
 * when thinking rows and tool calls above collapse. Failed and invalid calls
 * stay in their tool rows (see ChartRow).
 *
 * @module dsh-chart/client/ChartTail
 */

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { parseChartSpec, pieTotal, safeParse, type ChartSpec } from '../chart-spec.ts'
import { BarChart, DataTable, LineChart, PieChart } from './charts.tsx'
import type { ChartLocaleKey } from './locale.ts'

type Translate = (key: ChartLocaleKey, params?: Record<string, string | number>) => string

/** Structural snapshot seats; see dsh-client-ui-chat contract + node views. */
interface ChatSnapshotLike {
  readonly locations: { readonly getTurn: (turn: number) => readonly string[] }
  readonly nodes: { readonly get: (key: string) => NodeLike | undefined }
}
interface NodeLike {
  readonly kind?: string
  readonly data?: { readonly root?: unknown }
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

/** Every valid show_chart spec in this turn, in call order. */
function turnChartSpecs(snapshot: ChatSnapshotLike, turn: TurnLocationLike): ChartSpec[] {
  const found: ChartSpec[] = []
  for (const key of snapshot.locations.getTurn(turn.turn)) {
    const node = snapshot.nodes.get(key)
    if (node === undefined || node.kind !== 'tool-call') continue
    const root = node.data?.root
    if (root === null || typeof root !== 'object') continue
    const [name, argsRaw, isError] = readCall(root)
    if (name !== 'show_chart' || isError || typeof argsRaw !== 'string') continue
    const spec = parseChartSpec(safeParse(argsRaw))
    if (spec !== null) found.push(spec)
  }
  return found
}

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

function ChartTailEntry({ spec, t }: { readonly spec: ChartSpec; readonly t: Translate }): ReactNode {
  const [tableOpen, setTableOpen] = useState(false)
  return (
    <div style={{ padding: '10px 2px 4px', maxWidth: 640 }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{spec.title !== undefined ? spec.title : t('row.title')}</div>
      {spec.seriesName !== undefined && <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>{spec.seriesName}</div>}
      {spec.type === 'pie'
        ? (pieTotal(spec) > 0 ? <PieChart spec={spec} /> : <p style={{ fontSize: 13 }}>{t('row.empty')}</p>)
        : spec.type === 'bar' ? <BarChart spec={spec} /> : <LineChart spec={spec} />}
      <button type="button" style={dataToggleStyle} onClick={() => { setTableOpen(!tableOpen) }}>{t('row.data')}</button>
      {tableOpen && <DataTable spec={spec} labelHead={t('row.label')} valueHead={spec.seriesName ?? t('row.value')} />}
    </div>
  )
}

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
  // Selectors must return identity-stable values: useSyncExternalStore loops
  // forever when getSnapshot builds a fresh array each call. Select the
  // snapshot itself (stable between store mutations) and derive with useMemo.
  const snapshot = useChat((s) => s)
  const specs = useMemo(() => turnChartSpecs(snapshot, turn), [snapshot, turn])
  if (specs.length === 0) return null
  return (
    <div>
      {specs.map((spec, index) => <ChartTailEntry key={index} spec={spec} t={t} />)}
    </div>
  )
}
