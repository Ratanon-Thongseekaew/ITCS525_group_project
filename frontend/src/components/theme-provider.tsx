import type { ReactNode } from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

import { APP_FORCED_THEME } from '@/config/theme'

/**
 * Class-based light, dark, and system theming. `forcedTheme` defaults to `APP_FORCED_THEME`; pass
 * `null` to let the user's choice apply.
 */
export function ThemeProvider({
  children,
  forcedTheme = APP_FORCED_THEME,
}: {
  children: ReactNode
  forcedTheme?: 'light' | 'dark' | null
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      forcedTheme={forcedTheme ?? undefined}
    >
      {children}
    </NextThemesProvider>
  )
}
