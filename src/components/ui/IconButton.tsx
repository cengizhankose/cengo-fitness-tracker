import type { ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import type { LinkProps, To } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cx } from './cx'

export type IconButtonVariant = 'ghost' | 'secondary' | 'primary' | 'danger'

interface IconButtonOwnProps {
  icon: LucideIcon
  /** Required: the button has no visible text. */
  'aria-label': string
  /** Default 'ghost'. */
  variant?: IconButtonVariant
  /** md = 44 px, lg = 56 px square. Default 'md'. */
  size?: 'md' | 'lg'
  className?: string
}

type NativeIconButtonProps = IconButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof IconButtonOwnProps | 'children'> & {
    to?: undefined
  }

type LinkIconButtonProps = IconButtonOwnProps &
  Omit<LinkProps, keyof IconButtonOwnProps | 'children' | 'to'> & { to: To }

export type IconButtonProps = NativeIconButtonProps | LinkIconButtonProps

const VARIANT: Record<IconButtonVariant, string> = {
  ghost: 'text-text active:bg-raised',
  secondary: 'border border-border-strong bg-raised text-text active:bg-border',
  primary: 'bg-volt text-on-volt active:bg-volt-press',
  danger: 'text-danger active:bg-danger/15',
}

/** Round icon-only button or router link; requires an aria-label. */
export function IconButton(props: IconButtonProps) {
  const { icon: Icon, variant = 'ghost', size = 'md', className, ...rest } = props
  const classes = cx(
    'inline-grid shrink-0 select-none place-items-center rounded-full transition-colors disabled:opacity-40',
    size === 'lg' ? 'size-tap-lg' : 'size-tap',
    VARIANT[variant],
    className,
  )
  const glyph = <Icon size={size === 'lg' ? 26 : 22} aria-hidden />

  if (rest.to !== undefined) {
    return (
      <Link {...rest} to={rest.to} className={classes}>
        {glyph}
      </Link>
    )
  }
  const { type = 'button', ...buttonRest } = rest
  return (
    <button type={type} {...buttonRest} className={classes}>
      {glyph}
    </button>
  )
}
