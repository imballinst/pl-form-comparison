import dayjs from 'dayjs'
import { useMatches } from 'react-router'
import { Navbar } from './components/custom/navbar'

interface Handle {
  pageHeightClassName?: string
}

export function PageLayout({ children }: { children?: React.ReactNode }) {
  const matches = useMatches()
  const pageClassName =
    matches
      .filter((m) => (m.handle as Handle)?.pageHeightClassName)
      .map((m) => (m.handle as Handle)?.pageHeightClassName)
      .join(' ') || 'min-h-screen'

  return (
    <div className={`${pageClassName} flex flex-col bg-background text-foreground`}>
      <div className="border-b border-gray-200 w-full">
        <div className="container mx-auto py-2">
          <Navbar className="w-full" />
        </div>
      </div>

      <main className="min-h-0 flex-1 flex">
        <div className="container mx-auto p-4 flex-1 flex flex-col">{children}</div>
      </main>

      <footer className="border-t border-gray-200 px-4 py-2 text-xs text-center w-full">
        <div>
          GitHub repository: <a href="https://github.com/imballinst/pl-form-comparison">imballinst/pl-form-comparison</a>. Original idea by{' '}
          <a href="https://x.com/DrRitzyy">DrRitzyy on Twitter</a>. Last updated at {getLastUpdatedTime()}.
        </div>
      </footer>
    </div>
  )
}

function getLastUpdatedTime() {
  return dayjs(process.env.__BUILD_TIMESTAMP__).format('MMM D, YYYY HH:mm')
}
