import os
import platform
import re
import shutil
from datetime import datetime, timedelta, timezone


YEAR = 2025


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


def _candidates() -> list[str]:
    system = platform.system()

    if system == "Darwin":
        return [
            os.path.expanduser(
                "~/Library/Caches/ms-playwright/chromium-1223/"
                "chrome-mac-arm64/Google Chrome for Testing.app/"
                "Contents/MacOS/Google Chrome for Testing"
            ),
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]

    if system == "Windows":
        candidates = []
        for drive in ("C:", "D:"):
            for program_dir in ("Program Files", "Program Files (x86)"):
                base = f"{drive}\\{program_dir}"
                candidates.extend([
                    f"{base}\\Google\\Chrome\\Application\\chrome.exe",
                    f"{base}\\Chromium\\Application\\chrome.exe",
                ])
        if local_app_data := os.environ.get("LOCALAPPDATA"):
            candidates.append(f"{local_app_data}\\Google\\Chrome SxS\\Application\\chrome.exe")
        return candidates

    if system == "Linux":
        flatpak = os.path.expanduser(
            "~/.local/share/flatpak/exports/bin/com.google.Chrome"
        )
        snap = "/snap/bin/chromium"
        return [
            flatpak,
            snap,
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
        ]

    return []


def maybe_get_chrome_path() -> str | None:
    # In CI, the simplest approach is:
    #
    #   env:
    #     PLAYWRIGHT_BROWSERS_PATH: /tmp/playwright-browsers
    #   script:
    #     - playwright install chromium
    #
    # The playwright cache walk below will find it automatically.
    #
    # If you prefer a fixed SOCCERDATA_BROWSER, resolve after install:
    #
    #   script:
    #     - playwright install chromium
    #     - export SOCCERDATA_BROWSER=$(ls /tmp/playwright-browsers/chromium-*/chrome-*/chrome | head -1)
    env_path = os.environ.get("SOCCERDATA_BROWSER")
    if env_path:
        return env_path

    path = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("chrome")
    if path:
        return path

    for path in _candidates():
        if os.path.isfile(path):
            return path

    playwright_home = os.environ.get("PLAYWRIGHT_BROWSERS_PATH") or os.path.expanduser("~/Library/Caches/ms-playwright")
    if os.path.isdir(playwright_home):
        for entry in os.listdir(playwright_home):
            chromedir = os.path.join(playwright_home, entry)
            if not entry.startswith("chromium") or not os.path.isdir(chromedir):
                continue
            for root, _dirs, files in os.walk(chromedir):
                for name in files:
                    if name in ("chrome", "chrome.exe"):
                        full = os.path.join(root, name)
                        if os.path.isfile(full) and os.access(full, os.X_OK):
                            return full

    return None
