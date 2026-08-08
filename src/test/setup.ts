import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as axeMatchers from 'vitest-axe/matchers'
import { useStore } from '@/store'
import { mondayOf, toLocalISODate } from '@/lib/dates'

expect.extend(axeMatchers)

const WIDTH = 390
const HEIGHT = 170
class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  value(): DOMRect {
    return {
      width: WIDTH,
      height: HEIGHT,
      top: 0,
      left: 0,
      right: WIDTH,
      bottom: HEIGHT,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  },
})
for (const [prop, size] of [
  ['offsetWidth', WIDTH],
  ['clientWidth', WIDTH],
  ['offsetHeight', HEIGHT],
  ['clientHeight', HEIGHT],
] as const) {
  Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, value: size })
}

Element.prototype.scrollIntoView = vi.fn()
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    media: '',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as never
}

beforeEach(() => {
  localStorage.clear()
  useStore.setState({
    settings: { programStartDate: mondayOf(toLocalISODate()) },
    checklist: {},
    checkIns: {},
    strengthLog: [],
    runLog: [],
    benchmark: undefined,
  })
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.useRealTimers()
})
