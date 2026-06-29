import { readFile } from 'fs/promises'
import path from 'path'
import { vi } from 'vitest'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Radix UI Select polyfills for jsdom
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

vi.mock('axios', async (importOriginal) => {
  const imports = (await importOriginal()) as unknown as object

  return {
    ...imports,
    default: async (...args: any[]) => {
      const [url] = args
      const fileContent = await readFile(path.join(process.cwd(), 'public', url), 'utf-8')
      const parsed = JSON.parse(fileContent)

      return { data: parsed }
    },
  }
})
