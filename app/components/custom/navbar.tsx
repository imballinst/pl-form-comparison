'use client'

import * as React from 'react'

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'
import { useIsMobile } from '@/hooks/use-mobile'
import dayjs from 'dayjs'
import { Link } from 'react-router'

const components: { title: string; href: string; description: string; lastUpdatedAt?: string }[] = [
  {
    title: 'Compare between seasons',
    href: `/compare/between-seasons`,
    description: `Compare the current season's Premier League team's form with the same fixtures from previous seasons.`,
  },
  {
    title: 'Compare remaining matches',
    href: `/compare/remaining-matches`,
    description: `Compare two or more teams' remaining matches.`,
  },
  {
    title: 'Home-Away Cross Table',
    href: `/compare/cross-table`,
    description: `Compare all home and away matches from every team in the current season.`,
  },
  {
    title: 'Match Official Assignments',
    href: `/insights/official-assignments`,
    description: `Compare the match official assignments between clubs.`,
    lastUpdatedAt: '2026-06-24T04:40:59.172Z',
  },
]

export function Navbar({ className }: { className?: string }) {
  const isMobile = useIsMobile()
  const componentWithNewUpdates = components
    .filter((c) => c.lastUpdatedAt && dayjs(c.lastUpdatedAt).diff(dayjs(), 'month', true) < 1)
    .map((c) => c.title)

  return (
    <NavigationMenu viewport={isMobile} className={className}>
      <NavigationMenuList className="flex-wrap">
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link to="/">Home</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>
            Tools
            {componentWithNewUpdates.length > 0 && <NewFeature position="absolute" />}
          </NavigationMenuTrigger>
          <NavigationMenuContent className="z-50">
            <ul className="grid gap-2 w-[300px] max-w-screen sm:w-[400px] md:w-[500px] md:grid-cols-2 lg:w-[600px]">
              {components.map((component) => (
                <ListItem
                  key={component.title}
                  title={component.title}
                  href={component.href}
                  className="relative"
                  hasUpdates={componentWithNewUpdates.includes(component.title)}
                >
                  {component.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

function ListItem({
  title,
  children,
  href,
  hasUpdates,
  ...props
}: React.ComponentPropsWithoutRef<'li'> & { href: string; hasUpdates: boolean }) {
  return (
    <li {...props}>
      <NavigationMenuLink asChild>
        <Link to={href} data-ga-label="ga-navbar-link" data-ga-value={title}>
          <div className="text-sm leading-none font-medium">
            {title} {hasUpdates && <NewFeature />}
          </div>
          <p className="text-muted-foreground line-clamp-2 text-sm leading-snug">{children}</p>
        </Link>
      </NavigationMenuLink>
    </li>
  )
}

function NewFeature({ position = 'static' }: { position?: 'absolute' | 'static' }) {
  const text = <span className="text-[10px] text-orange-600">New!</span>
  if (position === 'static') return text

  return <div className="flex absolute right-2 top-0">{text}</div>
}
