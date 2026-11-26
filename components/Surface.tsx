import React from 'react'

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  as?: 'div' | 'section' | 'article'
  tone?: 'default' | 'muted' | 'accent'
}

export function Surface({ children, as = 'div', tone = 'default', className = '', ...props }: SurfaceProps) {
  const Component = as

  let toneClass = 'glass-panel'
  if (tone === 'muted') {
    toneClass = 'glass-panel-subtle'
  } else if (tone === 'accent') {
    toneClass = 'glass-panel border-indigo-500/40'
  }

  return (
    <Component className={`rounded-2xl ${toneClass} ${className}`} {...props}>
      {children}
    </Component>
  )
}
