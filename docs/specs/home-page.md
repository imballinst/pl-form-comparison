# Home page

- Shows all results of the past 10 matches (based on the latest mathcweek)
- Additionally, allows use of widget:
  -- The widget is a card-like element
  -- It can be added, moved, and removed
  -- Each widget represents a team, its form (past 5 matches), position, and next match
- The widget is stored locally (in browser local storage)
- Use zod to parse the widget content. If fail to parse, show empty condition.
- The empty condition is just 1 card with "Add wigdet" text with (+) icon.
- Use lucide-chart for the icons.

## Clarifications

Results Display

- "Past 10 matches": Does this mean the 10 most recent matches across all teams, or the 10 most recent matchweeks (which would be ~50-100 matches)?
  - The 10 most recent matchweeks

- How should the results be displayed? As a list, table, or grid of match cards?
  - Grid of match cards, 5x2 (or 2x5 on smaller screens)

Widget Functionality

- Adding widgets: Is there a maximum number of widgets a user can add? Can they add the same team multiple times?
  - Let's limit to 3.
- Moving widgets: Should this be drag-and-drop, or arrow buttons to reorder?
  - Drag and drop. Maybe consider using react-dnd or similar implementation.
- "Form (past 5 matches)": Should this show W/D/L icons, or also include scores? Should it link to match details?
  - WDL only, not link for now
- "Next match": What information should be shown? Just opponent, or also date/time and venue (home/away)?
  - Opponent, date/time, and venue
- Position: Is this the current league table position?
  - Yes

Widget UI/UX

- How should the "Add widget" flow work? A modal with team selection? A dropdown?
  - Maybe when the "Add" card is clicked, it will create a card, and from there, the team can be selected with a dropdown.
- Should there be a "Remove all widgets" or "Reset" option?
  - No.
- What should happen if the selected team has no upcoming matches (e.g., end of season)?
  - Show nothing.

Data & Storage

- Should the widget state sync across browser tabs?
  - No.
- What's the expected behavior when a new season starts? Should widgets persist or reset?
  - The past matches should depend on the CURRENT_SEASON.

Edge Cases

- What should be shown for newly promoted teams that don't have 5 past matches yet?
  - Show nothing, since it's always depends on CURRENT_SEASON.
- Should there be any loading/skeleton states while fetching data?
  - I suppose there will be no loading/skeleton states, always use clientLoader to load.
