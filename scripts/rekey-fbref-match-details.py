"""
Re-key scripts/references/{YEAR}-fbref-match-details.json files so that team
name segments use normalized app names (matching merge-migration.ts keys).

Idempotent: running on already-normalized keys is a no-op.
"""

from json import dump, load
from os.path import dirname, join
from pathlib import Path

from utils import normalize_fbref_name

REFS_DIR = join(dirname(__file__), "references")


def rekey_file(path: Path) -> tuple[int, int]:
    with open(path) as f:
        details = load(f)

    rewritten: dict[str, dict] = {}
    renamed = 0
    for old_key, value in details.items():
        parts = old_key.split("_")
        if len(parts) != 3:
            raise ValueError(f"{path}: unexpected key format: {old_key!r}")

        date, home, away = parts
        new_home = normalize_fbref_name(home)
        new_away = normalize_fbref_name(away)
        new_key = f"{date}_{new_home}_{new_away}"

        if new_key in rewritten:
            raise ValueError(
                f"{path}: collision after normalization — {old_key!r} "
                f"and an earlier key both map to {new_key!r}"
            )
        rewritten[new_key] = value
        if new_key != old_key:
            renamed += 1

    with open(path, "w") as f:
        dump(rewritten, f, indent=2, ensure_ascii=False)

    return renamed, len(details)


def main():
    targets = sorted(Path(REFS_DIR).glob("*-fbref-match-details.json"))
    if not targets:
        print("No fbref-match-details files found")
        return

    total_renamed = 0
    total_keys = 0
    for path in targets:
        renamed, count = rekey_file(path)
        status = "renamed" if renamed else "unchanged"
        print(f"  {path.name}: {count} keys, {renamed} {status}")
        total_renamed += renamed
        total_keys += count

    print(f"\nTotal: {total_keys} keys, {total_renamed} renamed")


if __name__ == "__main__":
    main()