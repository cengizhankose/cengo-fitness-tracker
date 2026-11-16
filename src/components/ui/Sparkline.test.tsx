import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sparkline } from './Sparkline'

function draw(values: number[]) {
  const { container } = render(<Sparkline values={values} label="Bench Press" />)
  return {
    svg: screen.getByRole('img', { name: 'Bench Press' }),
    circles: container.querySelectorAll('circle'),
    polyline: container.querySelector('polyline'),
    baseline: container.querySelector('line'),
  }
}

describe('Sparkline', () => {
  it('draws only a dashed baseline with no points', () => {
    const { svg, circles, polyline, baseline } = draw([])
    expect(svg).toBeInTheDocument()
    expect(circles).toHaveLength(0)
    expect(polyline).toBeNull()
    expect(baseline).not.toBeNull()
  })

  it('draws a single highlighted point for one value', () => {
    const { circles, polyline } = draw([80])
    expect(polyline).toBeNull()
    expect(circles).toHaveLength(1)
    expect(circles[0]).toHaveAttribute('cx', '93')
    expect(circles[0]).toHaveAttribute('cy', '16')
  })

  it('scales n points to the box and highlights the last one', () => {
    const { circles, polyline, baseline } = draw([1, 2, 3])
    expect(baseline).toBeNull()
    expect(polyline).toHaveAttribute('points', '3,29 48,16 93,3')
    expect(circles).toHaveLength(1)
    expect(circles[0]).toHaveAttribute('cx', '93')
    expect(circles[0]).toHaveAttribute('cy', '3')
  })

  it('draws a flat series through the middle', () => {
    const { polyline } = draw([5, 5])
    expect(polyline).toHaveAttribute('points', '3,16 93,16')
  })
})
