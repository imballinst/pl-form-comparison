import { CheckboxWithField } from '@/components/custom/form'
import { Button } from '@/components/ui/button'
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatSeason } from '@/utils/match'
import { AVAILABLE_SEASONS } from '@/utils/seasons-fetcher'
import { ChevronDown } from 'lucide-react'
import { useRef } from 'react'
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
  const [, setSearchParams] = useSearchParams()

  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const { control, handleSubmit } = useForm({
    defaultValues: {
      seasons: seasonsArraySearchParams,
    },
  })

  function onSubmit(data: { seasons: string[] }) {
    setSearchParams((prev) => {
      const newSearchParams = new URLSearchParams(prev)
      const newSeasonsArray = data.seasons
      if (newSeasonsArray.length === 0) {
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
        <Button
          className="flex justify-between w-full md:w-[50%]"
          variant="outline"
          data-ga-label={`${gaLabelPrefix}-start-update-seasons-button`}
        >
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
