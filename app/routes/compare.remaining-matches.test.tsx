import { CURRENT_SEASON } from '@/constants'
import { renderTest } from '@/lib/testutils'
import type { SeasonFile, SeasonMatchesResponse } from '@/types'
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
        if ((parsed as SeasonFile).matches) {
          const typed = parsed as SeasonFile
          for (const matchweekKey in typed.matches) {
            for (const match of typed.matches[matchweekKey]) {
              if (match.matchweek <= 18) {
                match.period = 'FullTime'
              } else {
                match.period = 'PreMatch'
              }
            }
          }
        } else {
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

test('promoted team (Sunderland) shows real scores for both the season it was in (2025) and the one it replaced (2024)', async () => {
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

  renderTest(<Stub initialEntries={[{ pathname: '/', search: '?teams=Sunderland' }]} />)

  await screen.findByRole('heading', { name: 'Remaining Matches' })

  const result2025 = countTags('2025')
  const result2024 = countTags('2024')
  // Sunderland was in the 2025 Premier League, so every 2025 cell is a real score (the actual encounter).
  expect(result2025.total).toBeGreaterThan(0)
  expect(result2025.dash).toBe(0)
  expect(result2025.real).toBe(result2025.total)
  // Sunderland was not in the 2024 Premier League, but its slot was held by the relegated team it replaced,
  // so every 2024 cell still resolves to a real score (the "relegation index" equivalent).
  expect(result2024.total).toBeGreaterThan(0)
  expect(result2024.dash).toBe(0)
  expect(result2024.real).toBe(result2024.total)
})

function seasonTags(season: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-season="${season}"]`))
}

function countTags(season: string) {
  const tags = seasonTags(season)
  let real = 0
  let dash = 0
  for (const tag of tags) {
    if (tag.textContent?.includes('–')) dash++
    else if (/\d+-\d+/.test(tag.textContent ?? '')) real++
  }
  return { real, dash, total: tags.length }
}
