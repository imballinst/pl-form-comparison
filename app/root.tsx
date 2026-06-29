import { AxiosError } from 'axios'
import { isRouteErrorResponse, Link, Links, Meta, Outlet, Scripts, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import type { Route } from './+types/root'
import { Header } from './components/custom/header'
import { Button } from './components/ui/button'
import './index.css'
import { PageLayout } from './PageLayout'
import { Providers } from './providers'

export const links: Route.LinksFunction = () => [
  {
    rel: 'icon',
    href: '/pl-form-comparison/favicon.svg',
    type: 'image/x-icon',
  },
]

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Premier League Form Comparison</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />

        <script
          dangerouslySetInnerHTML={{
            __html: `
;(function (w, d, s, l, i) {
  w[l] = w[l] || []
  w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
  var f = d.getElementsByTagName(s)[0],
    j = d.createElement(s),
    dl = l != 'dataLayer' ? '&l=' + l : ''
  j.async = true
  j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl
  f.parentNode.insertBefore(j, f)
})(window, document, 'script', 'dataLayer', 'GTM-KGLF5764')`,
          }}
        />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />

        <noscript
          dangerouslySetInnerHTML={{
            __html: `
<iframe
  src="https://www.googletagmanager.com/ns.html?id=GTM-KGLF5764"
  height="0"
  width="0"
  style="display: none; visibility: hidden"
></iframe
>`,
          }}
        />
      </body>
    </html>
  )
}

export default function App() {
  return (
    <Providers>
      <PageLayout>
        <Outlet />
      </PageLayout>
    </Providers>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  let message = 'Oops!'
  let details = 'An unexpected error occurred.'
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error'
    details = error.status === 404 ? 'The requested page could not be found.' : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof AxiosError) {
    details = `${error.message} - ${error.response?.config.method?.toUpperCase()} ${error.response?.config.url}`
    stack = error.stack
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="p-4 container mx-auto flex flex-col gap-y-4">
      <Header heading={message} description={details} />

      <p>Don't worry, it's not your fault. Let's get you back to safety:</p>

      <ul className="list-disc pl-4">
        <li>
          <Button
            onClick={() => window.location.reload()}
            variant="link"
            className="p-0 text-[var(--color-blue-500)] underline text-base h-[unset] wrap-normal text-left whitespace-normal"
            data-ga-label="ga-error-try-again-button"
          >
            Reload the page
          </Button>
          : use this when you are not sure if the error will persist or not.
        </li>
        <li>
          <Button
            onClick={() => navigate(-1)}
            variant="link"
            className="p-0 text-[var(--color-blue-500)] underline text-base h-[unset] wrap-normal text-left whitespace-normal"
            data-ga-label="ga-error-back-button"
          >
            Go back
          </Button>
          : use this when you want to return to previous working state (possibly previous page).
        </li>
        <li>
          <Link to={pathname} data-ga-label="ga-error-reset-link" data-ga-value={pathname}>
            Reset the page
          </Link>
          : use this when you want to reset the page to initial condition.
        </li>
      </ul>

      {stack && (
        <details>
          <summary className="cursor-pointer">Feeling adventorous? Click here to expand error.</summary>
          <pre className="w-full p-4 overflow-x-auto">
            <code>{stack}</code>
          </pre>
        </details>
      )}
    </main>
  )
}
