import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Inter, Noto_Nastaliq_Urdu } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const notoNastaliqUrdu = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-urdu',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Cubot — City University Peshawar AI Assistant',
    template: '%s | Cubot CU',
  },
  description:
    'Cubot is the official AI-powered assistant of City University Peshawar. Get instant answers about admissions, courses, fees, departments, and campus life.',
  keywords: [
    'City University Peshawar',
    'CU Peshawar',
    'university assistant',
    'AI chatbot',
    'admissions',
    'Cubot',
  ],
  authors: [{ name: 'City University Peshawar' }],
  openGraph: {
    type: 'website',
    url: process.env.NEXT_PUBLIC_BASE_URL || 'https://cubot-cu.vercel.app',
    siteName: 'Cubot — City University Peshawar',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-image.png'],
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || 'https://cubot-cu.vercel.app'
  ),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${notoNastaliqUrdu.variable} font-sans`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}