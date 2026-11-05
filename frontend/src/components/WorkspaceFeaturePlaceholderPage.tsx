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
    <section className="dashboard">
      <header className="dashboard__header">
        <div>
          <span className="eyebrow capitalize">{role} workspace</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>
    </section>
  )
}
