import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { App } from './App.jsx'
import { BASE_PATH } from './constants.js'
import './index.css'
import { RemainingMatches, remainingMatchesLoader } from './routes/RemainingMatches.js'
import { ResultComparisonBySeason, resultComparisonBySeasonLoader } from './routes/ResultComparisonBySeason'

const router = createBrowserRouter([
  {
    path: `${BASE_PATH}/`,
    Component: App,
    children: [
      { index: true, element: <Navigate to="compare-between-seasons" replace /> },
      { path: 'compare-between-seasons', Component: ResultComparisonBySeason, loader: resultComparisonBySeasonLoader },
      { path: 'compare-remaining-matches', Component: RemainingMatches, loader: remainingMatchesLoader },
      { path: '*', element: <Navigate to="compare-between-seasons" replace /> },
    ],
  },
])

const root = createRoot(document.getElementById('app')!)
root.render(<RouterProvider router={router} />)
