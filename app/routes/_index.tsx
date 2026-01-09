import { MatchCard } from '@/components/custom/match-card'
import { TeamWidget, type TeamInfoData } from '@/components/custom/team-widget'
import { Button } from '@/components/ui/button'
import { CURRENT_SEASON } from '@/constants'
import type { FullMatchInfo, MatchInfo, SeasonTableData } from '@/types'
import { getEssentialMatchInfo, isMatchFinished } from '@/utils/match'
import { fetchSeasons, fetchSeasonsTable } from '@/utils/seasons-fetcher'
import { addWidget, getWidgetsFromStorage, removeWidget, saveWidgetsToStorage } from '@/utils/widget-storage'
import { Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useLoaderData, useRevalidator } from 'react-router'

export async function clientLoader() {
  const matchesResponses = await fetchSeasons()
  const matches = matchesResponses[CURRENT_SEASON] || []

  // Get the last 10 matchweeks
  const now = new Date()
  const lastMatchIndex = matches.findIndex((match) => new Date(match.kickoff) > now)
  let lastMatchIndexInNearbyMatches = 10
  let nearbyMatches: MatchInfo[] = []

  if (lastMatchIndex === -1) {
    // All matches are in the past
    nearbyMatches = matches.slice(-10)
  } else if (lastMatchIndex === 0) {
    // All matches are in the future, no-op
  } else {
    // Need past 5 matches = give or take around 100 matches; add 20 for buffer
    const start = Math.max(0, lastMatchIndex - 120)

    // Add 10 + 10 as gap to consider upcoming matches
    // TODO: maybe it's better to do this in the stats update script?
    nearbyMatches = matches.slice(start, lastMatchIndex + 20)
    lastMatchIndexInNearbyMatches = Math.max(10, nearbyMatches.length - 20)
  }

  const enrichedMatches: FullMatchInfo[] = nearbyMatches.map((match) => getFullMatchInfoFromMatchInfo(match, match.homeTeam.name))
  const widgets = getWidgetsFromStorage()

  // Pre-compute team match data for all widgets (single pass through matches)
  let teamInfoRecord: Record<string, TeamInfoData> = {}

  if (widgets.length > 0) {
    const tableData = await fetchSeasonsTable(CURRENT_SEASON)
    const sourceTeamInfoRecord = getTeamInfoRecord(enrichedMatches, tableData)

    for (const widget of widgets) {
      if (widget.teamName) {
        teamInfoRecord[widget.id] = sourceTeamInfoRecord[widget.teamName]
      }
    }
  }

  return {
    last10Matches: enrichedMatches.slice(lastMatchIndexInNearbyMatches - 10, lastMatchIndexInNearbyMatches),
    widgets,
    teamInfoRecord,
  }
}

