import type { Metadata } from 'next'
import { Syne, DM_Sans, Noto_Nastaliq_Urdu } from 'next/font/google'
import '../globals.css'

const syne = Syne({ subsets: ['latin'], variable: '--font-syne', display: 'swap', weight: ['400','600','700','800'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap', weight: ['300','400','500','600'] })
const notoNastaliqUrdu = Noto_Nastaliq_Urdu({ subsets: ['arabic'], weight: ['400','700'], variable: '--font-urdu', display: 'swap' })

export const metadata: Metadata = {
  title: 'Cubot — Kiosk Mode | City University Peshawar',
  description: 'Interactive AI kiosk for City University Peshawar. Ask questions about admissions, fees, and courses.',
  robots: { index: false, follow: false },
}

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${notoNastaliqUrdu.variable}`}>
      <body className="font-sans bg-cu-dark text-white antialiased overflow-hidden select-none">
        {children}
      </body>
    </html>
  )
}
