import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Apple } from 'lucide-react'
import { checkA11y } from '@/test/axe'
import { CollapsibleSection } from '@/components/CollapsibleSection'

function setup(open: boolean, extra: { action?: ReactNode } = {}) {
  const onOpenChange = vi.fn()
  const view = render(
    <CollapsibleSection
      id="targets"
      title="Targets"
      icon={Apple}
      summary="1900–2100 kcal"
      open={open}
      onOpenChange={onOpenChange}
      {...extra}
    >
      <p>panel body</p>
    </CollapsibleSection>,
  )
  return { onOpenChange, view, trigger: screen.getByRole('button', { name: /targets/i }) }
}

describe('CollapsibleSection', () => {
  it('hides the panel and unmounts children while closed', () => {
    setup(false)
    const trigger = screen.getByRole('button', { name: /targets/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('targets-panel')).toHaveAttribute('hidden')
    expect(screen.queryByText('panel body')).not.toBeInTheDocument()
  })

  it('reveals children while open', () => {
    setup(true)
    expect(screen.getByRole('button', { name: /targets/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByText('panel body')).toBeInTheDocument()
  })

  it('keeps aria-controls resolvable in both states', () => {
    const { view } = setup(false)
    const id = screen.getByRole('button', { name: /targets/i }).getAttribute('aria-controls')
    expect(id).toBe('targets-panel')
    expect(document.getElementById(id!)).not.toBeNull()

    view.rerender(
      <CollapsibleSection id="targets" title="Targets" open onOpenChange={() => {}}>
        <p>panel body</p>
      </CollapsibleSection>,
    )
    expect(document.getElementById('targets-panel')).not.toBeNull()
  })

  it('puts the trigger inside the section heading', () => {
    setup(false)
    const heading = screen.getByRole('heading', { level: 2, name: /targets/i })
    expect(within(heading).getByRole('button')).toBe(
      screen.getByRole('button', { name: /targets/i }),
    )
  })

  it('toggles on click, Enter and Space', async () => {
    const user = userEvent.setup()
    const { onOpenChange, trigger } = setup(false)

    await user.click(trigger)
    trigger.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(onOpenChange).toHaveBeenCalledTimes(3)
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('renders the action slot outside the trigger (no nested buttons)', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    setup(false, {
      action: (
        <button type="button" onClick={onAction}>
          Log
        </button>
      ),
    })

    const trigger = screen.getByRole('button', { name: /targets/i })
    expect(within(trigger).queryByRole('button')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Log' }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  it('scrolls the trigger back into view when collapsing', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
    const raf = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0)
        return 0
      })

    const { trigger } = setup(true)
    await user.click(trigger)

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ block: 'nearest' }))
    raf.mockRestore()
    spy.mockClear()
  })

  it('does not scroll when expanding', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
    spy.mockClear()

    const { trigger } = setup(false)
    await user.click(trigger)

    expect(spy).not.toHaveBeenCalled()
  })

  it('has no axe violations, open or closed', async () => {
    const { view } = setup(false)
    expect(await checkA11y(view.container)).toHaveNoViolations()

    view.rerender(
      <CollapsibleSection id="targets" title="Targets" open onOpenChange={() => {}}>
        <p>panel body</p>
      </CollapsibleSection>,
    )
    expect(await checkA11y(view.container)).toHaveNoViolations()
  })
})
