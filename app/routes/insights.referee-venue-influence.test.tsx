import { renderTest } from '@/lib/testutils'
import '@testing-library/jest-dom'
import { screen } from '@testing-library/react'
import { RouterContextProvider, createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import RefereeVenueInfluence, { clientLoader } from './insights.referee-venue-influence'

// Frozen, completed season: expected values derived from public/pl-form-comparison/2025-stats.json
// with the same derivation as the loader (fouls = fouls committed + penalties conceded, per venue
// side; the home side alone counts the matches). The card totals stay combined across both sides,
// shown in the tooltip regardless of the selected plot.
const EXPECTED_MICHAEL_OLIVER_2025 = {
  matches: 29,
  home: { foulsPerGame: 11.34, yellowCardsPerGame: 1.31, redCardsPerGame: 0.03, foulsPerYellowCard: 8.65, foulsPerRedCard: 329 },
  away: { foulsPerGame: 11.58, yellowCardsPerGame: 1.82, redCardsPerGame: 0.03, foulsPerYellowCard: 6.33, foulsPerRedCard: 336 },
  yellowCards: 91,
  foulsPerYellowCard: 7.3,
  redCards: 2,
  foulsPerRedCard: 332.5,
}

test('aggregates per-venue fouls and cards for the on-field referees of the selected seasons', async () => {
  const { seasons, chartDataPerSeason, plot } = await callLoader('?seasons=2025')
  expect(seasons).toEqual(['2025'])
  expect(plot).toBe('fouls')

  const data = chartDataPerSeason['2025']
  // 78 officials appear in the 2025 assignments, but only 23 of them took charge of a match as the
  // on-field referee; the rest (assistant referees and VARs) are excluded.
  expect(data).toHaveLength(23)
  expect(data.find((datum) => datum.name === 'Michael Oliver')).toEqual({ name: 'Michael Oliver', ...EXPECTED_MICHAEL_OLIVER_2025 })
})

test.each([
  { search: '', expectedPlot: 'fouls' },
  { search: 'plot=fouls-per-yellow', expectedPlot: 'fouls-per-yellow' },
  { search: 'plot=fouls-per-red', expectedPlot: 'fouls-per-red' },
  { search: 'plot=nonsense', expectedPlot: 'fouls' },
])('resolves the plot parameter "?$search" to "$expectedPlot"', async ({ search, expectedPlot }) => {
  const { plot } = await callLoader(`?seasons=2025${search ? `&${search}` : ''}`)
  expect(plot).toBe(expectedPlot)
})

test('renders one scatter plot per selected season with the plot selector', async () => {
  const Stub = createStub()
  renderTest(<Stub initialEntries={[{ pathname: '/', search: '?seasons=2024,2025' }]} />)

  await screen.findByRole('heading', { name: '2024/2025' })
  expect(screen.getByRole('heading', { name: '2025/2026' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Plot: Number of fouls' })).toBeInTheDocument()
})

function callLoader(search: string) {
  return clientLoader({
    request: new Request(`http://localhost:3000/${search}`),
  } as unknown as Parameters<typeof clientLoader>[0])
}

function createStub() {
  return createRoutesStub([
    {
      path: '/',
      Component: RefereeVenueInfluence,
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
}
