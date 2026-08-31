import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as axeMatchers from 'vitest-axe/matchers'
import { clear } from 'idb-keyval'
import { useStore } from '@/store'
import { mondayOf, toLocalISODate } from '@/lib/dates'

expect.extend(axeMatchers)

const nativeStructuredClone = globalThis.structuredClone
function cloneWithBlobs<T>(value: T): T {
  if (value instanceof Blob) return value
  if (Array.isArray(value)) return value.map(cloneWithBlobs) as T
  if (value !== null && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value)
    if (proto === Object.prototype || proto === null) {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value)) out[k] = cloneWithBlobs(v)
      return out as T
    }
  }
  return nativeStructuredClone(value)
}
globalThis.structuredClone = cloneWithBlobs as typeof structuredClone

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

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  await clear()
  useStore.setState({
    settings: { programStartDate: mondayOf(toLocalISODate()) },
    checklist: {},
    checkIns: {},
    strengthLog: [],
    runLog: [],
    benchmark: undefined,
    activeSession: undefined,
    marathonStatus: {},
  })
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.useRealTimers()
})
