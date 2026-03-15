import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import type { Route } from './+types/root'
import { TouchProvider } from './components/ui/hybrid-tooltip'
import './index.css'
import { PageLayout } from './PageLayout'

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
})(window, document, 'script', 'dataLayer', 'G-NVZE75RYKR')`,
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
  src="https://www.googletagmanager.com/ns.html?id=G-NVZE75RYKR"
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
    <TouchProvider>
      <PageLayout>
        <Outlet />
      </PageLayout>
    </TouchProvider>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!'
  let details = 'An unexpected error occurred.'
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error'
    details = error.status === 404 ? 'The requested page could not be found.' : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
