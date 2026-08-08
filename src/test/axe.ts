import { axe } from 'vitest-axe'

/**
 * jsdom cannot paint, so axe's color-contrast rule can only warn about a missing
 * canvas. Everything else (roles, names, aria wiring) runs normally.
 */
export function checkA11y(container: Element) {
  return axe(container, { rules: { 'color-contrast': { enabled: false } } })
}
