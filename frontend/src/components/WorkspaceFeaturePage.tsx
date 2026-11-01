import type { WorkspaceRole } from '@/types/workspace'

interface WorkspaceFeaturePageProps {
  role: WorkspaceRole
  title: string
  description: string
}

export function WorkspaceFeaturePage({ role, title, description }: WorkspaceFeaturePageProps) {
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
