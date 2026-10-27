interface Metric {
  label: string
  value: string
  detail: string
}

interface Action {
  title: string
  description: string
  label: string
}

interface DashboardPageProps {
  accent: 'blue' | 'green' | 'violet'
  eyebrow: string
  title: string
  description: string
  metrics: Metric[]
  actions: Action[]
}

export function DashboardPage({
  accent,
  eyebrow,
  title,
  description,
  metrics,
  actions,
}: DashboardPageProps) {
  return (
    <section className={`dashboard dashboard--${accent}`}>
      <header className="dashboard__header">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <span className="dashboard__date">Today</span>
      </header>

      <div className="metrics" aria-label={`${title} metrics`}>
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>

      <section className="work-panel">
        <div className="work-panel__heading">
          <div>
            <span className="eyebrow">Quick access</span>
            <h2>What needs your attention</h2>
          </div>
          <button type="button" className="secondary-button">View all</button>
        </div>

        <div className="action-list">
          {actions.map((action, index) => (
            <article className="action-row" key={action.title}>
              <span className="action-row__number">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{action.title}</h3>
                <p>{action.description}</p>
              </div>
              <button type="button" className="text-button">
                {action.label} <span aria-hidden="true">→</span>
              </button>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
