import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import axios from 'axios'
import { Info } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import './App.css'
import { TEAMS_2025 } from './constants'
import { MatchInfo, SeasonMatchesResponse } from './types'
import { getEquivalentTeamFromAnotherSeason } from './utils/team-replacement'

interface FullMatchInfo extends MatchInfo {
  color: string
  opponent: string
  venue: string
}

// { "Arsenal vs Tottenham": { "2023": FullMatchInfo, "2024": FullMatchInfo }}.
type MatchAnchorRecord = Record<string, Record<string, FullMatchInfo>>

export function App() {
  const [team, setTeam] = useState('Arsenal')
  const [anchorMatches, setAnchorMatches] = useState<FullMatchInfo[]>([])
  const matchAnchorRecordForOtherYear = useRef<MatchAnchorRecord>({})
  const hasFetched = useRef(false)

  useEffect(() => {
    async function fetchData() {
      if (hasFetched.current) return
      hasFetched.current = true

      const newAnchorMatches: FullMatchInfo[] = []

      const season2025Response = await axios('/2025.json')
      let data = season2025Response.data as SeasonMatchesResponse
      for (const mw of data.matchweeks) {
        const matchInfos = mw.data.data
        for (const match of matchInfos) {
          if (match.homeTeam.name !== team && match.awayTeam.name !== team) continue

          newAnchorMatches.push({ ...match, ...getEssentialMatchInfo(match, team) })
        }
      }

      await fillRecordFromAYear(matchAnchorRecordForOtherYear.current, team, 2024)
      await fillRecordFromAYear(matchAnchorRecordForOtherYear.current, team, 2023)

      // setCount(1)
      setAnchorMatches(newAnchorMatches)
    }

    fetchData()
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto py-12">
        <h1 className="text-4xl font-bold mb-8">Premier League Form Comparison</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Compare the current season's Premier League team's form with the same fixtures from previous seasons, adjusting for promoted and
          relegated teams.
        </p>

        <div>
          <Select
            value={team}
            onValueChange={(value) => {
              setTeam(value)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              {TEAMS_2025.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GW</TableHead>
              <TableHead>Opponent</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>23/24</TableHead>
              <TableHead>24/25</TableHead>
              <TableHead>25/26</TableHead>
              <TableHead>+/-</TableHead>
              <TableHead>Agg</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {anchorMatches.map((match, idx) => {
              const { opponent, venue } = getEssentialMatchInfo(match, team)

              const season2023Match = getMatchFromOtherSeason(matchAnchorRecordForOtherYear.current, 2023, 2025, opponent, team, venue)
              const season2024Match = getMatchFromOtherSeason(matchAnchorRecordForOtherYear.current, 2024, 2025, opponent, team, venue)

              return (
                <TableRow key={match.matchId}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{match.opponent}</TableCell>
                  <TableCell>{match.venue}</TableCell>
                  <TableCell className={season2023Match?.color}>
                    <div>
                      <div>
                        {season2023Match?.homeTeam.score} - {season2023Match?.awayTeam.score}
                      </div>
                      <PreviousTeamThatGotRelegated match={season2023Match} opponent={opponent} />
                    </div>
                  </TableCell>
                  <TableCell className={season2024Match?.color}>
                    <div>
                      <div>
                        {season2024Match?.homeTeam.score} - {season2024Match?.awayTeam.score}
                      </div>
                      <PreviousTeamThatGotRelegated match={season2024Match} opponent={opponent} />
                    </div>
                  </TableCell>
                  <TableCell className={match.color}>
                    {match.homeTeam.score} - {match.awayTeam.score}
                  </TableCell>
                  <TableCell>TBD</TableCell>
                  <TableCell>TBD</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </main>
    </div>
  )
}

function PreviousTeamThatGotRelegated({ match, opponent }: { match: FullMatchInfo | undefined; opponent: string }) {
  if (!match || match.opponent === opponent) {
    return null
  }

  return (
    <div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="inline-block w-4 h-4 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>{match.opponent}</TooltipContent>
      </Tooltip>
    </div>
  )
}

function getScoreColor(position: string, score: [number, number]) {
  if (score[0] === score[1]) {
    return 'bg-gray-400'
  }

  const isHome = position === 'home'
  const isWin = isHome ? score[0] > score[1] : score[1] > score[0]

  return isWin ? 'bg-green-400' : 'bg-red-400'
}

function getEssentialMatchInfo(match: MatchInfo, team: string) {
  const isHome = match.homeTeam.name === team
  const score = [match.homeTeam.score, match.awayTeam.score] satisfies [number, number]
  let opponent: string
  let color: string

  if (isHome) {
    opponent = match.awayTeam.name
    color = getScoreColor('home', score)
  } else {
    opponent = match.homeTeam.name
    color = getScoreColor('away', score)
  }

  return { opponent, color, venue: isHome ? 'home' : 'away' }
}

function getAnchorKeyFromMatch(match: MatchInfo) {
  return getAnchorKeyFromString(match.homeTeam.name, match.awayTeam.name)
}

function getAnchorKeyFromString(home: string, away: string) {
  return [home, away].join(' vs ')
}

async function fillRecordFromAYear(record: MatchAnchorRecord, team: string, year: number) {
  const season2023Response = await axios(`/${year}.json`)
  const data = season2023Response.data as SeasonMatchesResponse

  for (const mw of data.matchweeks) {
    const matchInfos = mw.data.data
    for (const match of matchInfos) {
      if (match.homeTeam.name !== team && match.awayTeam.name !== team) continue

      const anchorKey = getAnchorKeyFromMatch(match)
      if (!record[anchorKey]) {
        record[anchorKey] = {}
      }

      record[anchorKey][year] = {
        ...match,
        ...getEssentialMatchInfo(match, team),
      }
    }
  }
}

function getMatchFromOtherSeason(
  record: MatchAnchorRecord,
  year: number,
  targetYear: number,
  opponent: string,
  team: string,
  venue: string,
) {
  const teamFromOtherSeason = getEquivalentTeamFromAnotherSeason(opponent, targetYear, year)
  let anchorKey: string

  if (venue === 'home') {
    anchorKey = getAnchorKeyFromString(team, teamFromOtherSeason)
  } else {
    anchorKey = getAnchorKeyFromString(teamFromOtherSeason, team)
  }

  if (!record[anchorKey]) {
    return undefined
  }

  return record[anchorKey][year]
}
