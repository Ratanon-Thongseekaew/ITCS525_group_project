import type { ReactNode } from 'react'
import textileTrackLogo from '@/assets/logos/textile-track-app-logo-1024.png'
import { ModeToggle } from '@/components/ModeToggle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AuthScreenProps {
  eyebrow: string
  title: string
  children: ReactNode
}

/** The fullscreen layout shared by the login and new-password screens. */
export function AuthScreen({ eyebrow, title, children }: AuthScreenProps) {
  return (
    <main className="flex min-h-screen min-h-svh w-full flex-col bg-background text-foreground">
      <header className="flex min-h-16 shrink-0 items-center justify-between border-b px-5 py-4 sm:min-h-20 sm:px-8 lg:px-12">
        <div className="flex items-center gap-2.5" aria-label="Textile Track">
          <img
            src={textileTrackLogo}
            alt=""
            className="size-8 object-contain sm:size-9"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold tracking-tight sm:text-base">Textile Track</span>
        </div>
        <ModeToggle />
      </header>

      {/* The video, scrim, and teal glow are photo treatment, so they stay the same in every theme. */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-900 px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
        <video
          className="absolute inset-0 size-full object-cover motion-reduce:hidden"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src="https://www.pexels.com/download/video/9594356/" type="video/mp4" />
        </video>
        <div
          className="pointer-events-none absolute inset-0 bg-slate-950/50"
          aria-hidden="true"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(13, 148, 136, 0.22), transparent 36%), radial-gradient(circle at 85% 80%, rgba(15, 118, 110, 0.16), transparent 34%)',
          }}
        />

        <Card className="relative w-full max-w-[410px] shadow-lg sm:max-w-[430px]">
          <CardHeader className="space-y-2 px-5 pt-6 pb-5 sm:px-8 sm:pt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
              {eyebrow}
            </p>
            <CardTitle className="text-xl sm:text-2xl">{title}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-6 sm:px-8 sm:pb-8">{children}</CardContent>
        </Card>
      </div>
    </main>
  )
}
