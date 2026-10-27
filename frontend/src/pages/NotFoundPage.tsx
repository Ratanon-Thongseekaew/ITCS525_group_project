import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="not-found">
      <span className="eyebrow">404 error</span>
      <h1>That page is not in this workspace.</h1>
      <p>Check the address or return to the manager dashboard.</p>
      <Link className="primary-button" to="/manager">Return to dashboard</Link>
    </section>
  )
}
