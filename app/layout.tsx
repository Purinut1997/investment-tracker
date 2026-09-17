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
    default: 'Investment Tracker — บันทึกการลงทุนส่วนตัว',
    template: '%s | Investment Tracker',
  },
  description:
    'ระบบบันทึกและวิเคราะห์การลงทุนส่วนบุคคล ด้วย AI, กราฟ, และรายงานภาษี',
  keywords: ['investment', 'portfolio', 'tracker', 'stock', 'crypto', 'เงินลงทุน'],
  authors: [{ name: 'MIKPURINUT' }],
  creator: 'MIKPURINUT',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Investment Tracker',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-icon.png',
  },
  openGraph: {
    type: 'website',
    title: 'Investment Tracker',
    description: 'ระบบบันทึกการลงทุนส่วนบุคคล',
  },
}

export const viewport: Viewport = {
  themeColor: '#020817',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Prevent double-tap zoom
  userScalable: false,
}

import { Providers } from '@/components/Providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" className={inter.variable} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

