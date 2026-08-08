interface ProgressionTrackProps {
  weeks: number[]
  currentIndex: number
  unit?: string
}

export function ProgressionTrack({ weeks, currentIndex, unit = 'km' }: ProgressionTrackProps) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {weeks.map((km, i) => {
        const state = i === currentIndex ? 'current' : i < currentIndex ? 'past' : 'future'
        // No opacity here: it dims text and background together and drops contrast below AA.
        // Past/future read as inactive through the token colours instead.
        const labelClass = state === 'current' ? 'text-text-muted' : 'text-text-faint'
        return (
          <div
            key={i}
            className={`flex min-w-[3.25rem] shrink-0 flex-col items-center rounded-md border px-2 py-2 ${
              state === 'current'
                ? 'border-volt bg-volt/15'
                : state === 'past'
                  ? 'border-border bg-surface-2'
                  : 'border-border bg-surface-1'
            }`}
          >
            <span className={`text-[10px] font-medium uppercase tracking-wide ${labelClass}`}>
              W{i + 1}
            </span>
            <span
              className={`tnum font-display text-lg font-bold ${
                state === 'current' ? 'text-volt' : 'text-text-muted'
              }`}
            >
              {km}
            </span>
            <span className={`text-[10px] ${labelClass}`}>{unit}</span>
          </div>
        )
      })}
    </div>
  )
}
