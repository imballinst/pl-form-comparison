export function MatchweekNumber({ gameweek, isRescheduled }: { gameweek: number | string; isRescheduled: boolean }) {
  if (!isRescheduled) {
    return gameweek
  }

  return (
    <>
      {gameweek}
      <span className="font-bold">*</span>
    </>
  )
}

export function RescheduleInfo() {
  return (
    <div className="text-xs">
      <span className="font-bold">{`*) `}</span>
      <span>Rescheduled match</span>
    </div>
  )
}
