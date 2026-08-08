import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

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

afterEach(() => {
  cleanup()
  localStorage.clear()
})
