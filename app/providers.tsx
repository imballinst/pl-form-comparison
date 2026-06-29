import type { ReactNode } from 'react'
import { TouchProvider } from './components/ui/hybrid-tooltip'
import { TooltipProvider } from './components/ui/tooltip'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <TouchProvider>{children}</TouchProvider>
    </TooltipProvider>
  )
}