export default function HomePage() {
  const { last10Matches, widgets, teamInfoRecord } = useLoaderData<typeof clientLoader>()
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const revalidator = useRevalidator()

  const handleTeamSelect = (teamName: string, widgetId: string) => {
    const updated = widgets.map((w) => (w.id === widgetId ? { ...w, teamName } : w))

    saveWidgetsToStorage(updated)
    revalidator.revalidate()
  }

  const handleDragStart = (widgetId: string) => {
    setDraggedWidgetId(widgetId)
  }

  const handleDragEnd = () => {
    setDraggedWidgetId(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault()
      if (!draggedWidgetId) return

      const draggedIndex = widgets.findIndex((w) => w.id === draggedWidgetId)
      if (draggedIndex === dropIndex) return

      const updated = [...widgets]
      const [draggedWidget] = updated.splice(draggedIndex, 1)
      updated.splice(dropIndex, 0, draggedWidget)

      saveWidgetsToStorage(updated)
      setDragOverIndex(null)

      revalidator.revalidate()
    },
    [widgets, draggedWidgetId],
  )

  return (
    <div className="space-y-8">
      <title>Home | Premier League Form Comparison</title>

      <h1 className="text-3xl font-bold mb-4">Premier League Form Comparison Home</h1>
      <p className="text-md text-gray-500 mb-8">
        Track your favorite Premier League teams' recent performance and upcoming matches with customizable widgets. Check out all other
        stats from the "Tools" menu in the navbar!
      </p>

      {/* Recent Matches Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Recent Matches</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {last10Matches.map((match) => (
            <MatchCard key={match.matchId} match={match} />
          ))}
        </div>
        {last10Matches.length === 0 && <p className="text-gray-500">No recent matches found</p>}
      </section>

      {/* Widgets Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">My Widgets</h2>
          {widgets.length < 3 && (
            <Button
              onClick={() => {
                addWidget('')
                revalidator.revalidate()
              }}
              size="sm"
              variant="outline"
            >
              <Plus size={16} aria-hidden />
              Add Widget
            </Button>
          )}
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {widgets.length === 0 ? (
            <li className="rounded-lg border-2 border-dashed border-gray-300 p-6 flex flex-col items-center justify-center min-h-[300px] gap-4">
              <Button
                onClick={() => {
                  addWidget('')
                  revalidator.revalidate()
                }}
              >
                <Plus size={32} className="text-gray-400" />
                Add your first widget
              </Button>
            </li>
          ) : (
            widgets.map((widget, index) => (
              <li
                key={widget.id}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                className={`transition-opacity ${dragOverIndex === index ? 'opacity-50' : ''}`}
              >
                <div draggable onDragStart={() => handleDragStart(widget.id)} onDragEnd={handleDragEnd} className="h-full">
                  <TeamWidget
                    widgetId={widget.id}
                    teamName={widget.teamName}
                    onRemove={(id) => {
                      removeWidget(id)
                      revalidator.revalidate()
                    }}
                    onTeamSelect={(teamName) => handleTeamSelect(teamName, widget.id)}
                    isDragging={draggedWidgetId === widget.id}
                    teamInfo={teamInfoRecord[widget.id]}
                  />
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  )
}

function getTeamInfoRecord(allMatches: FullMatchInfo[], seasonTable: SeasonTableData[]): Record<string, TeamInfoData> {
  const teamNames = seasonTable.map((team) => team.name)
  const teamPositions: Record<string, number> = {}
  seasonTable.forEach((position, index) => {
    teamPositions[position.name] = index + 1
  })

  const now = new Date()
  const result: Record<string, TeamInfoData> = {}

  // Initialize data structures for all teams
  const teamPastMatches: Record<string, FullMatchInfo[]> = {}
  const teamNextMatch: Record<string, FullMatchInfo | null> = {}

  for (const teamName of teamNames) {
    teamPastMatches[teamName] = []
    teamNextMatch[teamName] = null
  }

  // Single pass through all matches
  for (const match of allMatches) {
    const isPast = isMatchFinished(match)
    const isFuture = !isPast

    // Check if either team is in our list
    if (teamNames.includes(match.homeTeam.name)) {
      if (isPast) {
        teamPastMatches[match.homeTeam.name].push(match)
      } else if (isFuture && !teamNextMatch[match.homeTeam.name]) {
        teamNextMatch[match.homeTeam.name] = match
      }
    }

    if (teamNames.includes(match.awayTeam.name)) {
      if (isPast) {
        teamPastMatches[match.awayTeam.name].push(match)
      } else if (isFuture && !teamNextMatch[match.awayTeam.name]) {
        teamNextMatch[match.awayTeam.name] = match
      }
    }
  }

  // Build final result with sorted past matches
  for (const teamName of teamNames) {
    const past5Matches = getPastFiveMatches(teamPastMatches, teamName)
    const nextOpponentPast5Matches: FullMatchInfo[] = []
    let nextOpponentLeaguePosition = 0

    if (teamNextMatch[teamName]) {
      const nextOpponentTeamName =
        teamNextMatch[teamName].homeTeam.name === teamName ? teamNextMatch[teamName].awayTeam.name : teamNextMatch[teamName].homeTeam.name

      nextOpponentPast5Matches.push(...getPastFiveMatches(teamPastMatches, nextOpponentTeamName))
      nextOpponentLeaguePosition = teamPositions[nextOpponentTeamName]
    }

    result[teamName] = {
      past5Matches,
      nextMatch: teamNextMatch[teamName],
      leaguePosition: teamPositions[teamName],
      nextOpponentPast5Matches,
      nextOpponentLeaguePosition,
    }
  }

  return result
}

function getFullMatchInfoFromMatchInfo(match: MatchInfo, teamName: string): FullMatchInfo {
  const essentialInfo = getEssentialMatchInfo(match, teamName)
  return {
    ...match,
    color: '',
    opponent: essentialInfo.opponent,
    teamResult: essentialInfo.teamResult,
    venue: essentialInfo.venue,
  }
}

function getPastFiveMatches(teamPastMatches: Record<string, FullMatchInfo[]>, teamName: string): FullMatchInfo[] {
  const pastMatches = teamPastMatches[teamName].sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())
  return pastMatches.slice(0, 5).reverse()
}
