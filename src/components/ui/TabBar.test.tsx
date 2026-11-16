import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { checkA11y } from '@/test/axe'
import { TabBar } from './TabBar'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TabBar />
    </MemoryRouter>,
  )
}

const current = () =>
  screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page')

describe('TabBar', () => {
  it('shows the five labelled tabs', () => {
    renderAt('/')
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Bugün',
      'Plan',
      'Hareketler',
      'Geçmiş',
      'İlerleme',
    ])
  })

  it('marks only Bugün on the root route', () => {
    renderAt('/')
    expect(current()).toEqual([screen.getByRole('link', { name: 'Bugün' })])
  })

  it('keeps Hareketler active on a nested exercise route', () => {
    renderAt(`/exercises/${encodeURIComponent('Bench Press')}`)
    expect(current()).toEqual([screen.getByRole('link', { name: 'Hareketler' })])
  })

  it('maps non-tab routes to the tab that opens them', () => {
    const { unmount } = renderAt('/settings')
    expect(current()).toEqual([screen.getByRole('link', { name: 'Bugün' })])
    unmount()
    renderAt('/nutrition')
    expect(current()).toEqual([screen.getByRole('link', { name: 'Plan' })])
  })

  it('has no a11y violations', async () => {
    const { container } = renderAt('/progress')
    expect(await checkA11y(container)).toHaveNoViolations()
  })
})
