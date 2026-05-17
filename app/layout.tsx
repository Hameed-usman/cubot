import type { Metadata } from 'next'
import { Syne, DM_Sans, Noto_Nastaliq_Urdu } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

const syne = Syne({ subsets: ['latin'], variable: '--font-syne', display: 'swap', weight: ['400','500','600','700','800'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap', weight: ['300','400','500','600','700'] })
const notoNastaliqUrdu = Noto_Nastaliq_Urdu({ subsets: ['arabic'], weight: ['400','700'], variable: '--font-urdu', display: 'swap' })

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cubot-beta.vercel.app'

export const metadata: Metadata = {
  title: {
    default: 'Cubot — Official AI Chatbot | City University Peshawar (CUSIT)',
    template: '%s | Cubot — CUSIT AI',
  },
  description: 'Cubot is the official AI chatbot of City University of Science & Information Technology (CUSIT), Peshawar. Instantly get answers about admissions, fee structure, courses, faculty — 24/7 in English and Urdu. An initiative of the IT & Robotics Society.',
  keywords: ['Cubot','cubot-beta','CUSIT chatbot','City University Peshawar AI','City University of Science and Information Technology','CUSIT AI assistant','CU Peshawar chatbot','university chatbot Pakistan','CUSIT admissions','CUSIT fee structure','IT Robotics Society CUSIT','cubot vercel app','Peshawar university chatbot'],
  authors: [{ name: 'IT & Robotics Society — CUSIT' }],
  creator: 'IT & Robotics Society — City University of Science & Information Technology',
  openGraph: {
    title: 'Cubot — Official AI Chatbot | City University Peshawar',
    description: 'Ask anything about CUSIT — admissions, fees, courses, faculty. Available 24/7 in English and Urdu.',
    url: BASE_URL, siteName: 'Cubot AI — CUSIT', locale: 'en_PK', type: 'website',
    images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630, alt: 'Cubot — CUSIT AI Assistant' }],
  },
  twitter: { card: 'summary_large_image', title: 'Cubot — CUSIT AI Assistant', images: [`${BASE_URL}/og-image.png`] },
  robots: { index: true, follow: true },
  alternates: { canonical: BASE_URL },
  metadataBase: new URL(BASE_URL),
  category: 'education',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${notoNastaliqUrdu.variable}`}>
      <body className="font-sans bg-cu-dark text-white antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}