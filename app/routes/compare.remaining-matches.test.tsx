import { CURRENT_SEASON } from '@/constants'
import { renderTest } from '@/lib/testutils'
import type { SeasonMatchesResponse } from '@/types'
import '@testing-library/jest-dom'
import { screen } from '@testing-library/react'
import { readFile } from 'fs/promises'
import path from 'path'
import { createRoutesStub, RouterContextProvider } from 'react-router'
import { expect, test, vi } from 'vitest'
import CompareRemainingMatches, { clientLoader } from './compare.remaining-matches'

// Override the "global" axios mock since we want a "customized" thing on this.
vi.mock('axios', async (importOriginal) => {
  const imports = (await importOriginal()) as unknown as object

  return {
    ...imports,
    default: async (...args: any[]) => {
      const [url] = args
      const fileContent = await readFile(path.join(process.cwd(), 'public', url), 'utf-8')
      let parsed = JSON.parse(fileContent)

      if (url.endsWith(`${CURRENT_SEASON}.json`)) {
        // Matches. We don't really care about table data and FDR here, we just want to ensure if the table really shows the "remaining matches".
        const typed = parsed as SeasonMatchesResponse
        for (const mw of typed.matchweeks) {
          for (const match of mw.data.data) {
            if (mw.matchweek <= 18) {
              match.period = 'FullTime'
            } else {
              match.period = 'PreMatch'
            }
          }
        }
      }

      return { data: parsed }
    },
  }
})

test('successfully renders', async () => {
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: CompareRemainingMatches,
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

  await screen.findByRole('heading', { name: 'Remaining Matches' })

  expect(screen.getByText('Select 1 or more teams to compare the remaining fixtures.')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Add to table' }))
  const shownRows = await screen.findAllByRole('row')

  // 20 rows of the remaining matches, +3 the default rows.
  expect(shownRows.length).toBe(23)
})
