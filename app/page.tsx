import type { Metadata } from 'next'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { CTABanner } from '@/components/landing/CTABanner'
import { Footer } from '@/components/layout/Footer'
import { ToastProvider } from '@/components/ui/Toast'

export const metadata: Metadata = {
  title: 'Cubot — AI Chatbot for City University Peshawar',
  description:
    'Cubot is the official AI assistant of City University Peshawar. Get instant answers about admissions, courses, fees, faculty, and more. Available 24/7 in English and Urdu.',
}

export default function HomePage() {
  return (
    <>
      <ToastProvider />
      <div className="min-h-screen bg-cu-dark">
        <Hero />
        <Features />
        <CTABanner />
        <Footer />
      </div>
    </>
  )
}