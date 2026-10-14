#!/usr/bin/env bash
# CI end-to-end run (.github/workflows/e2e.yml), inside the Android emulator step: installs the
# release build (the code and the e2e API's address built in) and runs every Maestro flow on it,
# then stops the e2e API and runs the "API down" flow. Results, as with `pnpm e2e`, go to
# e2e-results/ (report.xml and report-api-down.xml).
set -euo pipefail
cd "$(dirname "$0")/.."

adb install -r android/app/build/outputs/apk/release/app-release.apk
status=0
maestro test -e BUNDLED=true \
  --test-output-dir e2e-results --format junit --output e2e-results/report.xml \
  .maestro || status=$?

# The phone stays online; only the API goes away (wrangler and its workerd runtime).
pkill -f 'wrangler dev' || true
pkill -f workerd || true
maestro test -e BUNDLED=true \
  --test-output-dir e2e-results/api-down --format junit --output e2e-results/report-api-down.xml \
  .maestro/api-down || status=$?
exit "$status"
