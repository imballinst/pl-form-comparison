import { renderTest } from '@/lib/testutils'
import { screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { test } from 'vitest'
import HomePage, { clientLoader } from './_index'

test('successfully renders', async () => {
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: HomePage,
      loader: clientLoader,
      HydrateFallback: () => null,
      children: [],
    },
  ])

  renderTest(<Stub initialEntries={[{ pathname: '/' }]} />)

  await screen.findByRole('heading', { name: 'Premier League Form Comparison Home' })
})
