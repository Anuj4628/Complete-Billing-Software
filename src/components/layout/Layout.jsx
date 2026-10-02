import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import TopBar from './TopBar.jsx'

const PAGE_TITLES = {
  '/dashboard':  'Dashboard',
  '/customers':  'Customers',
  '/products':   'Products & Inventory',
  '/invoices':   'Invoices',
  '/invoices/new': 'Create Invoice',
  '/reports':    'Reports',
  '/settings':   'Settings',
}

function getTitle(pathname) {
  if (pathname.startsWith('/invoices/') && pathname.endsWith('/edit')) return 'Edit Invoice'
  if (pathname.startsWith('/invoices/') && pathname !== '/invoices/new') return 'Invoice Detail'
  return PAGE_TITLES[pathname] || 'Sunmarg Billing App'
}

export default function Layout({ onLogout, onOwnerOpen, licenseInfo }) {
  const location = useLocation()
  const title = getTitle(location.pathname)

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--surface-2)' }}
    >
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar title={title} onLogout={onLogout} onOwnerOpen={onOwnerOpen} licenseInfo={licenseInfo} />
        <main className="flex-1 overflow-auto p-6 page-enter">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
