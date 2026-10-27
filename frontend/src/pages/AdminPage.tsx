import { DashboardPage } from '../components/DashboardPage'

export function AdminPage() {
  return (
    <DashboardPage
      accent="violet"
      eyebrow="Admin workspace"
      title="Control with confidence."
      description="Manage access, monitor system health, and keep the workspace secure and dependable."
      metrics={[
        { label: 'Active users', value: '248', detail: '12 online now' },
        { label: 'System health', value: '99.9%', detail: 'All services normal' },
        { label: 'Access requests', value: '6', detail: 'Awaiting review' },
      ]}
      actions={[
        { title: 'Review access requests', description: 'Six users are waiting for role or workspace access.', label: 'Manage' },
        { title: 'Inspect audit activity', description: 'Review recent administrative and security events.', label: 'View log' },
        { title: 'Configure workspace', description: 'Update global defaults, integrations, and policies.', label: 'Configure' },
      ]}
    />
  )
}
