'use client'

import * as React from 'react'

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import { BASE_PATH } from '@/constants'
import { useIsMobile } from '@/hooks/use-mobile'
import { Link } from 'react-router'

const components: { title: string; href: string; description: string }[] = [
  {
    title: 'Compare between seasons',
    href: `${BASE_PATH}/compare/between-seasons`,
    description: `Compare the current season's Premier League team's form with the same fixtures from previous seasons.`,
  },
  {
    title: 'Compare remaining matches',
    href: `${BASE_PATH}/compare/remaining-matches`,
    description: `Compare two or more teams' remaining matches.`,
  },
]

export function Navbar({ className }: { className?: string }) {
  const isMobile = useIsMobile()

  return (
    <NavigationMenu viewport={isMobile} className={className}>
      <NavigationMenuList className="flex-wrap">
        {/* <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link to="/">Home</Link>
          </NavigationMenuLink>
        </NavigationMenuItem> */}
        <NavigationMenuItem>
          <NavigationMenuTrigger>Tools</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid gap-2 sm:w-[400px] md:w-[500px] md:grid-cols-2 lg:w-[600px]">
              {components.map((component) => (
                <ListItem key={component.title} title={component.title} href={component.href}>
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

function ListItem({ title, children, href, ...props }: React.ComponentPropsWithoutRef<'li'> & { href: string }) {
  return (
    <li {...props}>
      <NavigationMenuLink asChild>
        <Link to={href}>
          <div className="text-sm leading-none font-medium">{title}</div>
          <p className="text-muted-foreground line-clamp-2 text-sm leading-snug">{children}</p>
        </Link>
      </NavigationMenuLink>
    </li>
  )
}
