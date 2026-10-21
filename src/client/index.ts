/**
 * dsh-chart — browser half.
 *
 * Registers the show_chart toolview row (keyed `tool.call.toolview` slot),
 * the end-of-turn chart embed (`conversation.chat.turnTail` list slot), and
 * the plugin's locale namespace. Charts render at the turn tail — after the
 * final assistant message — so they survive collapsed thinking and tool rows;
 * the toolview row keeps a compact per-call summary and shows errors inline.
 *
 * @module dsh-chart/client
 */

import { ChartRow } from './ChartRow.tsx'
import { ChartTail } from './ChartTail.tsx'
import { LOCALE_NS, localeDict } from './locale.ts'

/** Services required before activation. */
export const inject = ['slots', 'locale']

/** Structural surface of the browser slots service (packages/client/ui-slots). */
interface SlotsLike {
  inject(name: string, register: () => unknown): void
  register(entry: {
    readonly name: string
    readonly key?: string
    readonly id?: string
    readonly order?: number
    readonly locale?: string
  }, component: unknown): unknown
}

/** Structural surface of the browser locale service (packages/client/locale). */
interface LocaleLike {
  register(ns: string, dict: { readonly en: Record<string, string>; readonly zh: Record<string, string> }): (() => void) | void
}

interface ClientContextLike {
  get(name: string): unknown
  effect(callback: () => (() => void) | void, label?: string): void
}

export function apply(ctx: ClientContextLike): void {
  const slots = ctx.get('slots') as SlotsLike | undefined
  const locale = ctx.get('locale') as LocaleLike | undefined
  if (slots === undefined || locale === undefined) return
  ctx.effect(() => locale.register(LOCALE_NS, localeDict) ?? undefined, 'locale: dsh-chart')
  slots.inject('tool.call.toolview', () => {
    slots.register({ name: 'tool.call.toolview', key: 'show_chart', locale: LOCALE_NS }, ChartRow)
  })
  slots.inject('conversation.chat.turnTail', () => {
    slots.register({ name: 'conversation.chat.turnTail', id: 'dsh-chart-turn', order: 1, locale: LOCALE_NS }, ChartTail)
  })
}
