import os
import re
from datetime import datetime, timedelta, timezone


YEAR = 2023


def resolve_datetime(date_str: str, time_str: str) -> str:
    m = re.match(r"(\d{2}:\d{2})\s*\((\d{2}:\d{2})\)", time_str)
    if m:
        uk_hour = int(m.group(1).split(":")[0])
        local_time = m.group(2)
        local_hour = int(local_time.split(":")[0])

        local_offset = datetime.now(timezone.utc).astimezone().utcoffset()
        offset_hours = int(local_offset.total_seconds() / 3600)
        offset_str = f"{offset_hours:+03d}:00"

        base = datetime.fromisoformat(f"{date_str}T{local_time}:00{offset_str}")
        if local_hour < uk_hour:
            base += timedelta(days=1)

        return base.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return f"{date_str}T00:00:00Z"


def maybe_get_chrome_path() -> str | None:
    env_path = os.environ.get("SOCCERDATA_BROWSER")
    if env_path:
        return env_path

    candidates = [
        os.path.expanduser(
            "~/Library/Caches/ms-playwright/chromium-1223/"
            "chrome-mac-arm64/Google Chrome for Testing.app/"
            "Contents/MacOS/Google Chrome for Testing"
        ),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None
