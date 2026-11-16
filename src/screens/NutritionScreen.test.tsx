import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { formatNumber } from '@/lib/format'
import { plan } from '@/lib/plan'
import { NutritionScreen } from './NutritionScreen'

function renderNutrition() {
  render(
    <MemoryRouter initialEntries={['/nutrition']}>
      <NutritionScreen />
    </MemoryRouter>,
  )
}

describe('NutritionScreen', () => {
  it('renders every meal of the plan in order with its items', () => {
    renderNutrition()
    const list = screen.getByRole('list', { name: 'Öğünler' })
    const meals = within(list)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.firstChild?.textContent)
    expect(meals).toEqual(plan.nutrition.meals.map((m) => m.title))

    for (const meal of plan.nutrition.meals) {
      for (const item of meal.items) expect(within(list).getByText(item)).toBeInTheDocument()
      if (meal.time) expect(within(list).getByText(meal.time)).toBeInTheDocument()
    }
  })

  it('renders every supplement with dose, timing and note, and the avoid list', () => {
    renderNutrition()
    const list = screen.getByRole('list', { name: 'Takviyeler' })
    for (const s of plan.supplements.items) {
      expect(within(list).getByText(s.name)).toBeInTheDocument()
      expect(within(list).getByText(s.dose)).toBeInTheDocument()
      if (s.timing) expect(within(list).getByText(s.timing)).toBeInTheDocument()
      if (s.note) expect(within(list).getByText(s.note)).toBeInTheDocument()
    }
    for (const item of plan.supplements.avoid) expect(screen.getByText(item)).toBeInTheDocument()
  })

  it('shows the daily targets from the plan', () => {
    renderNutrition()
    const { caloriesKcal, proteinG, carbsG, fatG } = plan.nutrition.targets
    for (const n of [caloriesKcal, proteinG, carbsG, fatG]) {
      expect(screen.getByText(formatNumber(n))).toBeInTheDocument()
    }
  })
})
