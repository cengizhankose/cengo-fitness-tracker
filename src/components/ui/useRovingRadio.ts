import { useRef } from 'react'
import type { KeyboardEvent } from 'react'

interface RovingRadioOptions<T> {
  values: readonly T[]
  selected: T | undefined
  onSelect: (value: T) => void
  /** When given, Delete/Backspace clears the selection. */
  onClear?: () => void
}

/**
 * WAI-ARIA radio-group keyboard model with a roving tabindex: one tab stop for the group,
 * arrow keys move focus and select (wrapping), Home/End jump to the ends.
 */
export function useRovingRadio<T>({ values, selected, onSelect, onClear }: RovingRadioOptions<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = selected === undefined ? -1 : values.indexOf(selected)
  const tabStop = selectedIndex >= 0 ? selectedIndex : 0

  return (index: number) => ({
    ref: (el: HTMLButtonElement | null) => {
      refs.current[index] = el
    },
    type: 'button' as const,
    role: 'radio' as const,
    'aria-checked': index === selectedIndex,
    tabIndex: index === tabStop ? 0 : -1,
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      const last = values.length - 1
      let next: number
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = index === last ? 0 : index + 1
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          next = index === 0 ? last : index - 1
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = last
          break
        case 'Delete':
        case 'Backspace':
          if (onClear) {
            e.preventDefault()
            onClear()
          }
          return
        default:
          return
      }
      e.preventDefault()
      const value = values[next]
      if (value === undefined) return
      onSelect(value)
      refs.current[next]?.focus()
    },
  })
}
