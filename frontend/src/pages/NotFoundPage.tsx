import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <section className="grid min-h-[60vh] place-content-center justify-items-center gap-4 text-center">
      <span className="text-xs font-extrabold tracking-[0.16em] text-primary uppercase">
        404 error
      </span>
      <h1 className="max-w-[700px] text-4xl leading-none font-bold tracking-tight text-foreground sm:text-6xl">
        That page is not in this workspace.
      </h1>
      <p className="max-w-[650px] text-base leading-relaxed text-muted-foreground sm:text-lg">
        Check the address or return to the manager dashboard.
      </p>
      <Button asChild className="mt-2">
        <Link to="/manager">Return to dashboard</Link>
      </Button>
    </section>
  )
}
