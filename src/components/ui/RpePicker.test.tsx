import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { checkA11y } from '@/test/axe'
import { RpePicker } from './RpePicker'

function Harness({ initial, onValue }: { initial?: number; onValue?: (v: number | undefined) => void }) {
  const [value, setValue] = useState<number | undefined>(initial)
  return (
    <RpePicker
      value={value}
      onChange={(v) => {
        setValue(v)
        onValue?.(v)
      }}
    />
  )
}

const radio = (n: number) => screen.getByRole('radio', { name: new RegExp(`^RPE ${n},`) })
const checked = () => screen.queryAllByRole('radio', { checked: true })

describe('RpePicker', () => {
  it('offers 6–10 with a Turkish word each', () => {
    render(<Harness />)
    expect(screen.getByRole('radiogroup', { name: 'Efor (RPE)' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      'RPE 6, çok kolay',
      'RPE 7, kolay',
      'RPE 8, orta',
      'RPE 9, zor',
      'RPE 10, tükeniş',
    ])
  })

  it('selects on tap and clears when the selected chip is tapped again', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness onValue={onValue} />)
    await user.click(radio(8))
    expect(onValue).toHaveBeenLastCalledWith(8)
    expect(radio(8)).toBeChecked()
    await user.click(radio(9))
    expect(checked()).toEqual([radio(9)])
    await user.click(radio(9))
    expect(onValue).toHaveBeenLastCalledWith(undefined)
    expect(checked()).toHaveLength(0)
  })

  it('has a single tab stop on the selected chip (first chip when empty)', () => {
    const { unmount } = render(<Harness />)
    expect(radio(6)).toHaveAttribute('tabindex', '0')
    expect(radio(7)).toHaveAttribute('tabindex', '-1')
    unmount()
    render(<Harness initial={9} />)
    expect(radio(9)).toHaveAttribute('tabindex', '0')
    expect(radio(6)).toHaveAttribute('tabindex', '-1')
  })

  it('moves the selection with arrow keys, Home/End, wraps, and clears with Delete', async () => {
    const user = userEvent.setup()
    render(<Harness initial={8} />)
    await user.tab()
    expect(radio(8)).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(radio(9)).toBeChecked()
    expect(radio(9)).toHaveFocus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(radio(7)).toBeChecked()
    await user.keyboard('{End}')
    expect(radio(10)).toBeChecked()
    await user.keyboard('{ArrowRight}')
    expect(radio(6)).toBeChecked()
    await user.keyboard('{ArrowLeft}')
    expect(radio(10)).toBeChecked()
    await user.keyboard('{Home}')
    expect(radio(6)).toBeChecked()
    await user.keyboard('{Delete}')
    expect(checked()).toHaveLength(0)
  })

  it('has no a11y violations', async () => {
    const { container } = render(<Harness initial={7} />)
    expect(await checkA11y(container)).toHaveNoViolations()
  })
})
