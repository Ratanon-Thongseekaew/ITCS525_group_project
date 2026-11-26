import { Badge } from '@/components/ui/badge'

export function UserStatusBadge({ temporary }: { temporary: boolean }) {
  return (
    <Badge variant={temporary ? 'warning' : 'success'}>
      {temporary ? 'Temporary password' : 'Active'}
    </Badge>
  )
}
