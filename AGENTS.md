# AGENTS.md

## Test conventions

- Helper functions used only by tests (e.g. `seasonTags`, `countTags`) should be declared at the
  bottom of the test file, after the `test(...)` blocks — not between them. They are hoisted, so
  placement does not affect correctness, but keeping them below keeps the test intent readable first.
- When multiple tests cover the same subject with only minor variations, merge them into a single
  test and assert on all the cases at once (e.g. checking both the `2025` and `2024` score tags for
  Sunderland in one test rather than two).

## Cross-season team replacement (`app/utils/team-replacement.ts`)

- When resolving an equivalent team for a past season (`from > to`), look up promotion/relegation
  data from the **bigger season key down to the smaller** one. This tries the season closest to
  `from` first, which is the correct anchor for "the slot this promoted team replaced".
- Do not rely on `Object.keys` insertion order for that ordering — sort the keys explicitly
  descending.
- The `from > to` branch is the "going toward the past" direction, not "forward". Keep comments
  accurate: forward means current -> past conceptually here is reversed from the slot-anchor logic.
