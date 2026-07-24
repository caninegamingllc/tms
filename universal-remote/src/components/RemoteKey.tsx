import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'accent' | 'danger' | 'ghost'
  children?: ReactNode
}

const sizes = {
  sm: 'h-10 min-w-10 px-3 text-xs',
  md: 'h-12 min-w-12 px-3 text-sm',
  lg: 'h-14 min-w-14 px-4 text-sm',
  xl: 'h-16 min-w-16 px-4 text-base',
}

export function RemoteKey({
  label,
  size = 'md',
  variant = 'default',
  className,
  children,
  onClick,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={clsx(
        'relative inline-flex select-none flex-col items-center justify-center rounded-2xl font-medium tracking-wide transition active:scale-[0.96]',
        sizes[size],
        variant === 'default' &&
          'bg-[var(--key)] text-[var(--key-label)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_0_#12161e] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_2px_0_#12161e] active:translate-y-[4px]',
        variant === 'accent' &&
          'bg-[var(--accent-dim)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_6px_0_#1b6b48] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_0_#1b6b48] active:translate-y-[4px]',
        variant === 'danger' &&
          'bg-[#5a2a2a] text-[#ffd0d0] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_0_#3a1818] active:translate-y-[4px]',
        variant === 'ghost' &&
          'bg-transparent text-[var(--muted)] shadow-none active:scale-95',
        className,
      )}
      onClick={(e) => {
        const el = e.currentTarget
        el.classList.remove('key-flash')
        void el.offsetWidth
        el.classList.add('key-flash')
        onClick?.(e)
      }}
      {...rest}
    >
      {children}
      {label ? (
        <span className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
          {label}
        </span>
      ) : null}
    </button>
  )
}
