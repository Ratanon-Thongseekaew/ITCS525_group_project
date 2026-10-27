import { NavLink, Outlet } from 'react-router'
import { ApiStatus } from './ApiStatus'

const navigation = [
  { to: '/manager', label: 'Manager' },
  { to: '/staff', label: 'Staff' },
  { to: '/admin', label: 'Admin' },
]

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label="Return to login">
          <span className="brand__mark">W</span>
          <span>
            <strong>Workspace</strong>
            <small>Operations portal</small>
          </span>
        </NavLink>

        <nav className="navigation" aria-label="Role navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `navigation__link${isActive ? ' navigation__link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <ApiStatus />
      </header>

      <main className="page-container">
        <Outlet />
      </main>
    </div>
  )
}
