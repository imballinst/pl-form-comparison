#!/usr/bin/env python3
"""
Script to fetch Premier League match results from the official API
and output them as a JSON file.

Usage:
    python3 fetch-matches.py [--matchweek WEEK] [--all] [--output FILE]

Examples:
    # Fetch matchweek 15 (default)
    python3 fetch-matches.py
    
    # Fetch specific matchweek
    python3 fetch-matches.py --matchweek 10
    
    # Fetch all matchweeks (1-38)
    python3 fetch-matches.py --all
    
    # Save to file
    python3 fetch-matches.py --all --output matches.json
"""

import argparse
import json
import sys
import urllib.request
import urllib.error

def fetch_matches(matchweek):
    """
    Fetch matches for a specific matchweek from the Premier League API.
    
    Args:
        matchweek: The matchweek number to fetch
        
    Returns:
        dict: The API response as a dictionary, or None if error
    """
    url = f"https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v2/matches?competition=8&season=2024&matchweek={matchweek}&_limit=100"
    
    # Create request with headers to mimic a browser
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    
    req = urllib.request.Request(url, headers=headers)
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = response.read()
            return json.loads(data)
    except urllib.error.URLError as e:
        print(f"Error fetching matchweek {matchweek}: {e}", file=sys.stderr)
        return None
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON for matchweek {matchweek}: {e}", file=sys.stderr)
        return None

def main():
    """
    Main function to fetch matchweeks and output results.
    """
    parser = argparse.ArgumentParser(
        description='Fetch Premier League match results from the official API'
    )
    parser.add_argument(
        '--matchweek', 
        type=int, 
        default=15,
        help='Matchweek number to fetch (default: 15)'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Fetch all matchweeks (1-38)'
    )
    parser.add_argument(
        '--output',
        type=str,
        help='Output file path (default: stdout)'
    )
    
    args = parser.parse_args()
    
    if args.all:
        # Fetch all matchweeks
        print("Fetching all matchweeks (1-38)...", file=sys.stderr)
        all_data = []
        
        for week in range(1, 39):
            print(f"Fetching matchweek {week}...", file=sys.stderr)
            data = fetch_matches(week)
            
            if data is not None:
                all_data.append({
                    'matchweek': week,
                    'data': data
                })
            else:
                print(f"Warning: Failed to fetch matchweek {week}", file=sys.stderr)
        
        result = {
            'season': 2024,
            'competition': 8,
            'matchweeks': all_data
        }
    else:
        # Fetch single matchweek
        print(f"Fetching matchweek {args.matchweek}...", file=sys.stderr)
        result = fetch_matches(args.matchweek)
        
        if result is None:
            print("Failed to fetch data. The API might be unavailable, blocked, or require authentication.", file=sys.stderr)
            print("\nNote: If you're running this in a restricted environment, the domain might be blocked.", file=sys.stderr)
            print("Try running this script from a different network or machine.", file=sys.stderr)
            sys.exit(1)
    
    # Output the JSON data
    json_output = json.dumps(result, indent=2)
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(json_output)
        print(f"Data saved to {args.output}", file=sys.stderr)
    else:
        print(json_output)

if __name__ == "__main__":
    main()
