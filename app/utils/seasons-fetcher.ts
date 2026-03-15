import { BASE_PATH } from '@/constants'
import type { MatchInfo, SeasonMatchesResponse, SeasonTableData } from '@/types'
import axios from 'axios'

let seasons: Record<string, MatchInfo[]> | undefined
let seasonTable: Record<string, Array<SeasonTableData>> | undefined

export async function fetchSeasons() {
  if (seasons) {
    return Promise.resolve(seasons)
  }

  const responses = await Promise.all([axios(`${BASE_PATH}/2025.json`), axios(`${BASE_PATH}/2024.json`), axios(`${BASE_PATH}/2023.json`)])
  const [season2025Response, season2024Response, season2023Response] = responses.map((item) =>
    (item.data as SeasonMatchesResponse).matchweeks.flatMap((mw) => mw.data.data).sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
  )

  const matchesResponses: Record<string, MatchInfo[]> = {
    '2025': season2025Response,
    '2024': season2024Response,
    '2023': season2023Response,
  }
  seasons = matchesResponses

  return matchesResponses
}

export async function fetchSeasonTable(season: string) {
  if (seasonTable && seasonTable[season]) {
    return Promise.resolve(seasonTable[season])
  }

  const response = await axios(`${BASE_PATH}/${season}-table.json`)
  const seasonTableData = response.data as Array<SeasonTableData>

  if (!seasonTable) {
    seasonTable = {}
  }
  seasonTable[season] = seasonTableData

  return seasonTableData
}
