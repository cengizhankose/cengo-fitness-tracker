/**
 * Recharts-based chart cards. Import ONLY from lazily loaded screens
 * (`@/components/ui/charts`) so recharts stays out of the initial bundle; they are
 * deliberately not re-exported from the `@/components/ui` barrel.
 */
export { LineChartCard } from './LineChartCard'
export type { LineChartCardProps, LinePoint, GoalBand, GoalLine } from './LineChartCard'
export { BarChartCard } from './BarChartCard'
export type { BarChartCardProps, BarPoint } from './BarChartCard'
