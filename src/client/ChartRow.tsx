/**
 * show_chart toolview row: a compact, static summary of the call. The chart
 * itself renders at the turn tail (ChartTail) so it survives collapsed
 * thinking and tool rows; this row keeps the call's place in the stream.
 * Failed calls auto-open with their error text — the tail skips errors.
 *
 * The row parses the COMPLETE raw args (start phase / result call), never a
 * streaming prefix, so half-written payloads cannot flash an error; malformed
 * specs degrade to the tool name.
 *
 * @module dsh-chart/client/ChartRow
 */

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { DisclosureRow, IconDataOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { ellipsize, parseChartSpec, pieSlices, safeParse, TEXT_LIMITS } from '../chart-spec.ts'
import type { ChartLocaleKey } from './locale.ts'

type Translate = (key: ChartLocaleKey, params?: Record<string, string | number>) => string

/** Structural seats; see ui-chat slot contract + ui-conversation records. */
type UseDisclosure = () => {
  readonly expanded: boolean
  readonly setExpanded: (open: boolean) => void
  readonly toggle: () => void
}

type ContentBlockLike = { readonly type: string; readonly text?: string }

interface PreparingBlock { readonly phase: 'preparing' }
interface StartedBlock { readonly phase: 'start'; readonly argsRaw: string }
interface ResultBlock {
  readonly kind: 'tool-result'
  readonly call: { readonly argsRaw: string } | null
  readonly content: readonly ContentBlockLike[]
  readonly isError: boolean
}
type ChartBlock = PreparingBlock | StartedBlock | ResultBlock

export interface ChartRowProps {
  readonly useDisclosure: UseDisclosure
  readonly callId: string
  readonly toolName: string
  readonly block: ChartBlock
  readonly t: Translate
}

function textOf(content: readonly ContentBlockLike[]): string {
  return content
    .filter((block): block is ContentBlockLike & { readonly text: string } => typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}

export function ChartRow(props: ChartRowProps): ReactNode {
  const { useDisclosure, toolName, block, t } = props
  const { expanded, setExpanded, toggle } = useDisclosure()
  const userCollapsed = useRef(false)

  const started = 'phase' in block && block.phase === 'start' ? block : null
  const result = 'phase' in block ? null : block
  const preparing = 'phase' in block && block.phase === 'preparing'

  const argsRaw = started !== null
    ? started.argsRaw
    : result !== null && result.call !== null ? result.call.argsRaw : null
  const spec = argsRaw !== null ? parseChartSpec(safeParse(argsRaw)) : null
  const errorText = result !== null && result.isError ? textOf(result.content) || t('row.error') : null
  const failed = errorText !== null

  // Failed calls stay readable: keep them open across enclosing-Turn resets
  // (useDisclosure pins open state to the reset version captured by
  // setExpanded, so every version advance collapses the row) until the user
  // collapses them manually. Success rows are static summaries.
  useEffect(() => {
    if (failed && !userCollapsed.current && !expanded) setExpanded(true)
  }, [failed, expanded, setExpanded])

  const onToggle = (): void => {
    if (expanded) userCollapsed.current = true
    toggle()
  }

  const title = spec !== null && spec.title !== undefined ? ellipsize(spec.title, TEXT_LIMITS.row) : t('row.title')
  // A pie counts the slices it draws: positive values, folded past MAX_SLICES.
  const drawnSlices = spec !== null && spec.type === 'pie' ? pieSlices(spec).slices.length : 0
  const summary = preparing
    ? t('row.preparing')
    : spec !== null
      ? spec.type === 'pie'
        ? drawnSlices > 0 ? t('row.slices', { count: drawnSlices }) : t('row.empty')
        : t('row.summary', { type: spec.type, count: spec.labels.length })
      : failed ? t('row.error') : toolName

  return (
    <DisclosureRow
      icon={<IconDataOutlineRegular size={16} />}
      title={title}
      open={failed ? expanded : false}
      expandable={failed && !preparing}
      onToggle={onToggle}
      collapsedContent={<span style={{ opacity: 0.65 }}>{summary}</span>}
    >
      {failed ? <p style={{ margin: '4px 0 8px', fontSize: 13 }}>{errorText}</p> : null}
    </DisclosureRow>
  )
}
