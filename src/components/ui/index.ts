/**
 * Cengo Cut UI kit. Screens compose from these only (plus the feature components in
 * `@/components/*`). Chart cards live in `@/components/ui/charts` and may only be
 * imported by lazily loaded screens, so they are not re-exported here.
 */

// Layout
export { Screen } from './Screen'
export type { ScreenProps } from './Screen'
export { Card } from './Card'
export type { CardProps } from './Card'
export { SectionTitle } from './SectionTitle'
export type { SectionTitleProps } from './SectionTitle'
export { Divider } from './Divider'
export type { DividerProps } from './Divider'

// Actions
export { Button } from './Button'
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button'
export { IconButton } from './IconButton'
export type { IconButtonProps, IconButtonVariant } from './IconButton'

// Selection
export { SegmentedControl } from './SegmentedControl'
export type { SegmentedControlProps, SegmentOption } from './SegmentedControl'
export { FilterChips } from './FilterChips'
export type { ChipOption, FilterChipsProps } from './FilterChips'
export { CheckRow } from './CheckRow'
export type { CheckRowProps } from './CheckRow'

// Inputs
export { NumberField } from './NumberField'
export type { NumberFieldProps } from './NumberField'
export { RpePicker } from './RpePicker'
export type { RpePickerProps } from './RpePicker'
export { RPE_SCALE, rpeWord } from './rpe'
export { TextField } from './TextField'
export type { TextFieldProps } from './TextField'
export { TextArea } from './TextArea'
export type { TextAreaProps } from './TextArea'
export { DateField } from './DateField'
export type { DateFieldProps } from './DateField'

// Display
export { Stat } from './Stat'
export type { StatDelta, StatProps } from './Stat'
export { StatGrid } from './StatGrid'
export type { StatGridProps } from './StatGrid'
export { Badge } from './Badge'
export type { BadgeProps } from './Badge'
export { TrendBadge } from './TrendBadge'
export type { Trend, TrendBadgeProps } from './TrendBadge'
export { ProgressBar } from './ProgressBar'
export type { ProgressBarProps } from './ProgressBar'
export { Sparkline } from './Sparkline'
export type { SparklineProps } from './Sparkline'
export { ListRow } from './ListRow'
export type { ListRowProps } from './ListRow'
export { EmptyState } from './EmptyState'
export type { EmptyStateProps } from './EmptyState'
export { Skeleton } from './Skeleton'
export type { SkeletonProps } from './Skeleton'

// Overlays
export { Sheet } from './Sheet'
export type { SheetProps } from './Sheet'
export { ConfirmDialog } from './ConfirmDialog'
export type { ConfirmDialogProps } from './ConfirmDialog'

// Navigation / feedback
export { TabBar } from './TabBar'
export { ToastHost } from './ToastHost'

// Shared
export type { Tone } from './tones'
export { formatDecimal } from './number'
