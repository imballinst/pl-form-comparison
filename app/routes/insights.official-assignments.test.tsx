import '@testing-library/jest-dom'
import { expect, test } from 'vitest'
import { clientLoader } from './insights.official-assignments'

test('no teams parameter keeps every team row', async () => {
  const { allSeasons, allTeams, teams } = await callLoader('?seasons=2025')

  expect(teams).toEqual([])
  expect(allSeasons.tableData).toHaveLength(20)
  expect(allTeams).toHaveLength(20)
})

test.each([
  {
    season: '2025',
    search: 'teams=Arsenal,Manchester%20City',
    expectedRawTeams: ['Arsenal', 'Manchester City'],
    expectedRows: ['Arsenal', 'Manchester City'],
    description: 'display names',
  },
  {
    season: '2025',
    search: 'teams=Coventry%20City',
    expectedRawTeams: ['Coventry City'],
    expectedRows: [],
    description: 'a team not playing in the selected season matches nothing',
  },
])('filters the $season table rows by teams: $description', async ({ season, search, expectedRawTeams, expectedRows }) => {
  const { allSeasons, allTeams, teams } = await callLoader(`?seasons=${season}&${search}`)

  // The raw parameter values round-trip to the selector, while the rows match on exact team names.
  expect(teams).toEqual(expectedRawTeams)
  expect(allSeasons.tableData.map((row) => row.name).sort()).toEqual([...expectedRows].sort())
  // The teams selector still offers every team of the selected seasons.
  expect(allTeams).toHaveLength(20)
})

function callLoader(search: string) {
  return clientLoader({
    request: new Request(`http://localhost:3000/${search}`),
  } as unknown as Parameters<typeof clientLoader>[0])
}
