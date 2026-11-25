import { PageHeader } from '@/components/PageHeader'
import type { WorkspaceRole } from '@/types/workspace'

interface WorkspaceFeaturePlaceholderPageProps {
  role: WorkspaceRole
  title: string
  description: string
}

export function WorkspaceFeaturePlaceholderPage({
  role,
  title,
  description,
}: WorkspaceFeaturePlaceholderPageProps) {
  return (
    <PageHeader
      eyebrow={<span className="capitalize">{role} workspace</span>}
      title={title}
      description={description}
    />
  )
}
