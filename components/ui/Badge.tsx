import React from 'react'

export type BadgeVariant =
  | 'indigo'
  | 'emerald'
  | 'rose'
  | 'amber'
  | 'cyan'
  | 'slate'
  | 'outline'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: 'sm' | 'md'
  className?: string
}

export function Badge({
  children,
  variant = 'slate',
  size = 'sm',
  className = '',
  ...props
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    slate: 'bg-slate-800/80 text-slate-300 border-slate-700/80',
    outline: 'bg-transparent text-slate-400 border-white/10',
  }

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 rounded-md font-medium tracking-wide',
    md: 'text-xs px-2.5 py-1 rounded-lg font-semibold tracking-wide',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 border font-mono ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
