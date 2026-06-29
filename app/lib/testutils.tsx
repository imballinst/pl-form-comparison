import { Providers } from '@/providers'
import { render } from '@testing-library/react'
import { userEvent as userEventPrimitive } from '@testing-library/user-event'
import type { JSX } from 'react/jsx-runtime'

export function renderTest(children: JSX.Element) {
  const userEvent = userEventPrimitive.setup()
  render(<Providers>{children}</Providers>)

  return { userEvent }
}
