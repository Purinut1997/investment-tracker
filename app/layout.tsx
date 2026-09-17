import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
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
    title: 'Investment PRO',
    description: 'แพลตฟอร์มบริหารจัดการการลงทุนแบบมืออาชีพ ติดตามพอร์ตฟอลิโอและวางแผนการเงินในที่เดียว',
    siteName: 'Investment PRO',
  },
  icons: {
    icon: 'https://raw.githubusercontent.com/Purinut1997/web-images/main/LOGO%20SYSTEM.png',
    shortcut: 'https://raw.githubusercontent.com/Purinut1997/web-images/main/LOGO%20SYSTEM.png',
    apple: 'https://raw.githubusercontent.com/Purinut1997/web-images/main/LOGO%20SYSTEM.png',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Investment PRO',
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
    <html lang="th" className={`${inter.variable} ${jetbrainsMono.variable} font-sans`} suppressHydrationWarning>
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
      <body className="bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-200 min-h-screen selection:bg-purple-500/30">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

