import React from 'react'

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  as?: 'div' | 'section' | 'article'
  tone?: 'default' | 'muted' | 'accent'
}

export function Surface({ children, as = 'div', tone = 'default', className = '', ...props }: SurfaceProps) {
  const Component = as
  return (
    <Component className={`surface surface-${tone} ${className}`} {...props}>
      {children}
    </Component>
  )
}
