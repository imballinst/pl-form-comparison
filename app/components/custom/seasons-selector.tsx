import { CheckboxWithField } from '@/components/custom/form'
import { Button } from '@/components/ui/button'
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CURRENT_SEASON } from '@/constants'
import { formatSeason } from '@/utils/match'
import { AVAILABLE_SEASONS } from '@/utils/seasons-fetcher'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router'

interface SeasonsSelectorProps {
  // Currently selected seasons, as rendered from the URL search parameter.
  seasons: string[]
  // Prefix to build the GA labels from, e.g. "ga-team-discipline".
  gaLabelPrefix: string
}

// Search parameter key used to persist the selected seasons.
export const SEASONS_SEARCH_PARAMETER = 'seasons'

export function SeasonsSelector({ seasons: seasonsArraySearchParams, gaLabelPrefix }: SeasonsSelectorProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const { control, handleSubmit } = useForm({
    defaultValues: {
      seasons: seasonsArraySearchParams,
    },
  })

  // Retroactive cleanup, mirroring the sort-by handling in insights.discipline: a lone current season
  // means the default, so a stale ?seasons=<current-season> URL is rewritten to drop the parameter,
  // keeping the parameterless URL the pristine view for refreshes and shared links.
  useEffect(() => {
    const seasonsParam = searchParams.get(SEASONS_SEARCH_PARAMETER)

    if (seasonsParam === null) {
      return
    }

    const seasonsFromParam = seasonsParam.split(',').filter(Boolean).sort()

    if (seasonsFromParam.length === 1 && seasonsFromParam[0] === CURRENT_SEASON) {
      setSearchParams(
        (prev) => {
          const newSearchParams = new URLSearchParams(prev)
          newSearchParams.delete(SEASONS_SEARCH_PARAMETER)

          return newSearchParams
        },
        { replace: true },
      )
    }
  }, [searchParams, setSearchParams])

  function onSubmit(data: { seasons: string[] }) {
    setSearchParams((prev) => {
      const newSearchParams = new URLSearchParams(prev)
      const newSeasonsArray = data.seasons
      // Persist only non-default states, matching the other selectors: both consumer routes default
      // to the single current season, so that selection (and none) drops the parameter altogether
      // and the parameterless URL stays the pristine view.
      const isDefaultSelection = newSeasonsArray.length === 0 || (newSeasonsArray.length === 1 && newSeasonsArray[0] === CURRENT_SEASON)
      if (isDefaultSelection) {
        newSearchParams.delete(SEASONS_SEARCH_PARAMETER)
      } else {
        newSearchParams.set(SEASONS_SEARCH_PARAMETER, newSeasonsArray.sort().join(','))
      }

      return newSearchParams
    })

    if (closeBtnRef.current) {
      closeBtnRef.current.dataset.gaValue = data.seasons.join(',')
      closeBtnRef.current.click()
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="flex justify-between w-full" variant="outline" data-ga-label={`${gaLabelPrefix}-start-update-seasons-button`}>
          <div>Seasons: {seasonsArraySearchParams.map((season) => formatSeason(season, 'long')).join(', ')}</div>

          <ChevronDown />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="flex flex-col popover-available-width">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <FieldSet>
            <FieldLegend variant="label">Select seasons:</FieldLegend>
            <FieldGroup className="gap-3">
              {AVAILABLE_SEASONS.map((season) => (
                <CheckboxWithField
                  key={season}
                  value={season}
                  formatValue={(v) => formatSeason(v, 'long')}
                  name="seasons"
                  defaultChecked={seasonsArraySearchParams.includes(season)}
                  control={control}
                  getNextValue={(checked, v) => {
                    const nextValue = [...v]
                    if (checked) {
                      nextValue.push(season)
                    } else {
                      const idx = nextValue.indexOf(season)
                      nextValue.splice(idx, 1)
                    }

                    return nextValue
                  }}
                />
              ))}
            </FieldGroup>
          </FieldSet>

          <Button type="submit" className="mt-4">
            Update seasons
          </Button>
        </form>

        <PopoverClose asChild>
          <Button data-ga-label={`${gaLabelPrefix}-finish-update-seasons-button`} ref={closeBtnRef} hidden>
            Close
          </Button>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  )
}
