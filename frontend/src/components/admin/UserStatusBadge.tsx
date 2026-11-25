import { Badge } from '@/components/ui/badge'
import type { UserStatus } from '@/types/user'

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <Badge variant={status === 'Active' ? 'success' : 'warning'}>{status}</Badge>
}
