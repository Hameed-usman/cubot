'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { MessageCircle, ChevronDown, Cpu } from 'lucide-react'

interface Node { x: number; y: number; vx: number; vy: number; r: number }

function initCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  const NUM = 60
  const nodes: Node[] = Array.from({ length: NUM }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
    r: Math.random() * 2 + 1,
  }))
  let rafId: number, lastTime = 0
  const draw = (time: number) => {
    if (document.hidden) { rafId = requestAnimationFrame(draw); return }
    const dt = Math.min(time - lastTime, 32); lastTime = time
    ctx.clearRect(0, 0, W, H)
    for (const n of nodes) {
      n.x += n.vx * (dt / 16); n.y += n.vy * (dt / 16)
      if (n.x < 0 || n.x > W) n.vx *= -1
      if (n.y < 0 || n.y > H) n.vy *= -1
    }
    for (let i = 0; i < NUM; i++) {
      for (let j = i + 1; j < NUM; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 140) {
          const alpha = (1 - dist / 140) * 0.25
          ctx.beginPath()
          ctx.strokeStyle = (i + j) % 3 === 0 ? `rgba(201,162,39,${alpha})` : `rgba(26,58,143,${alpha * 2})`
          ctx.lineWidth = 0.8
          ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke()
        }
      }
    }
    for (let i = 0; i < NUM; i++) {
      ctx.beginPath(); ctx.arc(nodes[i].x, nodes[i].y, nodes[i].r, 0, Math.PI * 2)
      ctx.fillStyle = i % 5 === 0 ? 'rgba(201,162,39,0.7)' : 'rgba(100,140,255,0.5)'; ctx.fill()
    }
    rafId = requestAnimationFrame(draw)
  }
  rafId = requestAnimationFrame(draw)
  return () => cancelAnimationFrame(rafId)
}

export function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight
    const cleanup = initCanvas(canvas)
    const onResize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    window.addEventListener('resize', onResize)
    return () => { cleanup?.(); window.removeEventListener('resize', onResize) }
  }, [])

  return (
    <section aria-label="Hero" className="relative min-h-screen flex items-center justify-center overflow-hidden hero-bg">
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full opacity-60" />
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] bg-cu-navy/40" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full blur-[100px] bg-cu-gold/10" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16 pt-20 pb-16">
        <div className="flex-1 text-center lg:text-left">

          {/* Initiative badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cu-gold/10 border border-cu-gold/20 text-cu-gold/80 text-xs font-sans font-medium mb-3">
            <Cpu className="w-3 h-3" aria-hidden="true" />
            An Initiative of IT &amp; Robotics Society — CUSIT
          </div>

          {/* Official badge */}
          <div className="flex justify-center lg:justify-start mb-8">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full glass-dark border border-cu-gold/30 text-sm font-semibold text-cu-gold font-display tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-cu-gold animate-pulse" />
              ✦ Official AI Assistant — City University Peshawar
            </div>
          </div>

          <h1 className="font-display font-extrabold leading-[1.05] mb-6">
            <span className="block text-6xl md:text-7xl xl:text-8xl gradient-text">Meet Cubot</span>
            <span className="block text-5xl md:text-6xl xl:text-7xl text-white mt-2">Your University Guide</span>
          </h1>

          <p className="text-lg md:text-xl text-white/65 mb-10 max-w-xl font-sans leading-relaxed mx-auto lg:mx-0">
            Intelligent, bilingual, and always ready to guide you through university life. Ask anything, anytime.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link href="/chat" aria-label="Start a conversation with Cubot"
              className="btn-gold inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full text-cu-dark font-bold text-lg font-display">
              <MessageCircle className="w-5 h-5" />
              Start Conversation
              <span className="text-cu-dark/70">→</span>
            </Link>
            <a href="#features" aria-label="Explore Cubot features"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full glass-dark border border-white/20 text-white font-semibold text-lg font-display hover:border-white/40 hover:bg-white/5 transition-all">
              Explore Features
            </a>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center lg:justify-start gap-8 mt-14">
            {[{ value: '5+', label: 'Departments' }, { value: '24/7', label: 'Available' }, { value: '2', label: 'Languages' }].map((stat) => (
              <div key={stat.label} className="text-center lg:text-left">
                <div className="font-display font-extrabold text-4xl gradient-text mb-1">{stat.value}</div>
                <div className="text-white/50 text-sm font-sans">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Robot mascot */}
        <div className="hidden lg:flex flex-col items-center justify-center flex-shrink-0 float-anim" aria-hidden="true">
          <div className="relative w-56 h-64 group cursor-default select-none">
            <div className="absolute inset-0 rounded-[40%] blur-2xl bg-cu-navy/50 scale-110" />
            <div className="relative w-full h-full flex flex-col items-center justify-center gap-3">
              <div className="relative w-36 h-28 rounded-[30%] bg-gradient-to-b from-[#1e3a7a] to-[#0f2460] border border-cu-navy-mid/60 shadow-navy-glow flex items-center justify-center flex-col gap-2">
                <div className="flex gap-5 mt-2">
                  {[0, 1].map(i => (
                    <div key={i} className="w-6 h-6 rounded-full bg-cu-dark border-2 border-cu-gold/60 flex items-center justify-center group-hover:border-cu-gold transition-colors duration-300">
                      <div className="w-2.5 h-2.5 rounded-full bg-cu-gold group-hover:bg-cu-gold-light transition-colors" />
                    </div>
                  ))}
                </div>
                <div className="w-12 h-1.5 rounded-full bg-cu-gold/50 group-hover:bg-cu-gold transition-colors duration-300" />
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-cu-gold animate-pulse" />
                  <div className="w-0.5 h-4 bg-cu-gold/60" />
                </div>
              </div>
              <div className="w-28 h-20 rounded-[24%] bg-gradient-to-b from-[#1a3a8f] to-[#0f2460] border border-cu-navy-mid/50 flex items-center justify-center">
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-2 h-2 rounded-sm" style={{ background: i % 2 === 0 ? 'rgba(201,162,39,0.7)' : 'rgba(100,140,255,0.4)' }} />
                  ))}
                </div>
              </div>
              <div className="px-3 py-1 rounded-full bg-cu-gold/15 border border-cu-gold/30 text-cu-gold text-xs font-semibold font-display tracking-widest">CUBOT</div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 text-xs font-sans" aria-hidden="true">
        <span>Scroll</span>
        <div className="w-6 h-10 border border-white/20 rounded-full flex justify-center pt-2">
          <div className="w-1 h-2 bg-cu-gold rounded-full animate-bounce" />
        </div>
        <ChevronDown className="w-4 h-4 animate-bounce" />
      </div>
    </section>
  )
}
