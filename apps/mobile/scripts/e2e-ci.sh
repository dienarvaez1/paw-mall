#!/usr/bin/env bash
# CI end-to-end run (.github/workflows/e2e.yml), inside the Android emulator step: installs the
# release build (the code and the e2e API's address built in) and runs every Maestro flow on it.
# Results, as with `pnpm e2e`, go to e2e-results/.
set -euo pipefail
cd "$(dirname "$0")/.."

adb install -r android/app/build/outputs/apk/release/app-release.apk
maestro test -e BUNDLED=true \
  --test-output-dir e2e-results --format junit --output e2e-results/report.xml \
  .maestro
