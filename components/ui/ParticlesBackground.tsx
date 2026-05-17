'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export function ParticlesBackground() {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; duration: number; delay: number }>>([])

  useEffect(() => {
    // Generate random particles
    const newParticles = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // percentage
      y: Math.random() * 100, // percentage
      size: Math.random() * 4 + 1, // 1 to 5 px
      duration: Math.random() * 20 + 10, // 10 to 30 seconds
      delay: Math.random() * 5, // 0 to 5 seconds
    }))
    setParticles(newParticles)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-white/20"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            boxShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
          }}
          animate={{
            y: [0, -1000],
            x: [0, Math.random() * 100 - 50],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "linear",
          }}
        />
      ))}
    </div>
  )
}
