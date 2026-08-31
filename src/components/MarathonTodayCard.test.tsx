import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { MarathonTodayCard } from './MarathonTodayCard'
import { useStore } from '@/store'

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname + loc.search}</div>
}

function renderCard(today: string) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<MarathonTodayCard today={today} />} />
        <Route path="/log" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useStore.setState({ runLog: [], marathonStatus: {} })
})

describe('MarathonTodayCard', () => {
  it('renders a Marathon card with today pre-expanded, CTA carries from=today', async () => {
    const user = userEvent.setup()
    renderCard('2026-09-02')

    expect(screen.getByText('Marathon')).toBeInTheDocument()
    expect(screen.getByText('Threshold', { selector: 'p' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Log run/ }))
    expect(await screen.findByTestId('loc')).toHaveTextContent(
      '/log?type=run&date=2026-09-02&from=today',
    )
  })

  it('renders nothing outside the plan window', () => {
    const before = renderCard('2026-08-29')
    expect(before.container).toBeEmptyDOMElement()
    before.unmount()

    const after = renderCard('2026-11-05')
    expect(after.container).toBeEmptyDOMElement()
  })
})
