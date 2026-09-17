import type { Metadata, Viewport } from 'next'
import { Bai_Jamjuree, Manrope } from 'next/font/google'
import './globals.css'

const baiJamjuree = Bai_Jamjuree({
  subsets: ['thai', 'latin'],
  variable: '--font-thai',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-english',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Investment Pro — เครื่องมือบริหารความมั่งคั่งส่วนบุคคล',
    template: '%s | Investment Pro',
  },
  description: 'แพลตฟอร์มบริหารจัดการการลงทุนแบบมืออาชีพ ติดตามพอร์ตฟอลิโอและวางแผนการเงินในที่เดียว',
  keywords: ['investment', 'portfolio', 'tracker', 'wealth management', 'เงินลงทุน'],
  authors: [{ name: 'Investment Pro Team' }],
  creator: 'Investment Pro',
  openGraph: {
    type: 'website',
    locale: 'th_TH',
    url: 'https://investmenttracker.app',
    title: 'Investment Pro',
    description: 'แพลตฟอร์มบริหารจัดการการลงทุนแบบมืออาชีพ ติดตามพอร์ตฟอลิโอและวางแผนการเงินในที่เดียว',
    siteName: 'Investment Pro',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Investment Pro',
    description: 'แพลตฟอร์มบริหารจัดการการลงทุนแบบมืออาชีพ ติดตามพอร์ตฟอลิโอและวางแผนการเงินในที่เดียว',
  },
}

export const viewport: Viewport = {
  themeColor: '#111111',
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
}

import { Providers } from '@/components/Providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" className={`${baiJamjuree.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('investment_theme_style') || 'aurora';
                document.documentElement.setAttribute('data-theme-style', theme);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

