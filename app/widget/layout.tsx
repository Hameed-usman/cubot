import type { Metadata } from 'next'
import { DM_Sans, Noto_Nastaliq_Urdu } from 'next/font/google'
import '../globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap', weight: ['300','400','500','600'] })
const notoNastaliqUrdu = Noto_Nastaliq_Urdu({ subsets: ['arabic'], weight: ['400','700'], variable: '--font-urdu', display: 'swap' })

export const metadata: Metadata = {
  title: 'Cubot Widget | City University Peshawar',
  description: 'Embeddable AI chat widget for City University Peshawar.',
  robots: { index: false, follow: false },
}

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${notoNastaliqUrdu.variable}`}>
      <body className="font-sans text-white antialiased m-0 p-0 overflow-hidden" style={{ background: 'transparent' }}>
        {children}
      </body>
    </html>
  )
}
