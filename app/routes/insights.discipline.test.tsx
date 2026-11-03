import { truncateDecimals } from '@/lib/format'
import { renderTest } from '@/lib/testutils'
import { formatSeason } from '@/utils/match'
import '@testing-library/jest-dom'
import { fireEvent, screen, within } from '@testing-library/react'
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

// Header labels per season column group, in rendered order: conceded stats first (what the team's
// own players did: fouls, yellow cards + fouls-per-yellow ratio, red cards + fouls-per-red ratio),
// then the given stats (same order for the opponents). The desktop viewport of jsdom renders the
// long labels (mobile would abbreviate them). The body rows lead with the Team name cell, so every
// stat cell is offset by 1 from its header position.
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
const STATS_PER_GROUP = STAT_KEYS.length

// Expected cell text per stat, in rendered order. Ratios are the same derivation as the loader and
// always render with 2 decimals (the loader truncates, the cell renderer zero-pads); "-" when the
// team received no cards.
function expectedStatTexts(expectedArsenal: {
  foulsConceded: number
  foulsGiven: number
  yellowCardsConceded: number
  yellowCardsGiven: number
  redCardsConceded: number
  redCardsGiven: number
}): Record<StatKey, string> {
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

// The header row with one stat columnheader per season group; with `minSeasons` groups it is
// selected unambiguously because no other row has that many columnheaders.
function getStatHeaderRow(minSeasons = 2) {
  const candidates = screen
    .getAllByRole('row')
    .filter((row) => within(row).queryAllByRole('columnheader').length === minSeasons * STATS_PER_GROUP)
  expect(candidates).toHaveLength(1)

  return candidates[0]!
}

test.each(FIXTURES)('renders one row per team with a $season column group', async ({ season, expectedArsenal }) => {
  const Stub = createStub()
  renderTest(<Stub initialEntries={[{ pathname: '/', search: `?seasons=${season}` }]} />)

  await screen.findAllByText('Arsenal')

  // One season column group per selected season, one row per team.
  expect(screen.getByRole('columnheader', { name: formatSeason(season) })).toBeInTheDocument()
  const rows = getBodyRows()
  expect(rows).toHaveLength(20)

  const indexByHeader = getStatHeaderIndexMap()

  const expectedTexts = expectedStatTexts(expectedArsenal)
  const arsenalCells = within(getRowByTeam('Arsenal')).getAllByRole('cell')
  for (const stat of STAT_KEYS) {
    expect(arsenalCells[indexByHeader.get(STAT_HEADERS[stat])! + 1]).toHaveTextContent(expectedTexts[stat])
  }
})

test('renders one column group per selected season while keeping one row per team', async () => {
  const Stub = createStub()
  renderTest(<Stub initialEntries={[{ pathname: '/', search: '?seasons=2023,2024' }]} />)

  await screen.findAllByText('Arsenal')

  expect(screen.getByRole('columnheader', { name: 'Season' })).toBeInTheDocument()

  // One row per distinct team across the selected seasons; 3 clubs differ between 2023 and 2024, so
  // the union is 23 teams. Teams missing from a season show "-" in that season's column group.
  const rows = getBodyRows()
  expect(rows).toHaveLength(23)

  const arsenalCells = within(getRowByTeam('Arsenal')).getAllByRole('cell')
  expect(arsenalCells).toHaveLength(1 + 2 * STATS_PER_GROUP)

  // The search params are sorted, so the column groups follow the same order as the fixtures here.
  for (const [groupIndex, { expectedArsenal }] of FIXTURES.slice(0, 2).entries()) {
    const groupOffset = 1 + groupIndex * STATS_PER_GROUP

    // 20 teams played in the season; the 3 teams that were not in that season show "-".
    const foulsConcededCounts = rows.map((row) => within(row).getAllByRole('cell')[groupOffset].textContent)
    expect(foulsConcededCounts.filter((fouls) => fouls !== '-')).toHaveLength(20)
    expect(foulsConcededCounts.filter((fouls) => fouls === '-')).toHaveLength(3)

    const expectedTexts = expectedStatTexts(expectedArsenal)
    for (const [statIndex, stat] of STAT_KEYS.entries()) {
      expect(arsenalCells[groupOffset + statIndex]).toHaveTextContent(expectedTexts[stat])
    }
  }
})

test('sorting by a stat column always keeps teams without data in that season at the bottom', async () => {
  const Stub = createStub()
  renderTest(<Stub initialEntries={[{ pathname: '/', search: '?seasons=2023,2024' }]} />)

  await screen.findAllByText('Arsenal')

  // Click the "Fouls conceded" header of the second column group (2024); the header name appears
  // once per season group, in DOM order. sortDescFirst means the first click sorts descending
  // (largest first).
  const statHeaderRow = getStatHeaderRow()
  const foulsConceded2024Header = within(statHeaderRow).getAllByRole('columnheader', { name: STAT_HEADERS.foulsConceded })[1]!
  fireEvent.click(foulsConceded2024Header)

  const get2024FoulsConcededValues = () => {
    const groupOffset = 1 + STATS_PER_GROUP
    return getBodyRows().map((row) => {
      const text = within(row).getAllByRole('cell')[groupOffset].textContent?.trim() ?? ''
      return text === '-' ? null : Number(text)
    })
  }

  // Descending: values sorted largest first, and the 3 nulls all at the bottom.
  let values = get2024FoulsConcededValues()
  let nonNullValues = values.filter((value) => value !== null) as number[]
  expect(nonNullValues).toEqual([...nonNullValues].sort((a, b) => b - a))
  expect(values.slice(-3).every((value) => value === null)).toBe(true)

  // Second click toggles ascending: values smallest first, nulls still at the bottom.
  fireEvent.click(foulsConceded2024Header)
  values = get2024FoulsConcededValues()
  nonNullValues = values.filter((value) => value !== null) as number[]
  expect(nonNullValues).toEqual([...nonNullValues].sort((a, b) => a - b))
  expect(values.slice(-3).every((value) => value === null)).toBe(true)
})
