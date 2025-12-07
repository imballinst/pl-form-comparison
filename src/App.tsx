import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import axios from 'axios'
import { useEffect, useRef, useState } from 'preact/hooks'
import './App.css'
import { MatchInfo, SeasonMatchesResponse } from './types'
import { replaceTeamFromAnchorSeasonToPromotedTeamThatSeason } from './utils/team-replacement'

interface FullMatchInfo extends MatchInfo {
  color: string
  opponent: string
  venue: string
}

export function App() {
  const [anchorMatches, setAnchorMatches] = useState<FullMatchInfo[]>([])
  // { "Arsenal vs Tottenham": { "2023": FullMatchInfo, "2024": FullMatchInfo }}.
  const matchAnchorRecordForOtherYear = useRef<Record<string, Record<string, FullMatchInfo>>>({})
  const fetchRecordForYear = useRef<Record<string, boolean>>({})
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (fetchRecordForYear.current['2024']) return
    fetchRecordForYear.current['2024'] = true

    axios('/2024.json')
      .then((res) => {
        const data = res.data as SeasonMatchesResponse
        for (const mw of data.matchweeks) {
          const matchInfos = mw.data.data
          for (const match of matchInfos) {
            if (match.homeTeam.name !== 'Arsenal' && match.awayTeam.name !== 'Arsenal') continue

            const score: [number, number] = [match.homeTeam.score, match.awayTeam.score]

            anchorMatches.push({ ...match, ...getEssentialMatchInfo(match) })
          }
        }

        console.info(anchorMatches)
        setAnchorMatches(anchorMatches)

        return axios('/2023.json')
      })
      .then((res) => {
        const data = res.data as SeasonMatchesResponse
        for (const mw of data.matchweeks) {
          const matchInfos = mw.data.data
          for (const match of matchInfos) {
            if (match.homeTeam.name !== 'Arsenal' && match.awayTeam.name !== 'Arsenal') continue

            const { opponent, color, venue } = getEssentialMatchInfo(match)

            const anchorKey = getAnchorKeyFromMatch(match)
            if (!matchAnchorRecordForOtherYear.current[anchorKey]) {
              matchAnchorRecordForOtherYear.current[anchorKey] = {}
            }

            matchAnchorRecordForOtherYear.current[anchorKey]['2023'] = {
              ...match,
              color,
              venue,
              opponent: replaceTeamFromAnchorSeasonToPromotedTeamThatSeason(opponent, 2023, 2024),
            }
          }
        }

        console.info(matchAnchorRecordForOtherYear.current)
        setCount(1)
      })
  }, [])

  console.info(anchorMatches)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto py-12">
        <h1 className="text-4xl font-bold mb-8">pl-form-comparison</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Welcome to your Preact + Shadcn project!
          <button onClick={() => setCount(count + 1)}>qwe</button>
        </p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GW</TableHead>
              <TableHead>Opponent</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>23/24</TableHead>
              <TableHead>24/25</TableHead>
              <TableHead>+/-</TableHead>
              <TableHead>Agg</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {anchorMatches.map((match, idx) => {
              const { opponent, venue } = getEssentialMatchInfo(match)
              const teamFromOtherSeason = replaceTeamFromAnchorSeasonToPromotedTeamThatSeason(opponent, 2023, 2025)
              let anchorKey: string

              if (venue === 'home') {
                anchorKey = getAnchorKeyFromString('Arsenal', teamFromOtherSeason)
              } else {
                anchorKey = getAnchorKeyFromString(teamFromOtherSeason, 'Arsenal')
              }

              const otherSeasonMatch = matchAnchorRecordForOtherYear.current[anchorKey]?.['2023']

              return (
                <TableRow key={match.matchId}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{match.opponent}</TableCell>
                  <TableCell>{match.venue}</TableCell>
                  <TableCell className={otherSeasonMatch?.color}>
                    {otherSeasonMatch?.homeTeam.score} - {otherSeasonMatch?.awayTeam.score}
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

        <pre>{JSON.stringify(anchorMatches, null, 2)}</pre>
      </main>
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

function getEssentialMatchInfo(match: MatchInfo) {
  const isHome = match.homeTeam.name === 'Arsenal'
  let opponent: string
  let color: string

  if (isHome) {
    opponent = match.awayTeam.name
    color = getScoreColor('home', [match.homeTeam.score, match.awayTeam.score])
  } else {
    opponent = match.homeTeam.name
    color = getScoreColor('away', [match.awayTeam.score, match.homeTeam.score])
  }

  return { opponent, color, venue: isHome ? 'home' : 'away' }
}

function getAnchorKeyFromMatch(match: MatchInfo) {
  return getAnchorKeyFromString(match.homeTeam.name, match.awayTeam.name)
}

function getAnchorKeyFromString(home: string, away: string) {
  return [home, away].join(' vs ')
}
