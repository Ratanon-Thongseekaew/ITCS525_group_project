import { Badge } from '@/components/ui/badge'

export function ContractorStatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? 'success' : 'secondary'}>{active ? 'Active' : 'Inactive'}</Badge>
}
