import { z } from 'zod'

const WidgetSchema = z.object({
  id: z.string(),
  teamName: z.string(),
})

const WidgetsStorageSchema = z.array(WidgetSchema)

export type Widget = z.infer<typeof WidgetSchema>

const STORAGE_KEY = 'pl-form-widgets'

export function getWidgetsFromStorage(): Widget[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    const validated = WidgetsStorageSchema.parse(parsed)
    return validated
  } catch {
    return []
  }
}

export function saveWidgetsToStorage(widgets: Widget[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets))
  } catch {
    // Silently fail if localStorage is not available
  }
}

export function addWidget(teamName: string): Widget[] {
  const widgets = getWidgetsFromStorage()
  if (widgets.length >= 3) {
    return widgets // Max 3 widgets
  }

  const newWidget: Widget = {
    id: `widget-${Date.now()}`,
    teamName,
  }

  const updated = [...widgets, newWidget]
  saveWidgetsToStorage(updated)
  return updated
}

export function removeWidget(id: string): Widget[] {
  const widgets = getWidgetsFromStorage()
  const updated = widgets.filter((w) => w.id !== id)
  saveWidgetsToStorage(updated)
  return updated
}
