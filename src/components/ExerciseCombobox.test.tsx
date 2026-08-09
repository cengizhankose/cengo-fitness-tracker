import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { checkA11y } from '@/test/axe'
import { ExerciseCombobox } from '@/components/ExerciseCombobox'

const OPTIONS = [
  'Incline Dumbbell Press',
  'Pull Up / Lat Pulldown',
  'Machine Chest Press',
  'Seated Cable Row',
  'Lateral Raise',
  'Cable Curl',
  'Rope Pushdown',
  'Leg Press',
  'Hanging Leg Raise',
  'Row Variation',
  'Lateral Raise', // duplicated across plan days
]

function setup(value = 'Cable Curl', options = OPTIONS) {
  const onChange = vi.fn()
  const view = render(
    <ExerciseCombobox label="Exercise" value={value} options={options} onChange={onChange} />,
  )
  return { onChange, view, trigger: screen.getByRole('button', { name: /exercise/i }) }
}

const search = () => screen.getByRole('combobox', { name: /search exercises/i })
const optionNames = () => screen.getAllByRole('option').map((o) => o.textContent)
const groupNames = () => screen.getAllByRole('group').map((g) => g.getAttribute('aria-labelledby'))

describe('ExerciseCombobox', () => {
  it('names the trigger with both the label and the current value, and hides the list', () => {
    const { trigger } = setup()
    expect(trigger).toHaveAccessibleName('Exercise Cable Curl')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows every exercise once, grouped by body region', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()
    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    for (const region of ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core']) {
      expect(screen.getByRole('group', { name: region })).toBeInTheDocument()
    }
    expect(within(screen.getByRole('group', { name: 'Chest' })).getAllByRole('option')).toHaveLength(
      2,
    )
    // "Lateral Raise" appears on two plan days but only once in the list.
    expect(screen.getAllByRole('option', { name: 'Lateral Raise' })).toHaveLength(1)
    expect(optionNames()).toHaveLength(new Set(OPTIONS).size)
    expect(screen.getByRole('option', { name: 'Cable Curl' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('filters case-insensitively across groups and hides emptied groups', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()
    await user.click(trigger)
    await user.type(search(), 'RAISE')

    expect(optionNames()).toEqual(['Lateral Raise', 'Hanging Leg Raise'])
    expect(groupNames()).toHaveLength(2)
    expect(screen.getByRole('group', { name: 'Shoulders' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Chest' })).not.toBeInTheDocument()
  })

  it('shows a no-results state and keeps the listbox empty', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()
    await user.click(trigger)
    await user.type(search(), 'zzz')

    expect(screen.getByRole('status')).toHaveTextContent(/No exercises match/)
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.queryAllByRole('group')).toHaveLength(0)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('selects with the pointer, closes and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    const { onChange, trigger } = setup()
    await user.click(trigger)
    await user.click(screen.getByRole('option', { name: 'Leg Press' }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith('Leg Press')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('opens with ArrowDown, moves the active option and selects with Enter', async () => {
    const user = userEvent.setup()
    const { onChange, trigger } = setup()

    trigger.focus()
    await user.keyboard('{ArrowDown}')
    expect(search()).toHaveFocus()

    const activeName = () =>
      document.getElementById(search().getAttribute('aria-activedescendant')!)?.textContent

    expect(activeName()).toBe('Cable Curl') // starts on the current value
    await user.keyboard('{ArrowDown}')
    expect(activeName()).toBe('Rope Pushdown')
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(activeName()).toBe('Lateral Raise')

    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('Lateral Raise')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('highlights the first match while typing so Enter picks it', async () => {
    const user = userEvent.setup()
    const { onChange, trigger } = setup()
    await user.click(trigger)
    await user.type(search(), 'leg p')
    await user.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledExactlyOnceWith('Leg Press')
  })

  it('does nothing on Enter when nothing matches', async () => {
    const user = userEvent.setup()
    const { onChange, trigger } = setup()
    await user.click(trigger)
    await user.type(search(), 'zzz{Enter}')

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('closes on Escape without selecting, and on an outside click', async () => {
    const user = userEvent.setup()
    const { onChange, trigger } = setup()

    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    await user.click(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('starts each opening from an empty query', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()

    await user.click(trigger)
    await user.type(search(), 'leg')
    await user.keyboard('{Escape}')
    await user.click(trigger)

    expect(search()).toHaveValue('')
    expect(optionNames().length).toBeGreaterThan(2)
  })

  it('keeps an unmapped exercise selectable under Other', async () => {
    const user = userEvent.setup()
    const { trigger } = setup('Bulgarian Split Squat', ['Bulgarian Split Squat', ...OPTIONS])

    expect(trigger).toHaveTextContent('Bulgarian Split Squat')
    await user.click(trigger)

    const other = screen.getByRole('group', { name: 'Other' })
    expect(within(other).getByRole('option', { name: 'Bulgarian Split Squat' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('renders the search field at 16px on mobile so iOS Safari does not zoom on focus', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()
    await user.click(trigger)

    // Safari zooms the viewport when a focused field is under 16px; `text-base` is
    // the smallest Tailwind step that clears it. A `sm:`-prefixed override is fine.
    expect(search()).toHaveClass('text-base')
    expect(search().className).not.toMatch(/(^|\s)text-(xs|sm)(\s|$)/)
  })

  it('scrolls the highlighted option into view on open and on arrow moves', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
    spy.mockClear()
    const { trigger } = setup('Hanging Leg Raise') // last region, below the fold

    await user.click(trigger)
    expect(spy.mock.instances.at(-1)).toBe(screen.getByRole('option', { name: 'Hanging Leg Raise' }))
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ block: 'nearest' }))

    await user.keyboard('{ArrowDown}')
    expect(spy.mock.instances.at(-1)).toBe(
      screen.getByRole('option', { name: 'Incline Dumbbell Press' }),
    )
    spy.mockRestore()
  })

  it('has no axe violations, closed or open', async () => {
    const user = userEvent.setup()
    const { view, trigger } = setup()
    expect(await checkA11y(view.container)).toHaveNoViolations()

    await user.click(trigger)
    expect(await checkA11y(view.container)).toHaveNoViolations()

    await user.type(search(), 'zzz')
    expect(await checkA11y(view.container)).toHaveNoViolations()
  })
})
