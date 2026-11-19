/**
 * End-of-rest signal: two short beeps on the Web Audio clock, plus a vibration where the
 * browser has one (not iOS). iOS only lets a page start audio inside a tap, so
 * `primeRestAlarm` runs in the "Seti kaydet" click; a rest restored after a reload stays
 * silent until the next logged set. Beeps follow the ringer switch and mix with music.
 */

let ctx: AudioContext | undefined
let cancelPending: (() => void) | undefined

const BEEP_FREQ_HZ = 880
const BEEP_LENGTH_S = 0.18
const BEEP_OFFSETS_S = [0, 0.3]
const VIBRATION_MS = [200, 100, 200]

/** Creates or resumes the audio context. Call it from a user gesture. */
export function primeRestAlarm(): void {
  if (typeof AudioContext === 'undefined') return
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
}

/** Arms the signal for `endsAtMs` (epoch ms), replacing any armed one. Past times arm nothing. */
export function scheduleRestAlarm(endsAtMs: number): void {
  cancelRestAlarm()
  const delayMs = endsAtMs - Date.now()
  if (delayMs <= 0) return

  const beeps: OscillatorNode[] = []
  if (ctx && ctx.state !== 'closed') {
    const at = ctx.currentTime + delayMs / 1000
    for (const offset of BEEP_OFFSETS_S) {
      const start = at + offset
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = BEEP_FREQ_HZ
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.4, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + BEEP_LENGTH_S)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + BEEP_LENGTH_S)
      beeps.push(osc)
    }
  }
  const vibration = setTimeout(() => {
    if ('vibrate' in navigator) navigator.vibrate(VIBRATION_MS)
  }, delayMs)

  cancelPending = () => {
    clearTimeout(vibration)
    for (const osc of beeps) {
      osc.stop()
      osc.disconnect()
    }
  }
}

/** Disarms the pending signal, if any. */
export function cancelRestAlarm(): void {
  cancelPending?.()
  cancelPending = undefined
}
