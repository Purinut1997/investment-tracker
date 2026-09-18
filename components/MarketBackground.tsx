'use client'

import React, { useEffect, useRef } from 'react'
import { useBackgroundTheme } from '@/lib/theme/background-context'

interface Candle {
  x: number
  y: number
  w: number
  bodyH: number
  targetBodyH: number
  wickTop: number
  wickBottom: number
  isGreen: boolean
  speed: number
  pulse: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  isUp: boolean
  pulse: number
}

export function MarketBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { theme, intensity, isLoaded } = useBackgroundTheme()

  useEffect(() => {
    // If minimal theme, do not run canvas animation loop
    if (theme === 'minimal') {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)
    let isVisible = true

    // Multiplier based on intensity setting
    const intensityMultiplier =
      intensity === 'vivid' ? 1.4 : intensity === 'subtle' ? 0.65 : 1.0

    // Resize handler
    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
      initElements()
    }
    window.addEventListener('resize', handleResize)

    // Visibility change handler (save battery when tab is backgrounded)
    const handleVisibilityChange = () => {
      isVisible = !document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Mouse tracking for interactive glow and reaction
    let mouseX = -1000
    let mouseY = -1000
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }
    window.addEventListener('mousemove', handleMouseMove, { passive: true })

    // ── 1. Candlesticks Initialization ───────────────────────────────────────
    let candles: Candle[] = []
    const initCandles = () => {
      candles = []
      // 18-35 candles depending on screen width
      const candleCount = Math.max(16, Math.floor(width / 60))
      const spacing = width / candleCount

      // Base line undulates in an upward trend
      for (let i = 0; i < candleCount; i++) {
        // Financial market sine curve: trending upwards with natural waves
        const progress = i / candleCount
        const trendY = height * 0.72 - progress * (height * 0.18)
        const waveOffset =
          Math.sin(i * 0.65) * 35 + Math.cos(i * 1.2) * 20

        const isGreen = Math.sin(i * 1.15 + 0.4) > -0.2
        const bodyH = 20 + Math.random() * 55

        candles.push({
          x: i * spacing + spacing * 0.5,
          y: trendY + waveOffset,
          w: Math.min(18, Math.max(10, spacing * 0.42)),
          bodyH,
          targetBodyH: bodyH,
          wickTop: 12 + Math.random() * 32,
          wickBottom: 12 + Math.random() * 32,
          isGreen,
          speed: 0.015 + Math.random() * 0.02,
          pulse: Math.random() * Math.PI * 2,
        })
      }
    }

    // ── 2. Particles Initialization ──────────────────────────────────────────
    let particles: Particle[] = []
    const initParticles = () => {
      particles = []
      const count = Math.min(50, Math.floor(width / 28))
      for (let i = 0; i < count; i++) {
        const isUp = Math.random() > 0.4
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.35,
          vy: isUp ? -(0.25 + Math.random() * 0.45) : 0.15 + Math.random() * 0.35,
          size: 1.5 + Math.random() * 2.2,
          alpha: 0.25 + Math.random() * 0.35,
          isUp,
          pulse: Math.random() * Math.PI * 2,
        })
      }
    }

    const initElements = () => {
      initCandles()
      initParticles()
    }
    initElements()

    // Animation state
    let step = 0

    // ── 3. Main Render Loop ───────────────────────────────────────────────────
    const render = () => {
      if (!isVisible) {
        animId = requestAnimationFrame(render)
        return
      }

      ctx.clearRect(0, 0, width, height)
      step += 0.008

      // ────────────────────────────────────────────────────────────────────────
      // STYLE 1: Dynamic Candlestick & Price Waves
      // ────────────────────────────────────────────────────────────────────────
      if (theme === 'candlestick') {
        const mult = intensityMultiplier

        // 1. Moving Average Wave 1 (Fast MA - Vibrant Cyan & Emerald)
        ctx.beginPath()
        ctx.moveTo(0, height * 0.65)
        for (let x = 0; x <= width; x += 20) {
          const progress = x / width
          const baseTrend = height * 0.72 - progress * (height * 0.18)
          const y =
            baseTrend +
            Math.sin(x * 0.0035 + step * 1.1) * 38 +
            Math.cos(x * 0.007 + step * 0.7) * 22
          ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(6, 182, 212, ${0.28 * mult})` // Glowing Cyan
        ctx.lineWidth = 2.5
        ctx.stroke()

        // 2. Moving Average Wave 2 (Slow MA - Royal Violet / Indigo)
        ctx.beginPath()
        ctx.moveTo(0, height * 0.7)
        for (let x = 0; x <= width; x += 20) {
          const progress = x / width
          const baseTrend = height * 0.76 - progress * (height * 0.15)
          const y =
            baseTrend +
            Math.cos(x * 0.003 + step * 0.8) * 44 +
            Math.sin(x * 0.0055 + step * 1.2) * 25
          ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(139, 92, 246, ${0.25 * mult})` // Glowing Violet
        ctx.lineWidth = 2.0
        ctx.stroke()

        // 3. Floating Horizontal Price Level Reference Line (Dashed)
        const priceY = height * 0.55 + Math.sin(step * 0.5) * 15
        ctx.beginPath()
        ctx.setLineDash([6, 8])
        ctx.moveTo(0, priceY)
        ctx.lineTo(width, priceY)
        ctx.strokeStyle = `rgba(16, 185, 129, ${0.16 * mult})`
        ctx.lineWidth = 1.2
        ctx.stroke()
        ctx.setLineDash([]) // Reset line dash

        // 4. Dynamic Candlesticks
        for (let i = 0; i < candles.length; i++) {
          const c = candles[i]
          c.pulse += 0.03

          // Dynamically oscillate candle height with organic market action
          if (Math.abs(c.bodyH - c.targetBodyH) < 1.5) {
            c.targetBodyH = 15 + Math.random() * 60
          } else {
            c.bodyH += (c.targetBodyH - c.bodyH) * c.speed
          }

          // Gentle breathing drift on Y
          const liveY = c.y + Math.sin(c.pulse + i * 0.5) * 6
          const candleTop = liveY - c.bodyH / 2
          const candleBottom = liveY + c.bodyH / 2

          // Mouse proximity reaction (Illuminates and rises slightly)
          const dx = mouseX - c.x
          const dy = mouseY - liveY
          const dist = Math.sqrt(dx * dx + dy * dy)
          const isNearMouse = dist < 160
          const proximityBoost = isNearMouse ? (1 - dist / 160) * 0.45 : 0

          const wickAlpha = (c.isGreen ? 0.45 : 0.38) * mult + proximityBoost
          const bodyFillAlpha = (c.isGreen ? 0.22 : 0.18) * mult + proximityBoost * 0.8
          const strokeAlpha = (c.isGreen ? 0.65 : 0.55) * mult + proximityBoost

          const wickColor = c.isGreen
            ? `rgba(52, 211, 153, ${wickAlpha})`
            : `rgba(251, 113, 133, ${wickAlpha})`
          const fillColor = c.isGreen
            ? `rgba(16, 185, 129, ${bodyFillAlpha})`
            : `rgba(244, 63, 94, ${bodyFillAlpha})`
          const strokeColor = c.isGreen
            ? `rgba(52, 211, 153, ${strokeAlpha})`
            : `rgba(251, 113, 133, ${strokeAlpha})`

          // Draw Wicks (Upper & Lower)
          ctx.beginPath()
          ctx.moveTo(c.x, candleTop - c.wickTop)
          ctx.lineTo(c.x, candleBottom + c.wickBottom)
          ctx.strokeStyle = wickColor
          ctx.lineWidth = 1.5
          ctx.stroke()

          // Draw Body with soft radial/linear glow
          ctx.fillStyle = fillColor
          ctx.fillRect(c.x - c.w / 2, candleTop, c.w, c.bodyH)

          ctx.strokeStyle = strokeColor
          ctx.lineWidth = 1.4
          ctx.strokeRect(c.x - c.w / 2, candleTop, c.w, c.bodyH)

          // Extra luminous core dot for candles near mouse or peak pulses
          if (isNearMouse || Math.sin(c.pulse) > 0.8) {
            ctx.beginPath()
            ctx.arc(c.x, liveY, 2.5, 0, Math.PI * 2)
            ctx.fillStyle = c.isGreen
              ? `rgba(110, 231, 183, ${0.7 * mult})`
              : `rgba(253, 164, 175, ${0.65 * mult})`
            ctx.fill()
          }
        }

        // 5. Floating Ticker Nodes / Market Dust
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          p.x += p.vx
          p.y += p.vy
          p.pulse += 0.025

          if (p.y < -10) p.y = height + 10
          if (p.y > height + 10) p.y = -10
          if (p.x < -10) p.x = width + 10
          if (p.x > width + 10) p.x = -10

          const alpha = (p.alpha + Math.sin(p.pulse) * 0.12) * mult
          const pColor = p.isUp
            ? `rgba(52, 211, 153, ${alpha})`
            : `rgba(244, 63, 94, ${alpha * 0.9})`

          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fillStyle = pColor
          ctx.fill()
        }
      }

      // ────────────────────────────────────────────────────────────────────────
      // STYLE 2: Cyber Aurora & Trading Grid
      // ────────────────────────────────────────────────────────────────────────
      else if (theme === 'aurora') {
        const mult = intensityMultiplier

        // Flowing Aurora Waves
        const ribbons = [
          { color: 'rgba(6, 182, 212,', speed: 1.0, amp: 55, yOffset: 0.55, width: 3.0 },
          { color: 'rgba(16, 185, 129,', speed: 0.8, amp: 45, yOffset: 0.62, width: 2.5 },
          { color: 'rgba(99, 102, 241,', speed: 1.2, amp: 65, yOffset: 0.48, width: 2.5 },
        ]

        ribbons.forEach((r, idx) => {
          ctx.beginPath()
          ctx.moveTo(0, height * r.yOffset)
          for (let x = 0; x <= width; x += 25) {
            const y =
              height * r.yOffset +
              Math.sin(x * 0.003 + step * r.speed + idx) * r.amp +
              Math.cos(x * 0.006 + step * 0.6) * (r.amp * 0.5)
            ctx.lineTo(x, y)
          }
          ctx.strokeStyle = `${r.color} ${0.32 * mult})`
          ctx.lineWidth = r.width
          ctx.stroke()
        })
      }

      // ────────────────────────────────────────────────────────────────────────
      // STYLE 3: Interactive Constellation
      // ────────────────────────────────────────────────────────────────────────
      else if (theme === 'constellation') {
        const mult = intensityMultiplier

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          p.x += p.vx * 1.3
          p.y += p.vy * 1.3
          p.pulse += 0.025

          if (p.y < -10) p.y = height + 10
          if (p.y > height + 10) p.y = -10
          if (p.x < -10) p.x = width + 10
          if (p.x > width + 10) p.x = -10

          const dx = mouseX - p.x
          const dy = mouseY - p.y
          const dist = Math.hypot(dx, dy)
          let pAlpha = (p.alpha + Math.sin(p.pulse) * 0.1) * mult
          if (dist < 200) {
            pAlpha = Math.min(0.85, pAlpha + (1 - dist / 200) * 0.5)
          }

          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size + (dist < 150 ? 1 : 0), 0, Math.PI * 2)
          ctx.fillStyle = `rgba(139, 92, 246, ${pAlpha})`
          ctx.fill()

          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j]
            const lineDist = Math.hypot(p.x - p2.x, p.y - p2.y)
            if (lineDist < 130) {
              const lineAlpha = (1 - lineDist / 130) * 0.22 * mult
              ctx.beginPath()
              ctx.moveTo(p.x, p.y)
              ctx.lineTo(p2.x, p2.y)
              ctx.strokeStyle = `rgba(167, 139, 250, ${lineAlpha})`
              ctx.lineWidth = 1.0
              ctx.stroke()
            }
          }
        }
      }

      // ────────────────────────────────────────────────────────────────────────
      // STYLE 4: Fluid Mesh Gradient (Canvas-assisted smooth aura)
      // ────────────────────────────────────────────────────────────────────────
      else if (theme === 'gradient') {
        const mult = intensityMultiplier
        const cx = width * 0.5 + Math.sin(step * 0.4) * (width * 0.15)
        const cy = height * 0.5 + Math.cos(step * 0.5) * (height * 0.15)

        const grad = ctx.createRadialGradient(cx, cy, 50, cx, cy, width * 0.55)
        grad.addColorStop(0, `rgba(99, 102, 241, ${0.14 * mult})`)
        grad.addColorStop(0.5, `rgba(6, 182, 212, ${0.08 * mult})`)
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)')

        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
      }

      animId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [theme, intensity])

  if (!isLoaded) return null

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
    >
      {/* ── 1. Atmospheric Ambient Glow Orbs (Rich FinTech Depth) ── */}
      {theme !== 'minimal' && (
        <>
          <div
            className={`absolute top-[-8%] left-[15%] w-[620px] h-[620px] rounded-full blur-[130px] pointer-events-none transition-opacity duration-700 ${
              theme === 'candlestick'
                ? 'bg-emerald-600/[0.12]'
                : theme === 'aurora'
                ? 'bg-cyan-600/[0.14]'
                : theme === 'constellation'
                ? 'bg-violet-600/[0.13]'
                : 'bg-indigo-600/[0.12]'
            }`}
          />
          <div
            className={`absolute top-[42%] right-[-6%] w-[680px] h-[680px] rounded-full blur-[140px] pointer-events-none transition-opacity duration-700 ${
              theme === 'candlestick'
                ? 'bg-cyan-600/[0.09]'
                : theme === 'aurora'
                ? 'bg-emerald-500/[0.11]'
                : theme === 'constellation'
                ? 'bg-pink-600/[0.09]'
                : 'bg-emerald-600/[0.10]'
            }`}
          />
          <div className="absolute bottom-[-12%] left-[-6%] w-[580px] h-[580px] rounded-full bg-indigo-600/[0.08] blur-[130px] pointer-events-none" />
        </>
      )}

      {/* ── 2. High-Tech Financial Grid Pattern (Visible & Crisp) ── */}
      {theme !== 'minimal' && (
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${
            theme === 'candlestick'
              ? 'opacity-[0.065]'
              : theme === 'aurora'
              ? 'opacity-[0.08]'
              : 'opacity-[0.045]'
          }`}
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255, 255, 255, 0.15) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: '54px 54px',
          }}
        />
      )}

      {/* ── 3. Live Canvas Renderer ── */}
      {theme !== 'minimal' && (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      )}

      {/* ── 4. Balanced Atmospheric Edge Vignette (Gentle edge roll-off, never crushing center) ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            theme === 'minimal'
              ? '#090B10'
              : 'radial-gradient(ellipse at 50% 40%, transparent 25%, rgba(9, 11, 16, 0.25) 70%, rgba(9, 11, 16, 0.72) 100%)',
        }}
      />
    </div>
  )
}
