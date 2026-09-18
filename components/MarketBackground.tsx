'use client'

import React, { useEffect, useRef } from 'react'

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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)
    let isVisible = true

    // Resize handler
    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
      initCandles()
    }
    window.addEventListener('resize', handleResize)

    // Visibility change handler (save battery when tab is backgrounded)
    const handleVisibilityChange = () => {
      isVisible = !document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Mouse tracking for subtle interactive reaction
    let mouseX = -1000
    let mouseY = -1000
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }
    window.addEventListener('mousemove', handleMouseMove, { passive: true })

    // ── 1. Create Candlestick silhouettes ──────────────────────────────────
    let candles: Candle[] = []
    const initCandles = () => {
      candles = []
      const candleCount = Math.max(14, Math.floor(width / 75))
      const spacing = width / candleCount
      const baseY = height * 0.75

      for (let i = 0; i < candleCount; i++) {
        const isGreen = Math.sin(i * 1.3) > -0.1
        const bodyH = 15 + Math.random() * 45
        candles.push({
          x: i * spacing + spacing * 0.5,
          y: baseY + (Math.sin(i * 0.5) * 40),
          w: Math.min(14, spacing * 0.35),
          bodyH,
          targetBodyH: bodyH,
          wickTop: 10 + Math.random() * 25,
          wickBottom: 10 + Math.random() * 25,
          isGreen,
          speed: 0.015 + Math.random() * 0.02,
        })
      }
    }
    initCandles()

    // ── 2. Create Floating Price Nodes / Particles ──────────────────────────
    const particleCount = Math.min(45, Math.floor(width / 32))
    const particles: Particle[] = []
    for (let i = 0; i < particleCount; i++) {
      const isUp = Math.random() > 0.45
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: isUp ? -(0.2 + Math.random() * 0.4) : (0.15 + Math.random() * 0.3),
        size: 1 + Math.random() * 2,
        alpha: 0.15 + Math.random() * 0.25,
        isUp,
        pulse: Math.random() * Math.PI * 2,
      })
    }

    // ── 3. Wave parameters ───────────────────────────────────────────────────
    let waveStep = 0

    // ── Render loop ──────────────────────────────────────────────────────────
    const render = () => {
      if (!isVisible) {
        animId = requestAnimationFrame(render)
        return
      }

      ctx.clearRect(0, 0, width, height)

      // ─── A. Ambient Financial Trend Waves ──────────────────────────────────
      waveStep += 0.007

      // Wave 1: Subtle Emerald Bullish Wave (Soft green in background)
      ctx.beginPath()
      ctx.moveTo(0, height * 0.55)
      for (let x = 0; x <= width; x += 30) {
        const y =
          height * 0.58 +
          Math.sin(x * 0.003 + waveStep) * 45 +
          Math.cos(x * 0.006 + waveStep * 0.8) * 25
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.06)' // Emerald wave
      ctx.lineWidth = 2.5
      ctx.stroke()

      // Wave 2: Subtle Cyber Cyan/Indigo Wave
      ctx.beginPath()
      ctx.moveTo(0, height * 0.65)
      for (let x = 0; x <= width; x += 30) {
        const y =
          height * 0.62 +
          Math.cos(x * 0.0035 + waveStep * 0.7) * 50 +
          Math.sin(x * 0.005 + waveStep * 1.1) * 20
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.07)' // Indigo wave
      ctx.lineWidth = 2
      ctx.stroke()

      // ─── B. Background Candlesticks (Subtle outlines) ──────────────────────
      for (let i = 0; i < candles.length; i++) {
        const c = candles[i]

        // Smoothly oscillate candle height
        if (Math.abs(c.bodyH - c.targetBodyH) < 1) {
          c.targetBodyH = 12 + Math.random() * 50
        } else {
          c.bodyH += (c.targetBodyH - c.bodyH) * c.speed
        }

        const candleTop = c.y - c.bodyH / 2
        const candleBottom = c.y + c.bodyH / 2

        // Candle colors - extremely gentle so text is never compromised
        const strokeColor = c.isGreen
          ? 'rgba(52, 211, 153, 0.09)' // Emerald
          : 'rgba(251, 113, 133, 0.08)' // Rose
        const fillColor = c.isGreen
          ? 'rgba(16, 185, 129, 0.03)'
          : 'rgba(244, 63, 94, 0.025)'

        // Wick (Upper & Lower)
        ctx.beginPath()
        ctx.moveTo(c.x, candleTop - c.wickTop)
        ctx.lineTo(c.x, candleBottom + c.wickBottom)
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = 1
        ctx.stroke()

        // Candle Body
        ctx.fillStyle = fillColor
        ctx.fillRect(c.x - c.w / 2, candleTop, c.w, c.bodyH)
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = 1
        ctx.strokeRect(c.x - c.w / 2, candleTop, c.w, c.bodyH)
      }

      // ─── C. Constellation & Floating Price Particles ────────────────────────
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.pulse += 0.025

        // Wrap around bounds
        if (p.y < -10) {
          p.y = height + 10
          p.x = Math.random() * width
        } else if (p.y > height + 10) {
          p.y = -10
          p.x = Math.random() * width
        }
        if (p.x < -10) p.x = width + 10
        if (p.x > width + 10) p.x = -10

        // Proximity to mouse
        const dx = mouseX - p.x
        const dy = mouseY - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        let alpha = p.alpha + Math.sin(p.pulse) * 0.06
        if (dist < 180) {
          alpha = Math.min(0.5, alpha + (1 - dist / 180) * 0.3)
        }

        // Particle Dot
        const color = p.isUp
          ? `rgba(52, 211, 153, ${alpha})` // Green up
          : `rgba(244, 63, 94, ${alpha * 0.9})` // Red down

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()

        // Connecting lines between nearby nodes (Constellation effect)
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const pdist = Math.hypot(p.x - p2.x, p.y - p2.y)
          if (pdist < 110) {
            const lineAlpha = (1 - pdist / 110) * 0.05
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = `rgba(148, 163, 184, ${lineAlpha})`
            ctx.lineWidth = 0.75
            ctx.stroke()
          }
        }
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
  }, [])

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none"
    >
      {/* ── 1. Static FinTech Radial Glows (Deep Dark Atmospheric Ambience) ── */}
      <div className="absolute top-[-10%] left-[20%] w-[550px] h-[550px] rounded-full bg-indigo-600/[0.05] blur-[140px] pointer-events-none animate-pulse-slow" />
      <div className="absolute top-[40%] right-[-5%] w-[600px] h-[600px] rounded-full bg-emerald-500/[0.04] blur-[150px] pointer-events-none animate-pulse-slower" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-blue-600/[0.035] blur-[130px] pointer-events-none" />

      {/* ── 2. Subtle Financial Grid Pattern (TradingView / Bloomberg Style) ── */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* ── 3. Live Canvas with Moving Trend Waves, Candlesticks & Price Ticks ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />

      {/* ── 4. Deep Vignette Overlay (Guarantees zero interference with text) ── */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 50% 35%, transparent 0%, rgba(9, 11, 16, 0.45) 55%, rgba(9, 11, 16, 0.92) 100%)
          `,
        }}
      />
    </div>
  )
}
