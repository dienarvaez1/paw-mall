#!/usr/bin/env bash
# Sets the running Android emulator's GPS to this Mac's location (development only).
#
#   pnpm --filter mobile emulator:location            # the Mac's location
#   pnpm --filter mobile emulator:location 19.4326 -99.1332   # a given latitude, longitude
#
# Where the Mac's location comes from, best first:
#   1. CoreLocationCLI (`brew install --cask corelocationcli`): the Mac's own Location Services,
#      precise. macOS asks once to allow it (System Settings > Privacy & Security > Location
#      Services).
#   2. Otherwise an approximate location from the internet connection's IP (ipinfo.io; city-level,
#      sometimes off by kilometers). Nothing is stored.
# Then tap the app's location button so the map re-centers.
set -euo pipefail

ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"
if [[ ! -x "$ADB" ]]; then
  echo "adb not found at $ADB (set ANDROID_HOME)." >&2
  exit 1
fi
if ! "$ADB" devices | grep -q '^emulator-.*device$'; then
  echo "No Android emulator is running." >&2
  exit 1
fi

if [[ $# -eq 2 ]]; then
  lat="$1"
  lng="$2"
  source="given"
elif command -v CoreLocationCLI >/dev/null 2>&1; then
  if ! out="$(CoreLocationCLI --format '%latitude %longitude' 2>&1)" || [[ "$out" == *"❌"* ]]; then
    echo "$out" >&2
    echo "Allow CoreLocationCLI in System Settings > Privacy & Security > Location Services, then run again." >&2
    exit 1
  fi
  read -r lat lng <<<"$out"
  source="Location Services"
else
  loc="$(curl -fsS --max-time 10 https://ipinfo.io/loc)"
  lat="${loc%,*}"
  lng="${loc#*,}"
  source="approximate, from your IP (install CoreLocationCLI for a precise one)"
fi

if ! [[ "$lat" =~ ^-?[0-9]+(\.[0-9]+)?$ && "$lng" =~ ^-?[0-9]+(\.[0-9]+)?$ ]]; then
  echo "Couldn't read a location (got '$lat', '$lng')." >&2
  exit 1
fi

# `geo fix` takes longitude first.
"$ADB" emu geo fix "$lng" "$lat" >/dev/null
echo "Emulator location set to $lat, $lng ($source). Tap the location button in the app."
