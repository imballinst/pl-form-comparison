import { CURRENT_SEASON } from '@/constants'
import { renderTest } from '@/lib/testutils'
import type { SeasonFile, SeasonMatchesResponse } from '@/types'
import '@testing-library/jest-dom'
import { screen } from '@testing-library/react'
import { readFile } from 'fs/promises'
import path from 'path'
import { RouterContextProvider, createRoutesStub } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
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

// Frozen, time-independent world. Tests populate this and flip `active` on so the
// suite never depends on the real CURRENT_SEASON or the public/*.json fixtures.
const scenario = vi.hoisted(() => ({
  active: false,
  CURRENT_SEASON: '2099',
  TEAMS_PER_SEASON: {} as Record<string, string[]>,
  fixtures: {} as Record<string, any[]>,
  table: {} as Record<string, any[]>,
}))

vi.mock('@/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/constants')>()
  return {
    ...actual,
    get CURRENT_SEASON() {
      return scenario.active ? scenario.CURRENT_SEASON : actual.CURRENT_SEASON
    },
    get TEAMS_PER_SEASON() {
      return scenario.active ? scenario.TEAMS_PER_SEASON : actual.TEAMS_PER_SEASON
    },
  } as any
})

vi.mock('@/utils/seasons-fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/seasons-fetcher')>()
  return {
    ...actual,
    fetchSeasons: (seasonsParam?: string[]) => {
      if (!scenario.active) return actual.fetchSeasons(seasonsParam)
      const keys = seasonsParam ?? Object.keys(scenario.fixtures)
      return Promise.resolve(Object.fromEntries(keys.map((k) => [k, scenario.fixtures[k] ?? []]))) as any
    },
    fetchSeasonTable: (season: string) => {
      if (!scenario.active) return actual.fetchSeasonTable(season)
      return Promise.resolve(scenario.table[season] ?? []) as any
    },
  } as any
})

afterEach(() => {
  scenario.active = false
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

test('a team shows real score tags against promoted team the season it was in (2025) and the one before it got promoted (2024)', async () => {
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

  renderTest(<Stub initialEntries={[{ pathname: '/', search: '?teams=Arsenal' }]} />)

  await screen.findByRole('heading', { name: 'Remaining Matches' })

  const resultOneYearBefore = countTags(`${Number(CURRENT_SEASON) - 1}`)
  const resultTwoYearsBefore = countTags(`${Number(CURRENT_SEASON) - 2}`)

  expect(resultOneYearBefore.total).toBeGreaterThan(0)
  expect(resultOneYearBefore.dash).toBe(0)
  expect(resultOneYearBefore.real).toBe(resultOneYearBefore.total)

  expect(resultTwoYearsBefore.total).toBeGreaterThan(0)
  expect(resultTwoYearsBefore.dash).toBe(0)
  expect(resultTwoYearsBefore.real).toBe(resultTwoYearsBefore.total)
})

test('a promoted team shows "-" score tags for the seasons before it joined the league', async () => {
  // Freeze the world so the assertion never depends on the real current season or fixtures.
  scenario.active = true
  scenario.CURRENT_SEASON = '2099'
  scenario.TEAMS_PER_SEASON = {
    '2099': ['Newly Promoted', 'Opponent'],
    '2098': ['Opponent'],
    '2097': ['Opponent'],
  }
  scenario.fixtures = {
    '2099': [
      {
        homeTeam: { name: 'Newly Promoted', score: 0, id: 1, shortName: 'NP', abbr: 'NP', redCards: 0 },
        awayTeam: { name: 'Opponent', score: 0, id: 2, shortName: 'OP', abbr: 'OP', redCards: 0 },
        period: 'PreMatch',
        matchWeek: '20',
        kickoff: '2099-01-01 15:00:00',
        season: '2099',
      } as any,
    ],
    '2098': [],
    '2097': [],
  }
  scenario.table = { '2099': [] }

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

  renderTest(<Stub initialEntries={[{ pathname: '/', search: '?teams=Newly Promoted' }]} />)

  await screen.findByRole('heading', { name: 'Remaining Matches' })

  const previousSeason = String(Number(scenario.CURRENT_SEASON) - 1)
  const twoSeasonsAgo = String(Number(scenario.CURRENT_SEASON) - 2)

  for (const season of [previousSeason, twoSeasonsAgo]) {
    const result = countTags(season)
    expect(result.total).toBeGreaterThan(0)
    expect(result.real).toBe(0)
    expect(result.dash).toBe(result.total)
  }
})

test('a team present in all seasons shows real score tags for prior seasons', async () => {
  scenario.active = true
  scenario.CURRENT_SEASON = '2099'
  scenario.TEAMS_PER_SEASON = {
    '2099': ['Stable Team', 'Opponent'],
    '2098': ['Stable Team', 'Opponent'],
    '2097': ['Stable Team', 'Opponent'],
  }
  scenario.fixtures = {
    '2099': [makeMatch('Stable Team', 'Opponent', '20', 'PreMatch')],
    '2098': [makeMatch('Stable Team', 'Opponent', '20', 'FullTime', 2, 1)],
    '2097': [makeMatch('Stable Team', 'Opponent', '20', 'FullTime', 1, 1)],
  }
  scenario.table = { '2099': [] }

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

  renderTest(<Stub initialEntries={[{ pathname: '/', search: '?teams=Stable Team' }]} />)

  await screen.findByRole('heading', { name: 'Remaining Matches' })

  const previousSeason = String(Number(scenario.CURRENT_SEASON) - 1)
  const twoSeasonsAgo = String(Number(scenario.CURRENT_SEASON) - 2)

  for (const season of [previousSeason, twoSeasonsAgo]) {
    const result = countTags(season)
    expect(result.total).toBeGreaterThan(0)
    expect(result.dash).toBe(0)
    expect(result.real).toBe(result.total)
  }
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

function makeMatch(home: string, away: string, matchWeek: string, period: string, homeScore = 0, awayScore = 0) {
  return {
    homeTeam: { name: home, score: homeScore, id: 1, shortName: home.slice(0, 3), abbr: home.slice(0, 3), redCards: 0 },
    awayTeam: { name: away, score: awayScore, id: 2, shortName: away.slice(0, 3), abbr: away.slice(0, 3), redCards: 0 },
    period,
    matchWeek,
    kickoff: '2099-01-01 15:00:00',
    season: '2099',
  } as any
}
