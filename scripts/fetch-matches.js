/**
 * Script to fetch Premier League match results from the official API
 * and output them as a JSON file.
 * 
 * Usage:
 *     node scripts/fetch-matches.js [--matchweek WEEK] [--all] [--output FILE]
 * 
 * Examples:
 *     # Fetch matchweek 15 (default)
 *     node scripts/fetch-matches.js
 *     
 *     # Fetch specific matchweek
 *     node scripts/fetch-matches.js --matchweek 10
 *     
 *     # Fetch all matchweeks (1-38)
 *     node scripts/fetch-matches.js --all
 *     
 *     # Save to file
 *     node scripts/fetch-matches.js --all --output matches.json
 */

import axios from 'axios';
import fs from 'fs';

// API Configuration
const COMPETITION_ID = 8;  // Premier League
const SEASON_YEAR = 2024;  // 2024/2025 season
const MAX_MATCHWEEKS = 38; // Total matchweeks in a Premier League season
const API_LIMIT = 100;     // Maximum results per request

/**
 * Fetch matches for a specific matchweek from the Premier League API.
 * 
 * @param {number} matchweek - The matchweek number to fetch
 * @returns {Promise<Object|null>} The API response as an object, or null if error
 */
async function fetchMatches(matchweek) {
  const url = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v2/matches?competition=${COMPETITION_ID}&season=${SEASON_YEAR}&matchweek=${matchweek}&_limit=${API_LIMIT}`;
  
  // Create request with headers to mimic a browser
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  
  try {
    const response = await axios.get(url, { headers, timeout: 10000 });
    return response.data;
  } catch (error) {
    console.error(`Error fetching matchweek ${matchweek}:`, error.message);
    return null;
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    matchweek: 15,
    all: false,
    output: null,
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--matchweek' && i + 1 < args.length) {
      options.matchweek = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--all') {
      options.all = true;
    } else if (args[i] === '--output' && i + 1 < args.length) {
      options.output = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: node scripts/fetch-matches.js [options]

Options:
  --matchweek WEEK    Matchweek number to fetch (default: 15)
  --all               Fetch all matchweeks (1-${MAX_MATCHWEEKS})
  --output FILE       Output file path (default: stdout)
  --help, -h          Show this help message
      `);
      process.exit(0);
    }
  }
  
  return options;
}

/**
 * Main function to fetch matchweeks and output results.
 */
async function main() {
  const options = parseArgs();
  let result;
  
  if (options.all) {
    // Fetch all matchweeks
    console.error(`Fetching all matchweeks (1-${MAX_MATCHWEEKS})...`);
    const allData = [];
    
    for (let week = 1; week <= MAX_MATCHWEEKS; week++) {
      console.error(`Fetching matchweek ${week}...`);
      const data = await fetchMatches(week);
      
      if (data !== null) {
        allData.push({
          matchweek: week,
          data: data
        });
      } else {
        console.error(`Warning: Failed to fetch matchweek ${week}`);
      }
    }
    
    result = {
      season: SEASON_YEAR,
      competition: COMPETITION_ID,
      matchweeks: allData
    };
  } else {
    // Fetch single matchweek
    console.error(`Fetching matchweek ${options.matchweek}...`);
    result = await fetchMatches(options.matchweek);
    
    if (result === null) {
      console.error('Failed to fetch data. The API might be unavailable, blocked, or require authentication.');
      console.error('\nNote: If you\'re running this in a restricted environment, the domain might be blocked.');
      console.error('Try running this script from a different network or machine.');
      process.exit(1);
    }
  }
  
  // Output the JSON data
  const jsonOutput = JSON.stringify(result, null, 2);
  
  if (options.output) {
    fs.writeFileSync(options.output, jsonOutput);
    console.error(`Data saved to ${options.output}`);
  } else {
    console.log(jsonOutput);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
