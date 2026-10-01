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
    let isScrolling = false
    let scrollTimeout: any = null

    // Adaptive mobile detection & FPS throttling
    const isMobile = window.innerWidth < 768
    const targetFPS = isMobile ? 24 : 60
    const frameInterval = 1000 / targetFPS
    let lastFrameTime = performance.now()

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

    // Scroll listener on mobile: pause canvas drawing during active scrolling for 60/120fps smooth scrolling
    const handleScroll = () => {
      if (!isMobile) return
      isScrolling = true
      if (scrollTimeout) clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        isScrolling = false
      }, 120)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    // Mouse tracking for interactive glow only on pointer-capable devices (desktop)
    let mouseX = -1000
    let mouseY = -1000
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }
    if (!isMobile) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true })
    }

    // ── 1. Candlesticks Initialization ───────────────────────────────────────
    let candles: Candle[] = []
    const initCandles = () => {
      candles = []
      // 10-14 candles on mobile, 16-35 on desktop
      const candleCount = isMobile
        ? Math.min(14, Math.max(10, Math.floor(width / 34)))
        : Math.max(16, Math.floor(width / 60))
      const spacing = width / candleCount

      // Base line undulates in an upward trend
      for (let i = 0; i < candleCount; i++) {
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
      // 15 particles on mobile vs 50 on desktop saves 70% CPU/GPU draw calls
      const count = isMobile
        ? Math.min(15, Math.floor(width / 26))
        : Math.min(50, Math.floor(width / 28))
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

    // ── 3. Main Render Loop with Adaptive Throttling & Auto-Pause ────────────
    const render = (currentTime: number) => {
      animId = requestAnimationFrame(render)

      // Auto-pause if tab is hidden, or any modal is open (document.body scroll locked), or scrolling on mobile
      const isModalOpen = document.body.style.overflow === 'hidden'
      if (!isVisible || isModalOpen || isScrolling) {
        return
      }

      // Delta-time FPS capping (e.g. 24 FPS on mobile vs 60 FPS on desktop)
      const elapsed = currentTime - lastFrameTime
      if (elapsed < frameInterval) {
        return
      }
      lastFrameTime = currentTime - (elapsed % frameInterval)

      ctx.clearRect(0, 0, width, height)
      step += isMobile ? 0.012 : 0.008

      // Step increment for sine waves (35px on mobile saves 50% lineTo calls)
      const waveStep = isMobile ? 36 : 20

      // ────────────────────────────────────────────────────────────────────────
      // STYLE 1: Dynamic Candlestick & Price Waves
      // ────────────────────────────────────────────────────────────────────────
      if (theme === 'candlestick') {
        const mult = intensityMultiplier

        // 1. Moving Average Wave 1 (Fast MA - Glowing Cyan & Emerald)
        ctx.beginPath()
        ctx.moveTo(0, height * 0.65)
        for (let x = 0; x <= width; x += waveStep) {
          const progress = x / width
          const baseTrend = height * 0.72 - progress * (height * 0.18)
          const y =
            baseTrend +
            Math.sin(x * 0.0035 + step * 1.1) * 38 +
            Math.cos(x * 0.007 + step * 0.7) * 22
          ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(6, 182, 212, ${0.28 * mult})`
        ctx.lineWidth = 2.2
        ctx.stroke()

        // 2. Moving Average Wave 2 (Slow MA - Royal Violet / Indigo)
        ctx.beginPath()
        ctx.moveTo(0, height * 0.7)
        for (let x = 0; x <= width; x += waveStep) {
          const progress = x / width
          const baseTrend = height * 0.76 - progress * (height * 0.15)
          const y =
            baseTrend +
            Math.cos(x * 0.003 + step * 0.8) * 44 +
            Math.sin(x * 0.0055 + step * 1.2) * 25
          ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(139, 92, 246, ${0.25 * mult})`
        ctx.lineWidth = 1.8
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
        ctx.setLineDash([])

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

          // Mouse proximity reaction (desktop only)
          const isNearMouse =
            !isMobile &&
            mouseX > -500 &&
            Math.hypot(mouseX - c.x, mouseY - liveY) < 160
          const proximityBoost = isNearMouse ? 0.35 : 0

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

          // Draw Wicks
          ctx.beginPath()
          ctx.moveTo(c.x, candleTop - c.wickTop)
          ctx.lineTo(c.x, candleBottom + c.wickBottom)
          ctx.strokeStyle = wickColor
          ctx.lineWidth = 1.4
          ctx.stroke()

          // Draw Body
          ctx.fillStyle = fillColor
          ctx.fillRect(c.x - c.w / 2, candleTop, c.w, c.bodyH)

          ctx.strokeStyle = strokeColor
          ctx.lineWidth = 1.2
          ctx.strokeRect(c.x - c.w / 2, candleTop, c.w, c.bodyH)

          // Core dot for near mouse or peak pulse
          if (isNearMouse || Math.sin(c.pulse) > 0.85) {
            ctx.beginPath()
            ctx.arc(c.x, liveY, 2.2, 0, Math.PI * 2)
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
        const ribbons = [
          { color: 'rgba(6, 182, 212,', speed: 1.0, amp: 55, yOffset: 0.55, width: 2.8 },
          { color: 'rgba(16, 185, 129,', speed: 0.8, amp: 45, yOffset: 0.62, width: 2.2 },
          { color: 'rgba(99, 102, 241,', speed: 1.2, amp: 65, yOffset: 0.48, width: 2.2 },
        ]

        ribbons.forEach((r, idx) => {
          ctx.beginPath()
          ctx.moveTo(0, height * r.yOffset)
          for (let x = 0; x <= width; x += waveStep) {
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
          p.x += p.vx * 1.2
          p.y += p.vy * 1.2
          p.pulse += 0.025

          if (p.y < -10) p.y = height + 10
          if (p.y > height + 10) p.y = -10
          if (p.x < -10) p.x = width + 10
          if (p.x > width + 10) p.x = -10

          const dx = mouseX - p.x
          const dy = mouseY - p.y
          const dist = !isMobile && mouseX > -500 ? Math.hypot(dx, dy) : 999
          let pAlpha = (p.alpha + Math.sin(p.pulse) * 0.1) * mult
          if (dist < 200) {
            pAlpha = Math.min(0.85, pAlpha + (1 - dist / 200) * 0.5)
          }

          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(139, 92, 246, ${pAlpha})`
          ctx.fill()

          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j]
            const lineDist = Math.hypot(p.x - p2.x, p.y - p2.y)
            if (lineDist < 120) {
              const lineAlpha = (1 - lineDist / 120) * 0.22 * mult
              ctx.beginPath()
              ctx.moveTo(p.x, p.y)
              ctx.lineTo(p2.x, p2.y)
              ctx.strokeStyle = `rgba(167, 139, 250, ${lineAlpha})`
              ctx.lineWidth = 0.9
              ctx.stroke()
            }
          }
        }
      }

      // ────────────────────────────────────────────────────────────────────────
      // STYLE 4: Fluid Mesh Gradient
      // ────────────────────────────────────────────────────────────────────────
      else if (theme === 'gradient') {
        const mult = intensityMultiplier
        const cx = width * 0.5 + Math.sin(step * 0.4) * (width * 0.15)
        const cy = height * 0.5 + Math.cos(step * 0.5) * (height * 0.15)

        const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, width * 0.55)
        grad.addColorStop(0, `rgba(99, 102, 241, ${0.14 * mult})`)
        grad.addColorStop(0.5, `rgba(6, 182, 212, ${0.08 * mult})`)
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)')

        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
      }
    }

    animId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll)
      if (!isMobile) {
        window.removeEventListener('mousemove', handleMouseMove)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (scrollTimeout) clearTimeout(scrollTimeout)
    }
  }, [theme, intensity])

  if (!isLoaded) return null

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
    >
      {/* ── 1. High-Performance GPU Ambient Glow Orbs (Pure Radial Gradients: 0% Blur GPU penalty) ── */}
      {theme !== 'minimal' && (
        <>
          <div
            className="absolute top-[-10%] left-[10%] w-[540px] h-[540px] rounded-full pointer-events-none transition-opacity duration-700 will-change-transform"
            style={{
              background:
                theme === 'candlestick'
                  ? 'radial-gradient(circle, rgba(16, 185, 129, 0.14) 0%, rgba(16, 185, 129, 0.04) 40%, transparent 70%)'
                  : theme === 'aurora'
                  ? 'radial-gradient(circle, rgba(6, 182, 212, 0.16) 0%, rgba(6, 182, 212, 0.05) 40%, transparent 70%)'
                  : theme === 'constellation'
                  ? 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 40%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(99, 102, 241, 0.14) 0%, rgba(99, 102, 241, 0.04) 40%, transparent 70%)',
              transform: 'translateZ(0)',
            }}
          />
          <div
            className="absolute top-[38%] right-[-8%] w-[580px] h-[580px] rounded-full pointer-events-none transition-opacity duration-700 will-change-transform"
            style={{
              background:
                theme === 'candlestick'
                  ? 'radial-gradient(circle, rgba(6, 182, 212, 0.11) 0%, rgba(6, 182, 212, 0.03) 45%, transparent 70%)'
                  : theme === 'aurora'
                  ? 'radial-gradient(circle, rgba(16, 185, 129, 0.13) 0%, rgba(16, 185, 129, 0.03) 45%, transparent 70%)'
                  : theme === 'constellation'
                  ? 'radial-gradient(circle, rgba(236, 72, 153, 0.10) 0%, rgba(236, 72, 153, 0.02) 45%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(16, 185, 129, 0.10) 0%, rgba(16, 185, 129, 0.03) 45%, transparent 70%)',
              transform: 'translateZ(0)',
            }}
          />
          <div
            className="absolute bottom-[-10%] left-[-6%] w-[480px] h-[480px] rounded-full pointer-events-none will-change-transform"
            style={{
              background:
                'radial-gradient(circle, rgba(99, 102, 241, 0.10) 0%, rgba(99, 102, 241, 0.02) 45%, transparent 70%)',
              transform: 'translateZ(0)',
            }}
          />
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

      {/* ── 4. Balanced Atmospheric Edge Vignette ── */}
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
