'use client'

import React from 'react'

export function parseInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return []
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2).replace(/\*{1,2}/g, '').trim()
      return (
        <strong key={i} className="text-white font-semibold">
          {content}
        </strong>
      )
    }
    // Clean any stray asterisks
    const cleaned = part.replace(/\*{1,2}/g, '')
    return cleaned
  })
}

export function FormattedCopilotMessage({ content }: { content: string }) {
  if (!content) return null

  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listBuffer: Array<{ type: 'bullet' | 'number'; num?: string; text: string }> = []

  const flushList = (keyPrefix: string) => {
    if (listBuffer.length === 0) return
    const currentList = [...listBuffer]
    listBuffer = []

    elements.push(
      <div key={`list-${keyPrefix}`} className="space-y-2.5 my-2 pl-1">
        {currentList.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
            {item.type === 'bullet' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0 shadow-sm shadow-indigo-400/50" />
            ) : (
              <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 border border-indigo-500/30">
                {item.num}
              </span>
            )}
            <div className="flex-1">{parseInlineMarkdown(item.text)}</div>
          </div>
        ))}
      </div>
    )
  }

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim()

    if (!line) {
      flushList(`gap-${idx}`)
      return
    }

    // Horizontal divider (-- or --- or ***)
    if (/^[-*_]{2,}$/.test(line)) {
      flushList(`hr-${idx}`)
      elements.push(<div key={`hr-${idx}`} className="border-t border-white/[0.08] my-3" />)
      return
    }

    // Header 1/2/3/4 (# / ## / ###) or Header enclosed entirely in **Header:**
    const headerMatch = line.match(/^#{1,4}\s+(.+)$/)
    const standaloneBoldHeaderMatch = line.match(/^\*\*([^*]+)\*\*$/)

    if (headerMatch || standaloneBoldHeaderMatch) {
      flushList(`header-${idx}`)
      const rawTitle = headerMatch ? headerMatch[1] : standaloneBoldHeaderMatch![1]
      const cleanTitle = rawTitle.replace(/^#+\s*/, '').replace(/\*{1,2}/g, '').trim()
      elements.push(
        <div key={`h-${idx}`} className="pt-3 pb-1">
          <h4 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2 border-b border-white/[0.06] pb-1.5">
            <span className="w-1.5 h-4 rounded-full bg-indigo-500 inline-block" />
            <span>{cleanTitle}</span>
          </h4>
        </div>
      )
      return
    }

    // Numbered list item (e.g. "1. " or "1) ")
    const numMatch = line.match(/^(\d+)[\.\)]\s+(.+)$/)
    if (numMatch) {
      listBuffer.push({ type: 'number', num: numMatch[1], text: numMatch[2] })
      return
    }

    // Bullet list item (e.g. "* ", "- ", "• ")
    const bulletMatch = line.match(/^[\*\-•]\s*(.+)$/)
    if (bulletMatch) {
      listBuffer.push({ type: 'bullet', text: bulletMatch[1] })
      return
    }

    // Regular paragraph
    flushList(`p-${idx}`)
    elements.push(
      <p key={`p-${idx}`} className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
        {parseInlineMarkdown(line)}
      </p>
    )
  })

  flushList('end')

  return <div className="space-y-2 font-sans">{elements}</div>
}
