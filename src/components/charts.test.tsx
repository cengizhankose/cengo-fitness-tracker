import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WeightChart } from '@/components/charts'
import { ProgressScreen } from '@/screens/ProgressScreen'
import { useStore } from '@/store'
import { parseWeightGoal } from '@/lib/derive'
import { plan } from '@/lib/plan'
import type { MetricPoint } from '@/lib/derive'

const GOAL = parseWeightGoal(plan)!

const pts = (...values: number[]): MetricPoint[] =>
  values.map((value, i) => ({ date: `2026-06-${String(i + 1).padStart(2, '0')}`, value }))

const band = (container: HTMLElement) => container.querySelector('.recharts-reference-area')

describe('WeightChart target band', () => {
  it('renders the band when every reading is far above it (the reported bug)', () => {
    const { container } = render(<WeightChart data={pts(93, 91.2, 88.6)} goal={GOAL} />)
    expect(band(container)).not.toBeNull()
  })

  it('renders the band with zero data', () => {
    const { container } = render(<WeightChart data={[]} goal={GOAL} />)
    expect(band(container)).not.toBeNull()
  })

  it('renders the band with a single reading', () => {
    const { container } = render(<WeightChart data={pts(93)} goal={GOAL} />)
    expect(band(container)).not.toBeNull()
  })

  it('omits the band for the degenerate start===target fallback goal', () => {
    const { container } = render(
      <WeightChart data={pts(92)} goal={{ start: 92, targetLow: 92, targetHigh: 92 }} />,
    )
    expect(band(container)).toBeNull()
  })

  it('describes the band and start weight in accessible text', () => {
    render(<WeightChart data={pts(93, 88.6)} goal={GOAL} />)
    const label = screen.getByRole('img').getAttribute('aria-label') ?? ''
    expect(label).toContain('Target band 82–84 kg')
    expect(label).toContain('Start 92 kg')
    expect(label).toContain('93 to 88.6 kg')
  })
})

/** The Weight ChartCard specifically — the Waist card reuses the same empty hint text. */
function weightCard(): HTMLElement {
  const card = screen.getByRole('heading', { name: 'Weight' }).closest('section')
  if (!card) throw new Error('Weight chart card not found')
  return card
}

describe('ProgressScreen weight card', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ checkIns: {}, checklist: {}, runLog: [], strengthLog: [] })
  })

  it('draws the target band instead of suppressing the chart when there is no data', () => {
    render(<MemoryRouter><ProgressScreen /></MemoryRouter>)
    const card = weightCard()

    // The chart is rendered, not replaced by an empty state...
    expect(band(card)).not.toBeNull()
    expect(card.querySelector('.recharts-surface')).not.toBeNull()
    // ...and the hint still guides the user, below the chart rather than over it.
    const hint = within(card).getByText('Log a check-in to start the trend')
    expect(hint.tagName).toBe('P')
    expect(hint.querySelector('svg')).toBeNull()
  })

  it('still draws the band once readings exist far above it', () => {
    useStore.setState({
      checkIns: {
        '2026-06-01': {
          date: '2026-06-01',
          weightKg: 93,
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
        '2026-06-08': {
          date: '2026-06-08',
          weightKg: 88.6,
          createdAt: '2026-06-08T00:00:00.000Z',
          updatedAt: '2026-06-08T00:00:00.000Z',
        },
      },
    })

    render(<MemoryRouter><ProgressScreen /></MemoryRouter>)
    const card = weightCard()
    expect(band(card)).not.toBeNull()
    expect(within(card).queryByText('Log a check-in to start the trend')).toBeNull()
  })
})
