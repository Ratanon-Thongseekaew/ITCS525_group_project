import { DashboardPage } from '../components/DashboardPage'

export function StaffPage() {
  return (
    <DashboardPage
      accent="green"
      eyebrow="Staff workspace"
      title="Your work, clearly organized."
      description="See today's priorities, share progress, and stay aligned with your team without the noise."
      metrics={[
        { label: 'Tasks today', value: '5', detail: '2 completed' },
        { label: 'This week', value: '18h', detail: 'Logged so far' },
        { label: 'Team updates', value: '4', detail: 'Since yesterday' },
      ]}
      actions={[
        {
          title: 'Complete assigned tasks',
          description: 'Three priority items remain in your queue for today.',
          label: 'Open tasks',
        },
        {
          title: 'Post your daily update',
          description: 'Share progress and flag anything blocking your work.',
          label: 'Update',
        },
        {
          title: 'Review your schedule',
          description: 'You have two upcoming team sessions this afternoon.',
          label: 'Schedule',
        },
      ]}
    />
  )
}
