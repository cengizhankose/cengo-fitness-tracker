import { useEffect, useId, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent, ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'
import { decimalsOf, formatDecimal, parseDecimal, roundTo } from './number'

export interface NumberFieldProps {
  label: string
  /** '' = empty (nothing entered yet). */
  value: number | ''
  onChange: (value: number | '') => void
  /** Stepper increment. Default 1. */
  step?: number
  /** Default 0. */
  min?: number
  max?: number
  /** Suffix inside the field, e.g. "kg", "tekrar", "sn". */
  unit?: string
  /** Shown as "Geçen sefer: …" under the field, e.g. "60 kg × 10". */
  lastTime?: ReactNode
  disabled?: boolean
  id?: string
}

const HOLD_DELAY_MS = 400
const HOLD_INTERVAL_MS = 90

/**
 * Big −/+ stepper around a directly typeable number (comma or dot decimals); holding a
 * stepper repeats. Out-of-range typing is clamped on blur.
 */
export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  unit,
  lastTime,
  disabled = false,
  id: idProp,
}: NumberFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const lastId = `${id}-last`
  /** Raw text while the user is typing; null shows the formatted value. */
  const [draft, setDraft] = useState<string | null>(null)
  const timers = useRef({ delay: 0, repeat: 0 })

  useEffect(() => {
    const t = timers.current
    return () => {
      window.clearTimeout(t.delay)
      window.clearInterval(t.repeat)
    }
  }, [])

  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  const stepped = (from: number | '', dir: 1 | -1): number => {
    const base = from === '' ? min : from
    return clamp(roundTo(base + dir * step, Math.max(decimalsOf(step), decimalsOf(base))))
  }

  function stopRepeat() {
    window.clearTimeout(timers.current.delay)
    window.clearInterval(timers.current.repeat)
  }

  function startRepeat(dir: 1 | -1) {
    stopRepeat()
    setDraft(null)
    let current = stepped(value, dir)
    onChange(current)
    timers.current.delay = window.setTimeout(() => {
      timers.current.repeat = window.setInterval(() => {
        const next = stepped(current, dir)
        if (next === current) {
          stopRepeat()
          return
        }
        current = next
        onChange(next)
      }, HOLD_INTERVAL_MS)
    }, HOLD_DELAY_MS)
  }

  const atMin = value !== '' && value <= min
  const atMax = value !== '' && value >= max

  function stepperProps(dir: 1 | -1) {
    return {
      type: 'button' as const,
      'aria-label': `${label} ${dir === 1 ? 'artır' : 'azalt'}`,
      disabled: disabled || (dir === 1 ? atMax : atMin),
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        if (e.button > 0) return
        startRepeat(dir)
      },
      onPointerUp: () => stopRepeat(),
      onPointerLeave: () => stopRepeat(),
      onPointerCancel: () => stopRepeat(),
      // Keyboard / assistive-tech activation fires click without a pointer press.
      onClick: (e: MouseEvent<HTMLButtonElement>) => {
        if (e.detail === 0) onChange(stepped(value, dir))
      },
      onContextMenu: (e: MouseEvent) => e.preventDefault(),
      className:
        'grid size-tap-lg shrink-0 select-none place-items-center rounded-md border border-border-strong bg-raised text-text transition-colors [-webkit-touch-callout:none] active:bg-border disabled:opacity-40',
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-muted">
        {label}
      </label>
      <div className="flex items-stretch gap-2">
        <button {...stepperProps(-1)}>
          <Minus size={24} aria-hidden />
        </button>
        <div className="relative flex min-w-0 flex-1 items-center rounded-md border border-border bg-raised focus-within:border-volt">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            disabled={disabled}
            aria-describedby={lastTime != null ? lastId : undefined}
            value={draft ?? (value === '' ? '' : formatDecimal(value, 3))}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const parsed = parseDecimal(e.target.value)
              if (parsed === undefined) return
              setDraft(e.target.value)
              onChange(parsed)
            }}
            onBlur={() => {
              setDraft(null)
              if (value !== '' && clamp(value) !== value) onChange(clamp(value))
            }}
            className="num h-tap-lg w-full min-w-0 bg-transparent px-10 text-center text-num focus-visible:outline-none disabled:opacity-50"
          />
          {unit && (
            <span
              aria-hidden
              className="pointer-events-none absolute right-3 text-sm font-medium text-text-muted"
            >
              {unit}
            </span>
          )}
        </div>
        <button {...stepperProps(1)}>
          <Plus size={24} aria-hidden />
        </button>
      </div>
      {lastTime != null && (
        <p id={lastId} className="text-sm text-text-muted">
          Geçen sefer: <span className="font-semibold text-text tabular-nums">{lastTime}</span>
        </p>
      )}
    </div>
  )
}
