import fs from 'fs/promises'

export const YEAR = 2026

export const UNDERSTAT_TO_APP: Record<string, string> = {
  Coventry: 'Coventry City',
  Hull: 'Hull City',
  Tottenham: 'Tottenham Hotspur',
  'West Ham': 'West Ham United',
  Brighton: 'Brighton and Hove Albion',
  Leeds: 'Leeds United',
  Luton: 'Luton Town',
  Ipswich: 'Ipswich Town',
  Leicester: 'Leicester City',
}

export const FBREF_TO_APP: Record<string, string> = {
  'Manchester Utd': 'Manchester United',
  Newcastle: 'Newcastle United',
  Nottingham: 'Nottingham Forest',
  "Nott'ham Forest": 'Nottingham Forest',
  Wolves: 'Wolverhampton Wanderers',
  Tottenham: 'Tottenham Hotspur',
  'West Ham': 'West Ham United',
  Brighton: 'Brighton and Hove Albion',
  Leeds: 'Leeds United',
  'Sheffield Utd': 'Sheffield United',
  'Brighton & Hove Albion': 'Brighton and Hove Albion',
}

export async function readFileAsJSON<T>(filePath: string, defaultValue?: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'))
  } catch (err) {
    if (defaultValue === undefined) throw err

    return defaultValue
  }
}
