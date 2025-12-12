import { Navbar } from './components/custom/navbar'

export function PageLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="border-b border-gray-200 w-full">
        <div className="container mx-auto py-2">
          <Navbar className="w-full" />
        </div>
      </div>

      <main className="container mx-auto p-4 flex-1">{children}</main>

      <footer className="border-t border-gray-200 px-4 py-2 text-xs text-center w-full">
        GitHub repository: <a href="https://github.com/imballinst/pl-form-comparison">imballinst/pl-form-comparison</a>. Original idea by{' '}
        <a href="https://x.com/DrRitzyy">DrRitzyy on Twitter</a>.
      </footer>
    </div>
  )
}
