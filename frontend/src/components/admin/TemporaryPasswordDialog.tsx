import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface TemporaryPasswordDialogProps {
  username: string
  password: string
  onClose: () => void
}

/** Shows a server-generated password once. Only the Done button closes it. */
export function TemporaryPasswordDialog({
  username,
  password,
  onClose,
}: TemporaryPasswordDialogProps) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(password)
      toast.success('Password copied')
    } catch {
      toast.error('Could not copy. Select the password and copy it yourself.')
    }
  }

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Temporary password</DialogTitle>
          <DialogDescription>
            Give this to {username} in person or by chat. It is shown only once, and they must
            change it when they first sign in.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
          <code className="min-w-0 flex-1 font-mono text-sm break-all select-all">{password}</code>
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            <Copy aria-hidden="true" />
            Copy
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
