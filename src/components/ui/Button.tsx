import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Link } from 'react-router-dom'
import type { LinkProps, To } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'lg'

interface ButtonOwnProps {
  /** primary = volt, the screen's one main action. Default 'primary'. */
  variant?: ButtonVariant
  /** md = 44 px, lg = 56 px. Default 'md'. */
  size?: ButtonSize
  fullWidth?: boolean
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean
  /** Leading lucide icon. */
  icon?: LucideIcon
  className?: string
  children: ReactNode
}

type NativeButtonProps = ButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps> & {
    to?: undefined
    ref?: Ref<HTMLButtonElement>
  }

type RouterLinkProps = ButtonOwnProps &
  Omit<LinkProps, keyof ButtonOwnProps | 'to'> & {
    /** Renders a react-router <Link> styled as a button. */
    to: To
    disabled?: boolean
  }

export type ButtonProps = NativeButtonProps | RouterLinkProps

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-volt text-on-volt active:bg-volt-press',
  secondary: 'border border-border-strong bg-raised text-text active:bg-border',
  ghost: 'text-text active:bg-raised',
  danger: 'border border-danger/40 bg-danger/15 text-danger active:bg-danger/25',
}

const SIZE: Record<ButtonSize, string> = {
  md: 'min-h-tap px-4 text-base',
  lg: 'min-h-tap-lg px-5 text-lg',
}

/** Text button (or router link via `to`) in four variants; always ≥ 44 px tall. */
export function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    icon: Icon,
    className,
    children,
    ...rest
  } = props
  const classes = cx(
    'inline-flex select-none items-center justify-center gap-2 rounded-md font-semibold transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANT[variant],
    SIZE[size],
    fullWidth && 'w-full',
    className,
  )
  const iconSize = size === 'lg' ? 22 : 20
  const content = (
    <>
      {loading ? (
        <LoaderCircle size={iconSize} className="shrink-0 animate-spin" aria-hidden />
      ) : (
        Icon && <Icon size={iconSize} className="shrink-0" aria-hidden />
      )}
      <span className="truncate">{children}</span>
    </>
  )

  if (rest.to !== undefined) {
    const { to, disabled, ...linkRest } = rest
    if (disabled || loading) {
      return (
        <button type="button" disabled aria-busy={loading || undefined} className={classes}>
          {content}
        </button>
      )
    }
    return (
      <Link to={to} {...linkRest} className={classes}>
        {content}
      </Link>
    )
  }

  const { type = 'button', disabled, ...buttonRest } = rest
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonRest}
      className={classes}
    >
      {content}
    </button>
  )
}
