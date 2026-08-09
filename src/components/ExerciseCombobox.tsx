import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { filterGroups, groupExercises } from '@/lib/exerciseGroups'

/** Stable DOM id for an option — derived from the field's useId, so it survives filtering. */
const optionDomId = (scope: string, name: string) => `${scope}-option-${name.replace(/\W+/g, '-')}`

interface ExerciseComboboxProps {
  label: string
  value: string
  /** Catalog names; duplicates and unmapped entries are handled by groupExercises. */
  options: string[]
  placeholder?: string
  onChange: (value: string) => void
}

/**
 * Searchable, region-grouped exercise picker.
 *
 * A11y: the trigger is a plain button (`aria-haspopup="listbox"`) named by the
 * visible label plus the current value. The popup follows the ARIA 1.2 combobox
 * pattern — the search input is the combobox, it owns the listbox via
 * `aria-controls`, and the visually highlighted option is exposed with
 * `aria-activedescendant` (DOM focus stays in the input so typing keeps working).
 */
export function ExerciseCombobox({
  label,
  value,
  options,
  placeholder = 'Choose an exercise',
  onChange,
}: ExerciseComboboxProps) {
  const id = useId()
  const labelId = `${id}-label`
  const valueId = `${id}-value`
  const listboxId = `${id}-listbox`
  const optionId = (name: string) => optionDomId(id, name)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeName, setActiveName] = useState(value)

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const groups = useMemo(
    () => filterGroups(groupExercises(options), query),
    [options, query],
  )
  const visible = useMemo(() => groups.flatMap((group) => group.exercises), [groups])
  // Filtering can drop the highlighted name — fall back to the first match so
  // Enter always has something sensible to select.
  const active = visible.includes(activeName) ? activeName : visible[0]

  function openList() {
    setQuery('')
    setActiveName(value)
    setOpen(true)
  }

  function close(refocus = true) {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  function select(name: string) {
    onChange(name)
    close()
  }

  // Move focus into the search field as soon as the popup mounts.
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // DOM focus stays in the search field, so the highlighted option has to be
  // scrolled into the listbox viewport by hand.
  useEffect(() => {
    if (!open || !active) return
    document.getElementById(optionDomId(id, active))?.scrollIntoView({ block: 'nearest' })
  }, [id, open, active])

  // Close on a tap/click anywhere outside — without stealing focus back.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function move(delta: number) {
    if (visible.length === 0) return
    const from = active ? visible.indexOf(active) : -1
    const next = visible[(from + delta + visible.length) % visible.length]
    if (next) setActiveName(next)
  }

  function moveTo(index: number) {
    const name = visible.at(index)
    if (name) setActiveName(name)
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Home':
        event.preventDefault()
        moveTo(0)
        break
      case 'End':
        event.preventDefault()
        moveTo(-1)
        break
      case 'Enter':
        event.preventDefault()
        if (active) select(active)
        break
      case 'Escape':
        event.preventDefault()
        close()
        break
      case 'Tab':
        close(false)
        break
    }
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openList()
    }
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <span id={labelId} className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKeyDown}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-3 text-left text-text outline-none focus-visible:border-volt focus-visible:ring-2 focus-visible:ring-volt"
      >
        <span id={valueId} className={`min-w-0 flex-1 truncate ${value ? '' : 'text-text-faint'}`}>
          {value || placeholder}
        </span>
        <ChevronDown
          size={18}
          aria-hidden
          className={`shrink-0 text-text-faint transition-transform motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border-strong bg-surface-1 shadow-lg shadow-black/40">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search size={16} aria-hidden className="shrink-0 text-text-faint" />
            {/* text-base on mobile: Safari zooms the viewport when a focused field is under 16px. */}
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label={`Search ${label.toLowerCase()}s`}
              aria-expanded
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={active ? optionId(active) : undefined}
              value={query}
              placeholder="Search"
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              className="min-w-0 flex-1 bg-transparent py-1 text-base text-text outline-none placeholder:text-text-faint sm:text-sm"
            />
          </div>

          {/* Plain divs, not lists: role="listbox" only admits option and group children. */}
          <div
            id={listboxId}
            role="listbox"
            aria-labelledby={labelId}
            className="max-h-64 overflow-y-auto overscroll-contain py-1"
          >
            {groups.map((group) => (
              <div key={group.region} role="group" aria-labelledby={`${id}-group-${group.region}`}>
                <div
                  id={`${id}-group-${group.region}`}
                  className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-text-faint"
                >
                  {group.region}
                </div>
                {group.exercises.map((name) => (
                  <div
                    key={name}
                    id={optionId(name)}
                    role="option"
                    aria-selected={name === value}
                    onPointerMove={() => setActiveName(name)}
                    onClick={() => select(name)}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                      name === active ? 'bg-surface-3 text-text' : 'text-text-muted'
                    }`}
                  >
                    <span className="min-w-0 flex-1 break-words">{name}</span>
                    {name === value && <Check size={16} aria-hidden className="shrink-0 text-volt" />}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {visible.length === 0 && (
            <p role="status" className="px-3 py-6 text-center text-sm text-text-faint">
              No exercises match “{query.trim()}”
            </p>
          )}
        </div>
      )}
    </div>
  )
}
