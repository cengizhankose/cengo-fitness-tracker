import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { checkA11y } from '@/test/axe'
import { NumberField } from './NumberField'
import type { NumberFieldProps } from './NumberField'

type HarnessProps = Omit<NumberFieldProps, 'label' | 'value' | 'onChange'> & {
  initial: number | ''
  onValue?: (v: number | '') => void
}

function Harness({ initial, onValue, ...props }: HarnessProps) {
  const [value, setValue] = useState<number | ''>(initial)
  return (
    <NumberField
      label="Ağırlık"
      unit="kg"
      value={value}
      onChange={(v) => {
        setValue(v)
        onValue?.(v)
      }}
      {...props}
    />
  )
}

const input = () => screen.getByRole('textbox', { name: 'Ağırlık' })
const plus = () => screen.getByRole('button', { name: 'Ağırlık artır' })
const minus = () => screen.getByRole('button', { name: 'Ağırlık azalt' })

describe('NumberField', () => {
  it('steps by `step` in both directions', async () => {
    const user = userEvent.setup()
    render(<Harness initial={20} step={2.5} />)
    await user.click(plus())
    expect(input()).toHaveValue('22,5')
    await user.click(minus())
    await user.click(minus())
    expect(input()).toHaveValue('17,5')
  })

  it('stops at max and disables +', async () => {
    const user = userEvent.setup()
    render(<Harness initial={99} step={2.5} max={100} />)
    await user.click(plus())
    expect(input()).toHaveValue('100')
    expect(plus()).toBeDisabled()
  })

  it('stops at min and disables −', async () => {
    const user = userEvent.setup()
    render(<Harness initial={1} step={2.5} min={0} />)
    await user.click(minus())
    expect(input()).toHaveValue('0')
    expect(minus()).toBeDisabled()
  })

  it('steps up from an empty value starting at min', async () => {
    const user = userEvent.setup()
    render(<Harness initial="" step={2.5} />)
    expect(input()).toHaveValue('')
    await user.click(plus())
    expect(input()).toHaveValue('2,5')
  })

  it('avoids floating-point noise', async () => {
    const user = userEvent.setup()
    render(<Harness initial={0.1} step={0.2} />)
    await user.click(plus())
    expect(input()).toHaveValue('0,3')
  })

  it('accepts a decimal typed with a comma', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness initial={20} onValue={onValue} />)
    await user.clear(input())
    await user.type(input(), '22,5')
    expect(onValue).toHaveBeenLastCalledWith(22.5)
    expect(input()).toHaveValue('22,5')
  })

  it('accepts a decimal typed with a dot and shows it with a comma after blur', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness initial={20} onValue={onValue} />)
    await user.clear(input())
    await user.type(input(), '22.5')
    expect(onValue).toHaveBeenLastCalledWith(22.5)
    await user.tab()
    expect(input()).toHaveValue('22,5')
  })

  it('reports an empty value when cleared', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness initial={60} onValue={onValue} />)
    await user.clear(input())
    expect(onValue).toHaveBeenLastCalledWith('')
    await user.tab()
    expect(input()).toHaveValue('')
  })

  it('ignores non-numeric characters', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness initial={60} onValue={onValue} />)
    await user.type(input(), 'x')
    expect(onValue).not.toHaveBeenCalled()
    expect(input()).toHaveValue('60')
  })

  it('clamps a typed value above max on blur', async () => {
    const user = userEvent.setup()
    render(<Harness initial={60} max={100} />)
    await user.clear(input())
    await user.type(input(), '150')
    await user.tab()
    expect(input()).toHaveValue('100')
  })

  it('repeats while a stepper is held and stops on release', () => {
    vi.useFakeTimers()
    render(<Harness initial={20} step={2.5} />)
    fireEvent.pointerDown(plus())
    expect(input()).toHaveValue('22,5')
    act(() => {
      vi.advanceTimersByTime(400 + 90 * 3)
    })
    expect(input()).toHaveValue('30')
    fireEvent.pointerUp(plus())
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(input()).toHaveValue('30')
  })

  it('shows the last-time hint and links it to the input', () => {
    render(<Harness initial={60} lastTime="60 kg × 10" />)
    expect(screen.getByText('60 kg × 10')).toBeInTheDocument()
    expect(input()).toHaveAccessibleDescription('Geçen sefer: 60 kg × 10')
  })

  it('has no a11y violations', async () => {
    const { container } = render(<Harness initial={60} lastTime="60 kg × 10" />)
    expect(await checkA11y(container)).toHaveNoViolations()
  })
})
