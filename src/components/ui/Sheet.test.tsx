import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { checkA11y } from '@/test/axe'
import { Sheet } from './Sheet'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Aç
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Set düzenle">
        <button type="button">Bir</button>
        <button type="button">İki</button>
      </Sheet>
    </>
  )
}

async function openSheet() {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Aç' }))
  return user
}

describe('Sheet', () => {
  it('opens as a labelled modal dialog and focuses it', async () => {
    await openSheet()
    const dialog = screen.getByRole('dialog', { name: 'Set düzenle' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveFocus()
  })

  it('traps Tab and Shift+Tab inside the sheet', async () => {
    const user = await openSheet()
    const close = screen.getByRole('button', { name: 'Kapat' })
    const last = screen.getByRole('button', { name: 'İki' })
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab()
    await user.tab()
    expect(last).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(last).toHaveFocus()
  })

  it('closes on Escape and restores focus to the opener', async () => {
    const user = await openSheet()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aç' })).toHaveFocus()
  })

  it('closes on backdrop tap and via the close button', async () => {
    const user = await openSheet()
    const backdrop = screen.getByRole('dialog').previousElementSibling as HTMLElement
    await user.click(backdrop)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aç' }))
    await user.click(screen.getByRole('button', { name: 'Kapat' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('locks body scroll while open', async () => {
    const user = await openSheet()
    expect(document.body.style.overflow).toBe('hidden')
    await user.keyboard('{Escape}')
    expect(document.body.style.overflow).toBe('')
  })

  it('has no a11y violations', async () => {
    await openSheet()
    expect(await checkA11y(screen.getByRole('dialog').parentElement!)).toHaveNoViolations()
  })
})
