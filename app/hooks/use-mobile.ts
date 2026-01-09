import { useEffect, useState } from 'react'

const BREAKPOINTS = {
  sm: 576,
  md: 768,
}

export function useIsMobile(mobileBreakpoint: keyof typeof BREAKPOINTS = 'md') {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${BREAKPOINTS[mobileBreakpoint] - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < BREAKPOINTS[mobileBreakpoint])
    }
    mql.addEventListener('change', onChange)
    setIsMobile(window.innerWidth < BREAKPOINTS[mobileBreakpoint])
    return () => mql.removeEventListener('change', onChange)
  }, [mobileBreakpoint])

  return !!isMobile
}
