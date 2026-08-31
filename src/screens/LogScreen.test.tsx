import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LogScreen } from '@/screens/LogScreen'
import { ToastHost } from '@/components/ToastHost'
import { useStore } from '@/store'
import { useToast } from '@/store/toast'
import { toLocalISODate } from '@/lib/dates'

const BENCHMARK_ROUTE = '/log?type=run&benchmark=1'

function renderLog(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/" element={<div>today screen</div>} />
        <Route path="/weekly" element={<div>plan screen</div>} />
        <Route path="/log" element={<LogScreen />} />
      </Routes>
      <ToastHost />
    </MemoryRouter>,
  )
}

const timeField = () => screen.getByLabelText(/^Time/)
const saveButton = () => screen.getByRole('button', { name: /Save benchmark/ })
const state = () => useStore.getState()

describe('LogScreen — benchmark mode', () => {
  beforeEach(() => {
    useStore.setState({ benchmark: undefined, runLog: [], strengthLog: [], checklist: {} })
    useToast.setState({ toasts: [] })
    localStorage.clear()
  })

  it('refuses an empty time: inline error, nothing saved, stays on the form', async () => {
    const user = userEvent.setup()
    renderLog(BENCHMARK_ROUTE)

    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(/mm:ss/)
    expect(state().benchmark).toBeUndefined()
    expect(state().runLog).toHaveLength(0)
    expect(screen.queryByText('today screen')).not.toBeInTheDocument()
    expect(timeField()).toHaveFocus()
    expect(timeField()).toHaveAttribute('aria-invalid', 'true')
    const raw = localStorage.getItem('cengo-cut')
    expect(raw === null || JSON.parse(raw).state.benchmark === undefined).toBe(true)
  })

  it('refuses a malformed time', async () => {
    const user = userEvent.setup()
    renderLog(BENCHMARK_ROUTE)

    await user.type(timeField(), 'abc')
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(/mm:ss/)
    expect(state().benchmark).toBeUndefined()
    expect(state().runLog).toHaveLength(0)
  })

  it.each([
    ['09:59', /between/],
    ['90:01', /between/],
    ['24:99', /mm:ss/],
  ])('refuses out-of-contract time %s', async (input, message) => {
    const user = userEvent.setup()
    renderLog(BENCHMARK_ROUTE)

    await user.type(timeField(), input)
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(state().benchmark).toBeUndefined()
    expect(state().runLog).toHaveLength(0)
  })

  it.each(['10:00', '90:00'])('accepts boundary time %s', async (input) => {
    const user = userEvent.setup()
    renderLog(BENCHMARK_ROUTE)

    await user.type(timeField(), input)
    await user.click(saveButton())

    expect(await screen.findByText('today screen')).toBeInTheDocument()
    expect(state().benchmark).toBeDefined()
  })

  it('saves a valid benchmark, logs the run, toasts and navigates home', async () => {
    const user = userEvent.setup()
    renderLog(BENCHMARK_ROUTE)

    await user.type(timeField(), '24:30')
    await user.click(saveButton())

    expect(state().benchmark?.timeSec).toBe(1470)
    expect(state().benchmark?.averagePace).toBe('4:54/km')
    expect(state().runLog).toHaveLength(1)
    expect(state().runLog[0]).toMatchObject({ distanceKm: 5, durationMin: 24.5 })
    expect(state().runLog[0]?.createdAt).toBe(state().benchmark?.createdAt)
    expect(screen.getByText('Benchmark saved · 24:30')).toBeInTheDocument()
    expect(await screen.findByText('today screen')).toBeInTheDocument()
  })

  it('clears the error as soon as the user types again', async () => {
    const user = userEvent.setup()
    renderLog(BENCHMARK_ROUTE)

    await user.click(saveButton())
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await user.type(timeField(), '2')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('locks the distance to 5 km — no editable distance or pace field', async () => {
    const user = userEvent.setup()
    renderLog(BENCHMARK_ROUTE)

    expect(screen.queryByLabelText(/^Distance/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/pace/i)).not.toBeInTheDocument()
    expect(screen.getByText('Fixed for the 5K benchmark')).toBeInTheDocument()

    await user.type(timeField(), '24:30')
    await user.click(saveButton())

    expect(state().runLog[0]?.distanceKm).toBe(5)
    expect(state().runLog[0]?.averagePace).toBe('4:54/km')
    expect(state().benchmark?.averagePace).toBe('4:54/km')
  })

  it('never lets a failed save leave a half-written record behind', async () => {
    const user = userEvent.setup()
    renderLog(BENCHMARK_ROUTE)

    for (const input of ['', 'abc', '09:59', '90:01']) {
      if (input) await user.type(timeField(), input)
      await user.click(saveButton())

      expect(state().benchmark, input).toBeUndefined()
      expect(state().runLog, input).toHaveLength(0)
      expect(screen.queryByText('today screen')).not.toBeInTheDocument()
      expect(screen.queryByText(/Benchmark saved/)).not.toBeInTheDocument()
      await user.clear(timeField())
    }
  })

  it('rejects an out-of-range heart rate before saving anything', async () => {
    const user = userEvent.setup()
    renderLog(BENCHMARK_ROUTE)

    await user.type(timeField(), '24:30')
    await user.type(screen.getByLabelText(/^Avg HR/), '400')
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(/Heart rate/)
    expect(state().benchmark).toBeUndefined()
    expect(state().runLog).toHaveLength(0)
  })

  it('overwrites an earlier benchmark when logged again', async () => {
    const user = userEvent.setup()
    useStore.setState({
      benchmark: { date: '2026-08-01', timeSec: 1600, createdAt: '2026-08-01T00:00:00.000Z' },
    })
    renderLog(BENCHMARK_ROUTE)

    await user.type(timeField(), '23:00')
    await user.click(saveButton())

    expect(state().benchmark?.timeSec).toBe(1380)
    expect(await screen.findByText('today screen')).toBeInTheDocument()
  })
})

describe('LogScreen — plain run mode is unchanged', () => {
  beforeEach(() => {
    useStore.setState({ benchmark: undefined, runLog: [], strengthLog: [], checklist: {} })
    useToast.setState({ toasts: [] })
    localStorage.clear()
  })

  it('logs a run without a duration and never writes a benchmark', async () => {
    const user = userEvent.setup()
    renderLog('/log?type=run')

    expect(screen.getByLabelText(/^Duration/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Time/)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/^Distance/), '8')
    await user.click(screen.getByRole('button', { name: /Save run/ }))

    expect(state().runLog).toHaveLength(1)
    expect(state().runLog[0]).toMatchObject({ distanceKm: 8, durationMin: undefined })
    expect(state().benchmark).toBeUndefined()
    expect(screen.getByText('Logged run · 8 km')).toBeInTheDocument()
  })

  it('still requires a distance', async () => {
    const user = userEvent.setup()
    renderLog('/log?type=run')

    await user.click(screen.getByRole('button', { name: /Save run/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/distance/i)
    expect(state().runLog).toHaveLength(0)
  })
})

describe('LogScreen — marathon date + context (Slice 6)', () => {
  beforeEach(() => {
    useStore.setState({ benchmark: undefined, runLog: [], strengthLog: [], checklist: {}, marathonStatus: {} })
    useToast.setState({ toasts: [] })
    localStorage.clear()
  })

  it('no date param -> identical behaviour to today: entry date is toLocalISODate()', async () => {
    const user = userEvent.setup()
    renderLog('/log?type=run')

    await user.type(screen.getByLabelText(/^Distance/), '8')
    await user.click(screen.getByRole('button', { name: /Save run/ }))

    expect(state().runLog[0]?.date).toBe(toLocalISODate())
  })

  it('a marathon date param prefills distance, saves the entry against that date, and names the date in the subtitle', async () => {
    const user = userEvent.setup()
    renderLog('/log?type=run&date=2026-09-02')

    expect(screen.getByLabelText(/^Distance/)).toHaveValue(8)
    expect(screen.getByText(/Logging for/)).toHaveTextContent('Wed 2 Sep')

    await user.click(screen.getByRole('button', { name: /Save run/ }))
    expect(state().runLog[0]?.date).toBe('2026-09-02')
  })

  it('shows a read-only planned-workout banner with no extra inputs', () => {
    const noParam = renderLog('/log?type=run')
    const baseInputCount = noParam.container.querySelectorAll('input').length
    noParam.unmount()

    const withParam = renderLog('/log?type=run&date=2026-09-02')
    expect(screen.getByText('Threshold')).toBeInTheDocument()
    expect(screen.getByText(/8 km/)).toBeInTheDocument()
    expect(screen.getByText(/Threshold zone/)).toBeInTheDocument()
    expect(withParam.container.querySelectorAll('input').length).toBe(baseInputCount)
  })

  it('does not prefill duration or pace from the plan', () => {
    renderLog('/log?type=run&date=2026-09-02')
    expect(screen.getByLabelText(/^Duration/)).toHaveValue(null)
    expect(screen.getByPlaceholderText(/auto from distance/)).toHaveValue('')
  })

  it.each(['garbage', '2026-13-40'])(
    'falls back to today for a malformed date %s — no crash, no banner',
    (bad) => {
      renderLog(`/log?type=run&date=${bad}`)
      expect(screen.getByLabelText(/^Distance/)).toHaveValue(null)
      expect(screen.queryByText(/Logging for/)).not.toBeInTheDocument()
    },
  )

  it('a syntactically valid but out-of-plan date is still used (no banner, no crash, no invalid date written)', async () => {
    const user = userEvent.setup()
    renderLog('/log?type=run&date=2025-01-01')

    expect(screen.queryByText('Threshold')).not.toBeInTheDocument()
    expect(screen.getByText(/Logging for/)).toHaveTextContent(/1 Jan/)

    await user.type(screen.getByLabelText(/^Distance/), '5')
    await user.click(screen.getByRole('button', { name: /Save run/ }))
    expect(state().runLog[0]?.date).toBe('2025-01-01')
  })

  it('from=plan returns to /weekly after a successful save', async () => {
    const user = userEvent.setup()
    renderLog('/log?type=run&date=2026-09-02&from=plan')

    await user.type(screen.getByLabelText(/^Distance/), '8')
    await user.click(screen.getByRole('button', { name: /Save run/ }))

    expect(await screen.findByText('plan screen')).toBeInTheDocument()
  })

  it('from=today returns to / after a successful save', async () => {
    const user = userEvent.setup()
    renderLog('/log?type=run&date=2026-09-02&from=today')

    await user.type(screen.getByLabelText(/^Distance/), '8')
    await user.click(screen.getByRole('button', { name: /Save run/ }))

    expect(await screen.findByText('today screen')).toBeInTheDocument()
  })

  it('an unknown from stays put', async () => {
    const user = userEvent.setup()
    renderLog('/log?type=run&date=2026-09-02&from=nowhere')

    await user.type(screen.getByLabelText(/^Distance/), '8')
    await user.click(screen.getByRole('button', { name: /Save run/ }))

    expect(screen.queryByText('today screen')).not.toBeInTheDocument()
    expect(screen.queryByText('plan screen')).not.toBeInTheDocument()
  })

  it('?benchmark=1 is unaffected: fixes 5km and navigates to / regardless of from', async () => {
    const user = userEvent.setup()
    renderLog('/log?type=run&benchmark=1&date=2026-09-02')

    await user.type(screen.getByLabelText(/^Time/), '24:30')
    await user.click(screen.getByRole('button', { name: /Save benchmark/ }))

    expect(state().runLog[0]?.distanceKm).toBe(5)
    expect(await screen.findByText('today screen')).toBeInTheDocument()
  })

  it('benchmark mode ignores a supplied date query param and always logs against today', async () => {
    const user = userEvent.setup()
    renderLog('/log?type=run&benchmark=1&date=2026-09-02')

    await user.type(screen.getByLabelText(/^Time/), '24:30')
    await user.click(screen.getByRole('button', { name: /Save benchmark/ }))

    expect(state().benchmark?.date).toBe(toLocalISODate())
    expect(state().runLog[0]?.date).toBe(toLocalISODate())
  })

  it('the strength tab honours a date param too — one code path, no split behaviour', async () => {
    const user = userEvent.setup()
    renderLog('/log?date=2026-09-02')

    await user.type(screen.getByLabelText(/^Weight/), '80')
    await user.click(screen.getByRole('button', { name: /Save set/ }))

    expect(state().strengthLog[0]?.date).toBe('2026-09-02')
  })
})
