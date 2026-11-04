import { truncateDecimals } from '@/lib/format'
import { renderTest } from '@/lib/testutils'
import '@testing-library/jest-dom'
import { screen, within } from '@testing-library/react'
import { RouterContextProvider, createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import TeamDiscipline, { clientLoader } from './insights.discipline'

// Frozen, completed seasons: every match is full-time, so the discipline stats are stable and can be
// hardcoded. Source: public/pl-form-comparison/{season}.json aggregation.
const FIXTURES = [
  {
    season: '2023',
    expectedArsenal: {
      foulsConceded: 391,
      foulsGiven: 407,
      yellowCardsConceded: 64,
      yellowCardsGiven: 82,
      redCardsConceded: 2,
      redCardsGiven: 2,
    },
  },
  {
    season: '2024',
    expectedArsenal: {
      foulsConceded: 399,
      foulsGiven: 416,
      yellowCardsConceded: 70,
      yellowCardsGiven: 83,
      redCardsConceded: 6,
      redCardsGiven: 2,
    },
  },
  {
    season: '2025',
    expectedArsenal: {
      foulsConceded: 391,
      foulsGiven: 418,
      yellowCardsConceded: 51,
      yellowCardsGiven: 72,
      redCardsConceded: 0,
      redCardsGiven: 2,
    },
  },
] as const

// Column headers, in rendered order: the full header row renders the sticky Team name cell followed
// by the conceded stats (what the team's own players did: fouls, yellow cards + fouls-per-yellow
// ratio, red cards + fouls-per-red ratio), then the given stats (same order for the opponents). The
// desktop viewport of jsdom renders the long labels (mobile would abbreviate them). Header and cell
// indexes match because both rows lead with the Team name column.
const STAT_HEADERS = {
  foulsConceded: 'Fouls conceded',
  yellowCardsConceded: 'Yellow cards conceded',
  foulsPerYellowCard: 'Fouls per yellow card conceded',
  redCardsConceded: 'Red cards conceded',
  foulsPerRedCard: 'Fouls per red card conceded',
  foulsGiven: 'Fouls given',
  yellowCardsGiven: 'Yellow cards given',
  foulsPerYellowCardGiven: 'Fouls per yellow card given',
  redCardsGiven: 'Red cards given',
  foulsPerRedCardGiven: 'Fouls per red card given',
} as const

type StatKey = keyof typeof STAT_HEADERS
const STAT_KEYS = Object.keys(STAT_HEADERS) as StatKey[]
const STATS_COUNT = STAT_KEYS.length

// Expected cell text per stat, in rendered order. Ratios are the same derivation as the loader and
// always render with 2 decimals (the loader truncates, the cell renderer zero-pads); "-" when the
// team received no cards.
type RawStats = Record<
  'foulsConceded' | 'foulsGiven' | 'yellowCardsConceded' | 'yellowCardsGiven' | 'redCardsConceded' | 'redCardsGiven',
  number
>

function expectedStatTexts(expectedArsenal: RawStats): Record<StatKey, string> {
  const ratio = (fouls: number, cards: number) => (cards === 0 ? '-' : truncateDecimals(fouls / cards).toFixed(2))

  return {
    foulsConceded: String(expectedArsenal.foulsConceded),
    yellowCardsConceded: String(expectedArsenal.yellowCardsConceded),
    foulsPerYellowCard: ratio(expectedArsenal.foulsConceded, expectedArsenal.yellowCardsConceded),
    redCardsConceded: String(expectedArsenal.redCardsConceded),
    foulsPerRedCard: ratio(expectedArsenal.foulsConceded, expectedArsenal.redCardsConceded),
    foulsGiven: String(expectedArsenal.foulsGiven),
    yellowCardsGiven: String(expectedArsenal.yellowCardsGiven),
    foulsPerYellowCardGiven: ratio(expectedArsenal.foulsGiven, expectedArsenal.yellowCardsGiven),
    redCardsGiven: String(expectedArsenal.redCardsGiven),
    foulsPerRedCardGiven: ratio(expectedArsenal.foulsGiven, expectedArsenal.redCardsGiven),
  }
}

// The raw stats are totaled across the selected seasons and the ratios are re-derived from the sums,
// the same way the loader does it. With a single selected season this is that season's numbers.
function expectedArsenalTotals(seasons: string[]): Record<StatKey, string> {
  const selectedStats = FIXTURES.filter(({ season }) => seasons.includes(season)).map(({ expectedArsenal }) => expectedArsenal)
  const sum = (stat: keyof RawStats) => selectedStats.reduce((acc, stats) => acc + stats[stat], 0)

  return expectedStatTexts({
    foulsConceded: sum('foulsConceded'),
    foulsGiven: sum('foulsGiven'),
    yellowCardsConceded: sum('yellowCardsConceded'),
    yellowCardsGiven: sum('yellowCardsGiven'),
    redCardsConceded: sum('redCardsConceded'),
    redCardsGiven: sum('redCardsGiven'),
  })
}

function createStub() {
  return createRoutesStub([
    {
      path: '/',
      Component: TeamDiscipline,
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

function getBodyRows() {
  return screen.getAllByRole('row').filter((row) => within(row).queryAllByRole('cell').length > 0)
}

function getStatHeaderIndexMap() {
  const statHeaderRow = screen
    .getAllByRole('row')
    .find((row) => within(row).queryByRole('columnheader', { name: STAT_HEADERS.foulsConceded }))!

  return new Map(
    within(statHeaderRow)
      .getAllByRole('columnheader')
      .map((header, index): [string, number] => [header.textContent?.trim() ?? '', index]),
  )
}

function getRowByTeam(team: string) {
  return getBodyRows().find((row) => within(row).queryByText(team))!
}

test.each(FIXTURES)('renders one row per team with the $season stats', async ({ season, expectedArsenal }) => {
  const Stub = createStub()
  renderTest(<Stub initialEntries={[{ pathname: '/', search: `?seasons=${season}` }]} />)

  await screen.findAllByText('Arsenal')

  // One row per team, one column per stat; the per-season header rows are gone entirely.
  expect(screen.queryByRole('columnheader', { name: 'Season' })).not.toBeInTheDocument()
  const rows = getBodyRows()
  expect(rows).toHaveLength(20)

  const indexByHeader = getStatHeaderIndexMap()

  const expectedTexts = expectedStatTexts(expectedArsenal)
  const arsenalCells = within(getRowByTeam('Arsenal')).getAllByRole('cell')
  expect(arsenalCells).toHaveLength(1 + STATS_COUNT)
  for (const stat of STAT_KEYS) {
    expect(arsenalCells[indexByHeader.get(STAT_HEADERS[stat])!]).toHaveTextContent(expectedTexts[stat])
  }
})

test('totals the stats across the selected seasons while keeping one row per team', async () => {
  const Stub = createStub()
  renderTest(<Stub initialEntries={[{ pathname: '/', search: '?seasons=2023,2024' }]} />)

  await screen.findAllByText('Arsenal')

  // One row per distinct team across the selected seasons; 3 clubs differ between 2023 and 2024, so
  // the union is 23 teams. Every row shows the totals across the seasons that team played in.
  expect(screen.queryByRole('columnheader', { name: 'Season' })).not.toBeInTheDocument()
  const rows = getBodyRows()
  expect(rows).toHaveLength(23)

  const arsenalCells = within(getRowByTeam('Arsenal')).getAllByRole('cell')
  expect(arsenalCells).toHaveLength(1 + STATS_COUNT)

  const indexByHeader = getStatHeaderIndexMap()
  const expectedTexts = expectedArsenalTotals(['2023', '2024'])
  for (const stat of STAT_KEYS) {
    expect(arsenalCells[indexByHeader.get(STAT_HEADERS[stat])!]).toHaveTextContent(expectedTexts[stat])
  }
})

test('teams are ordered page-wide by fouls conceded, descending, by default', async () => {
  const Stub = createStub()
  renderTest(<Stub initialEntries={[{ pathname: '/', search: '?seasons=2023,2024' }]} />)

  await screen.findAllByText('Arsenal')

  // No column is clickable anymore; the Sort popover owns the order and defaults to fouls conceded,
  // descending, so the totals come largest-first without any interaction.
  expect(screen.queryByRole('columnheader', { name: 'Season' })).not.toBeInTheDocument()
  const getFoulsConcededTotals = () => getBodyRows().map((row) => Number(within(row).getAllByRole('cell')[1].textContent?.trim()))
  const totals = getFoulsConcededTotals()
  expect(totals).toEqual([...totals].sort((a, b) => b - a))
})
