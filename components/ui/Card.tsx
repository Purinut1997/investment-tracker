import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  variant?: 'default' | 'elevated' | 'subtle'
  className?: string
}

export function Card({
  children,
  variant = 'default',
  className = '',
  ...props
}: CardProps) {
  const variantStyles = {
    default: 'bg-[#12151C] border border-white/[0.08] shadow-xl shadow-black/40',
    elevated: 'bg-[#181C25] border border-white/[0.12] shadow-2xl shadow-black/60',
    subtle: 'bg-[#0E1117] border border-white/[0.05]',
  }

  return (
    <div
      className={`rounded-2xl transition-all duration-200 ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
