import { BASE_PATH } from '@/constants'
import type { MatchInfo, SeasonMatchesResponse, SeasonTableData } from '@/types'
import axios from 'axios'

let seasons: Record<string, MatchInfo[]> | undefined
let seasonsTable: Record<string, Array<SeasonTableData>> | undefined

export async function fetchSeasons() {
  if (seasons) {
    return Promise.resolve(seasons)
  }

  const responses = await Promise.all([axios(`${BASE_PATH}/2025.json`), axios(`${BASE_PATH}/2024.json`), axios(`${BASE_PATH}/2023.json`)])
  const [season2025Response, season2024Response, season2023Response] = responses.map((item) =>
    (item.data as SeasonMatchesResponse).matchweeks.flatMap((mw) => mw.data.data),
  )

  const matchesResponses: Record<string, MatchInfo[]> = {
    '2025': season2025Response,
    '2024': season2024Response,
    '2023': season2023Response,
  }
  seasons = matchesResponses

  return matchesResponses
}

export async function fetchSeasonsTable(season: string) {
  if (seasonsTable && seasonsTable[season]) {
    return Promise.resolve(seasonsTable[season])
  }

  const response = await axios(`${BASE_PATH}/${season}-table.json`)
  const seasonTableData = response.data as Array<SeasonTableData>

  if (!seasonsTable) {
    seasonsTable = {}
  }
  seasonsTable[season] = seasonTableData

  return seasonTableData
}
