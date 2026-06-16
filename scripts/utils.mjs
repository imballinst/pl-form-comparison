import fs from 'fs/promises'

export const YEAR = 2025

/**
 *
 * @param {*} filePath
 * @param {*} [defaultValue]
 * @returns {Promise<*>}
 */
export async function readFileAsJSON(filePath, defaultValue) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'))
  } catch (err) {
    if (!defaultValue) throw err

    return defaultValue
  }
}
