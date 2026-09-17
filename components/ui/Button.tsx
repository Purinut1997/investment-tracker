import React from 'react'
import { Loader2 } from 'lucide-react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const variantStyles = {
    primary:
      'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 border border-indigo-500/30 active:scale-[0.98]',
    secondary:
      'bg-[#181C25] hover:bg-[#202532] text-slate-200 border border-white/[0.1] active:scale-[0.98]',
    ghost:
      'bg-transparent hover:bg-white/[0.06] text-slate-300 hover:text-white border border-transparent active:scale-[0.98]',
    danger:
      'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/25 border border-rose-500/30 active:scale-[0.98]',
  }

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 rounded-lg min-h-[34px] gap-1.5 font-medium',
    md: 'text-xs sm:text-sm px-4 py-2 rounded-xl min-h-[40px] gap-2 font-semibold',
    lg: 'text-sm sm:text-base px-5 py-2.5 rounded-xl min-h-[46px] gap-2.5 font-semibold',
  }

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  )
}
