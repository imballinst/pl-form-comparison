import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, Outlet } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { App } from './App.jsx'
import './index.css'
import { ResultComparisonBySeason, resultComparisonBySeasonLoader } from './routes/ResultComparisonBySeason'

const router = createBrowserRouter([
  {
    path: '/',
    Component: App,
    children: [
      { index: true, element: <Navigate to="/compare/between-seasons" replace /> },
      {
        path: 'compare',
        Component: Outlet,
        children: [
          { index: true, element: <Navigate to="/compare/between-seasons" replace /> },
          { path: 'between-seasons', Component: ResultComparisonBySeason, loader: resultComparisonBySeasonLoader },
          { path: 'remaining-matches', Component: ResultComparisonBySeason },
        ],
      },
    ],
  },
])

const root = createRoot(document.getElementById('app')!)
root.render(<RouterProvider router={router} />)
