import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { checkA11y } from '@/test/axe'
import { SegmentedControl } from './SegmentedControl'

type Range = 'week' | 'month' | 'all'
const OPTIONS = [
  { value: 'week', label: 'Hafta' },
  { value: 'month', label: 'Ay' },
  { value: 'all', label: 'Tümü' },
] as const

function Harness() {
  const [value, setValue] = useState<Range>('week')
  return <SegmentedControl label="Aralık" options={OPTIONS} value={value} onChange={setValue} />
}

const seg = (name: string) => screen.getByRole('radio', { name })

describe('SegmentedControl', () => {
  it('selects on click', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(seg('Hafta')).toBeChecked()
    await user.click(seg('Ay'))
    expect(seg('Ay')).toBeChecked()
    expect(seg('Hafta')).not.toBeChecked()
  })

  it('is one tab stop; arrows move selection and focus with wrap-around', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.tab()
    expect(seg('Hafta')).toHaveFocus()
    expect(seg('Ay')).toHaveAttribute('tabindex', '-1')
    await user.keyboard('{ArrowRight}')
    expect(seg('Ay')).toBeChecked()
    expect(seg('Ay')).toHaveFocus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(seg('Hafta')).toBeChecked()
    await user.keyboard('{ArrowUp}')
    expect(seg('Tümü')).toBeChecked()
    await user.keyboard('{Home}')
    expect(seg('Hafta')).toBeChecked()
    await user.keyboard('{End}')
    expect(seg('Tümü')).toBeChecked()
    expect(seg('Tümü')).toHaveFocus()
  })

  it('has no a11y violations', async () => {
    const { container } = render(<Harness />)
    expect(await checkA11y(container)).toHaveNoViolations()
  })
})
