import { DashboardPage } from '../components/DashboardPage'

export function ManagerPage() {
  return (
    <DashboardPage
      accent="blue"
      eyebrow="Manager workspace"
      title="Keep the team moving."
      description="Review progress, unblock your team, and make the decisions that keep this week on track."
      metrics={[
        { label: 'Active projects', value: '12', detail: '3 need attention' },
        { label: 'Team capacity', value: '84%', detail: 'Healthy workload' },
        { label: 'Pending approvals', value: '7', detail: '2 due today' },
      ]}
      actions={[
        {
          title: 'Review pending approvals',
          description: 'Seven requests are waiting for a manager decision.',
          label: 'Review',
        },
        {
          title: 'Weekly team check-in',
          description: 'Prepare talking points from the latest project updates.',
          label: 'Prepare',
        },
        {
          title: 'Capacity planning',
          description: 'Balance assignments before the next work cycle starts.',
          label: 'Plan',
        },
      ]}
    />
  )
}
