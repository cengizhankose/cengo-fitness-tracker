// vitest-axe@0.1.0 augments the legacy global `Vi` namespace, which Vitest 4 no
// longer reads. Re-declare the matcher against the modern `vitest` module instead.
import type { NoViolationsMatcherResult } from 'vitest-axe/matchers'

declare module 'vitest' {
  interface Matchers {
    toHaveNoViolations(): NoViolationsMatcherResult
  }
}
