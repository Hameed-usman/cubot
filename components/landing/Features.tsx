'use client'

import { GraduationCap, BookOpen, Phone, Globe, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

const features = [
  {
    icon: GraduationCap,
    title: 'Smart Admissions',
    desc: 'Instant guidance on admission requirements, eligibility criteria, and application deadlines.',
    color: 'bg-cu-navy',
    accentColor: '#1a3a8f',
    size: 'large',
  },
  {
    icon: BookOpen,
    title: 'Course Details',
    desc: 'Explore complete course structures, semester plans, and full curriculum breakdowns.',
    color: 'bg-cu-gold',
    accentColor: '#c9a227',
    size: 'small',
  },
  {
    icon: Phone,
    title: 'Contact Info',
    desc: 'Find department contacts, locations, and office hours instantly.',
    color: 'bg-cu-navy-deep',
    accentColor: '#0f2460',
    size: 'small',
  },
  {
    icon: Globe,
    title: 'Bilingual Support',
    desc: 'Ask questions in English or Urdu — Cubot understands and responds in your preferred language seamlessly.',
    color: 'bg-cu-navy-mid',
    accentColor: '#1e4db7',
    size: 'medium',
  },
  {
    icon: Sparkles,
    title: 'Learning System',
    desc: 'Cubot learns from feedback and continuously improves to give you better, more accurate answers over time.',
    color: 'bg-cu-gold-dark',
    accentColor: '#a8841e',
    size: 'medium',
  },
]

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

export function Features() {
  return (
    <section
      id="features"
      aria-label="Cubot features"
      className="py-28 px-6 relative"
      style={{
        background: 'linear-gradient(180deg, #080d1a 0%, #0d1526 50%, #080d1a 100%)',
      }}
    >
      {/* Background accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(26,58,143,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cu-gold/30 bg-cu-gold/5 text-cu-gold text-sm font-semibold font-display tracking-wide mb-5">
            ✦ Capabilities
          </div>
          <h2 className="font-display font-extrabold text-4xl md:text-5xl text-white mb-4 leading-tight">
            Why Choose{' '}
            <span className="gradient-text">Cubot?</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto font-sans">
            A smarter, faster way to navigate university life — from admissions to graduation.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => {
            const Icon = feature.icon
            return (
              <motion.article
                key={feature.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={cardVariants}
                className={`glass-card rounded-3xl p-7 flex flex-col gap-5 group cursor-default ${
                  feature.size === 'large' ? 'lg:col-span-2 lg:row-span-1' :
                  feature.size === 'medium' ? 'md:col-span-1' : ''
                }`}
                aria-label={feature.title}
              >
                {/* Icon */}
                <div
                  className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-lg`}
                >
                  <Icon className="w-7 h-7 text-white" aria-hidden="true" />
                </div>

                {/* Content */}
                <div>
                  <h3 className="font-display font-bold text-xl text-white mb-2 group-hover:text-cu-gold transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-white/50 text-sm leading-relaxed font-sans">
                    {feature.desc}
                  </p>
                </div>

                {/* Gold accent line on hover */}
                <div
                  className="h-px bg-gradient-to-r from-cu-gold/0 via-cu-gold/40 to-cu-gold/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full"
                  aria-hidden="true"
                />
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
