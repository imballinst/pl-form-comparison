import { MatchCard } from '@/components/custom/match-card'
import { TeamWidget } from '@/components/custom/team-widget'
import { Button } from '@/components/ui/button'
import { CURRENT_SEASON } from '@/constants'
import type { FullMatchInfo, SeasonTableData } from '@/types'
import { getEssentialMatchInfo } from '@/utils/match'
import { fetchSeasons, fetchSeasonsTable } from '@/utils/seasons-fetcher'
import { addWidget, getWidgetsFromStorage, removeWidget, reorderWidgets, type Widget } from '@/utils/widget-storage'
import { Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useLoaderData } from 'react-router'

export async function clientLoader(): Promise<{
  matchesData: FullMatchInfo[]
  tableData: SeasonTableData[]
  widgets: Widget[]
}> {
  const matchesResponses = await fetchSeasons()
  const matches = matchesResponses[CURRENT_SEASON] || []

  // Get the last 10 matchweeks
  const now = new Date()
  const pastMatches = matches.filter((match) => {
    const matchDate = new Date(match.kickoff)
    return matchDate <= now
  })

  // Get all matchweeks and find the last 10
  const matchweeks = new Set(pastMatches.map((m) => m.matchWeek))
  const sortedMatchweeks = Array.from(matchweeks).sort((a, b) => b - a)
  const last10Matchweeks = new Set(sortedMatchweeks.slice(0, 10))

  const recentMatches = matches
    .filter((match) => last10Matchweeks.has(match.matchWeek))
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())

  // Enrich matches with color, opponent, venue info
  const enrichedMatches: FullMatchInfo[] = recentMatches.map((match) => {
    // We need to pick a team to get the essential info
    const homeInfo = getEssentialMatchInfo(match, match.homeTeam.name)
    return {
      ...match,
      color: homeInfo.color,
      opponent: homeInfo.opponent,
      teamResult: homeInfo.teamResult,
      venue: homeInfo.venue,
    }
  })

  const tableData = await fetchSeasonsTable(CURRENT_SEASON)
  const widgets = getWidgetsFromStorage()

  return { matchesData: enrichedMatches, tableData, widgets }
}

export default function HomePage() {
  const { matchesData, tableData, widgets: initialWidgets } = useLoaderData<typeof clientLoader>()
  const [widgets, setWidgets] = useState(initialWidgets)
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleAddWidget = useCallback(() => {
    const updated = addWidget('')
    setWidgets(updated)
  }, [])

  const handleRemoveWidget = useCallback((id: string) => {
    const updated = removeWidget(id)
    setWidgets(updated)
  }, [])

  const handleTeamSelect = useCallback(
    (teamName: string, widgetId: string) => {
      const updated = widgets.map((w) => (w.id === widgetId ? { ...w, teamName } : w))
      reorderWidgets(updated)
      setWidgets(updated)
    },
    [widgets],
  )

  const handleDragStart = useCallback((widgetId: string) => {
    setDraggedWidgetId(widgetId)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedWidgetId(null)
    setDragOverIndex(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault()
      if (!draggedWidgetId) return

      const draggedIndex = widgets.findIndex((w) => w.id === draggedWidgetId)
      if (draggedIndex === dropIndex) return

      const updated = [...widgets]
      const [draggedWidget] = updated.splice(draggedIndex, 1)
      updated.splice(dropIndex, 0, draggedWidget)

      reorderWidgets(updated)
      setWidgets(updated)
      setDragOverIndex(null)
    },
    [widgets, draggedWidgetId],
  )

  return (
    <div className="space-y-8">
      <title>Home | Premier League Form Comparison</title>

      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Premier League Form</h1>
        <p className="text-gray-600">Latest results and team tracking</p>
      </div>

      {/* Widgets Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">My Teams</h2>
          {widgets.length < 3 && (
            <Button onClick={handleAddWidget} size="sm" variant="outline">
              <Plus size={16} />
              Add Widget
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {widgets.length === 0 ? (
            <div
              className="rounded-lg border-2 border-dashed border-gray-300 p-6 flex flex-col items-center justify-center min-h-[300px] gap-4"
              onClick={handleAddWidget}
            >
              <Plus size={32} className="text-gray-400" />
              <div className="text-center">
                <h3 className="font-semibold text-gray-700 mb-2">Add Widget</h3>
                <p className="text-sm text-gray-500">Select a team to track</p>
              </div>
            </div>
          ) : (
            widgets.map((widget, index) => (
              <div
                key={widget.id}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                className={`transition-opacity ${dragOverIndex === index ? 'opacity-50' : ''}`}
              >
                <div draggable onDragStart={() => handleDragStart(widget.id)} onDragEnd={handleDragEnd}>
                  <TeamWidget
                    widgetId={widget.id}
                    teamName={widget.teamName}
                    matchesData={matchesData}
                    tableData={tableData}
                    onRemove={handleRemoveWidget}
                    onTeamSelect={(teamName) => handleTeamSelect(teamName, widget.id)}
                    isDragging={draggedWidgetId === widget.id}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Recent Matches Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Recent Results (Past 10 Matchweeks)</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {matchesData.map((match) => (
            <MatchCard key={match.matchId} match={match} />
          ))}
        </div>
        {matchesData.length === 0 && <p className="text-gray-500">No recent matches found</p>}
      </section>
    </div>
  )
}
