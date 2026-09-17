import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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
    <html lang="th" className={inter.variable} suppressHydrationWarning>
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

