import fs from 'fs/promises'

export const YEAR = 2023

export async function readFileAsJSON<T>(filePath: string, defaultValue?: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'))
  } catch (err) {
    if (defaultValue === undefined) throw err

    return defaultValue
  }
}
