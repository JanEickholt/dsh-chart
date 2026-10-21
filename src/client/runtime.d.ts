/**
 * Ambient declarations for the browser platform modules the client half
 * consumes. They are externals resolved through the module table at runtime
 * and ship no installable types; declare only what we use.
 */

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ComponentType, ReactNode } from 'react'

  export interface DisclosureRowProps {
    readonly icon?: ReactNode
    readonly title: string
    readonly open: boolean
    readonly expandable: boolean
    readonly onToggle: () => void
    readonly running?: boolean
    readonly expandOnRowClick?: boolean
    readonly previewChevron?: boolean
    readonly keepContentWhenOpen?: boolean
    readonly collapsedContent?: ReactNode
    readonly headerAccessory?: ReactNode
    readonly children?: ReactNode
    readonly className?: string
    readonly rowClassName?: string
    readonly contentClassName?: string
    readonly contentLayoutClassName?: string
    readonly leadingClassName?: string
    readonly chevronClassName?: string
    readonly titleClassName?: string
  }

  export const DisclosureRow: ComponentType<DisclosureRowProps>

  export const IconDataOutlineRegular: ComponentType<{
    readonly className?: string
    readonly size?: number
  }>
}
