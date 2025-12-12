import { Navigate, Outlet, useLocation } from 'react-router'

export default function CompareRoute() {
  const pathname = useLocation().pathname
  if (pathname === '/compare' || pathname === '/compare/') {
    return <Navigate to="/compare/between-seasons" />
  }

  return <Outlet />
}
