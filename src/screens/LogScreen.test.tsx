import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LogScreen } from '@/screens/LogScreen'
import { ToastHost } from '@/components/ToastHost'
import { useStore } from '@/store'
import { useToast } from '@/store/toast'

const BENCHMARK_ROUTE = '/log?type=run&benchmark=1'

function renderLog(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/" element={<div>today screen</div>} />
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
