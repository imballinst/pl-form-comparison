import { renderTest } from '@/lib/testutils'
import '@testing-library/jest-dom'
import { screen } from '@testing-library/react'
import { createRoutesStub, RouterContextProvider } from 'react-router'
import { expect, test } from 'vitest'
import CompareBetweenSeasons, { clientLoader } from './compare.between-seasons'

test('successfully renders', async () => {
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: CompareBetweenSeasons,
      loader: ({ request }) =>
        clientLoader({
          request,
          context: new RouterContextProvider(),
          unstable_pattern: '',
          async serverLoader() {},
          params: {},
        }),
      HydrateFallback: () => null,
      children: [],
    },
  ])

  const { userEvent } = renderTest(<Stub initialEntries={[{ pathname: '/' }]} />)

  await screen.findByRole('heading', { name: 'Form Comparison' })

  expect(screen.getByText('Select two different seasons to compare the form.')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('combobox', { name: 'Select anchor year' }))
  await userEvent.click(await screen.findByRole('option', { name: '2025' }))

  await userEvent.click(screen.getByRole('combobox', { name: 'Select compared year' }))
  await userEvent.click(await screen.findByRole('option', { name: '2024' }))

  const shownRows = await screen.findAllByRole('row')
  expect(shownRows.length).toBe(40)
})
