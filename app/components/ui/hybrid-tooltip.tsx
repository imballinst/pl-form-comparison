// Shamelessly copied from https://github.com/shadcn-ui/ui/issues/2402#issuecomment-1930895113.
import clsx from 'clsx'
import { Popover as PopoverPrimitive, Tooltip as TooltipPrimitive } from 'radix-ui'
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

const { Arrow } = PopoverPrimitive

const TouchContext = createContext<boolean | undefined>(undefined)
const useTouch = () => useContext(TouchContext)

export const TouchProvider = (props: PropsWithChildren) => {
  const [isTouch, setTouch] = useState<boolean>()

  // Update on change - suggestion by @NickCrews below
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const update = () => setTouch(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return <TouchContext.Provider value={isTouch} {...props} />
}

export const HybridTooltip = (props: TooltipPrimitive.TooltipProps & PopoverPrimitive.PopoverProps) => {
  const isTouch = useTouch()

  return isTouch ? <Popover {...props} /> : <Tooltip {...props} />
}

export const HybridTooltipTrigger = (props: TooltipPrimitive.TooltipTriggerProps & PopoverPrimitive.PopoverTriggerProps) => {
  const isTouch = useTouch()

  return isTouch ? <PopoverTrigger {...props} /> : <TooltipTrigger {...props} />
}

export const HybridTooltipContent = ({
  className,
  children,
  ...props
}: TooltipPrimitive.TooltipContentProps & PopoverPrimitive.PopoverContentProps) => {
  const isTouch = useTouch()

  return isTouch ? (
    <PopoverContent
      side="top"
      className={clsx('text-xs w-auto p-2 bg-foreground text-background rounded-md px-3 py-1.5 text-balance', className)}
      {...props}
    >
      {children}
      <Arrow className="bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
    </PopoverContent>
  ) : (
    <TooltipContent className={className} {...props}>
      {children}
    </TooltipContent>
  )
}
