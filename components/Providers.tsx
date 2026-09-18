'use client'

import { SessionProvider } from 'next-auth/react'
import { SWRConfig } from 'swr'
import { BackgroundThemeProvider } from '@/lib/theme/background-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BackgroundThemeProvider>
        <SWRConfig
          value={{
            fetcher: (url: string) => fetch(url).then((res) => {
              if (!res.ok) throw new Error('API error')
              return res.json()
            }),
            revalidateOnFocus: false,
            dedupingInterval: 10000,
            errorRetryCount: 2,
            keepPreviousData: true,
          }}
        >
          {children}
        </SWRConfig>
      </BackgroundThemeProvider>
    </SessionProvider>
  )
}
