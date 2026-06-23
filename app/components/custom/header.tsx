import type { ReactNode } from 'react'

export function Header({ heading, description }: { heading: ReactNode; description: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 mb-4">
      <h1 className="text-3xl font-bold">{heading}</h1>
      <p className="text-base text-gray-500">{description}</p>
    </div>
  )
}
