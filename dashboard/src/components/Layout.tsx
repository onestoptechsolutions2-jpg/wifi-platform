import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/overview',        icon: '📊', label: 'Overview' },
  { to: '/live',            icon: '📡', label: 'Live View' },
  { to: '/customers',       icon: '👥', label: 'Customers' },
  { to: '/campaigns',       icon: '📣', label: 'Campaigns' },
  { to: '/portal-settings', icon: '🎨', label: 'Portal Settings' },
  { to: '/reports',         icon: '📈', label: 'Reports' },
  { to: '/billing',         icon: '💳', label: 'Billing' },
]

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">📶 WiFi Marketing</div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
            {user?.email}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout} style={{ width: '100%' }}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
