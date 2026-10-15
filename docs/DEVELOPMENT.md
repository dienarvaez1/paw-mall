# Paw Mall — Developer Guide

Setting up, running and changing Paw Mall on a Mac. How the parts fit together is in
[ARCHITECTURE.md](ARCHITECTURE.md); the standing rules for this repo are in
[CLAUDE.md](../CLAUDE.md).

## Requirements

| Tool                 | Version / note                                                                 |
| -------------------- | ------------------------------------------------------------------------------ |
| Node                 | 24 (`.node-version`; fnm or nvm)                                               |
| pnpm                 | the version in `package.json` → `packageManager` (Corepack)                    |
| Docker Desktop       | for PostgreSQL + PostGIS                                                       |
| Expo Go              | on a phone, or in the iOS simulator — the quickest way to run the app          |
| Xcode                | for the iOS simulator                                                          |
| Android Studio + SDK | for the Android emulator and development builds; **JDK 17** for Gradle (below) |
| Maestro              | for end-to-end flows only (`brew install mobile-dev-inc/tap/maestro`)          |
| k6                   | for the load test only (`brew install k6`)                                     |

## First run

```sh
pnpm install
pnpm db:up            # Postgres 17 + PostGIS in Docker, port 5434 (user/password paw/paw)
pnpm db:migrate       # applies apps/api/src/db/migrations
```

Load the data (each step is safe to re-run; `--dry-run` on `places:import` reports without
writing):

```sh
pnpm places:import            # INEGI DENUE, all 32 states (zips cached after the first run)
pnpm places:enrich-overture   # phones, websites, social pages from Overture Maps
pnpm places:check-websites    # visits each website once (about an hour for all of Mexico)
pnpm places:areas             # colonias, cities and landmarks for the search box
pnpm search:synonyms          # words that mean the same in names (data/search-synonyms.json)
pnpm places:curated           # hand-collected pet-friendly places
pnpm places:osm               # OpenStreetMap dog parks and venues (--refresh for a new snapshot)
pnpm places:osm-hours         # OpenStreetMap opening hours
pnpm places:osm-phones        # OpenStreetMap phones for vets without one
pnpm places:chains            # chain-wide pet policies
```

Volumes and times of a full run are in [DEPLOYMENT.md](DEPLOYMENT.md) (Phase 10).

## Secrets and local files

| File                     | Holds                                                                | Committed |
| ------------------------ | -------------------------------------------------------------------- | --------- |
| `apps/api/.dev.vars`     | `GOOGLE_PLACES_API_KEY` for "Ver horario" (copy `.dev.vars.example`) | No        |
| `apps/mobile/.env.local` | `GOOGLE_MAPS_ANDROID_KEY` for Android builds (copy `.env.example`)   | No        |
| `docs/diary_*.md`        | Working diary                                                        | No        |

Never print or commit a key. Setup of both Google keys: [GOOGLE-PLACES.md](GOOGLE-PLACES.md).

## Running

### API

```sh
pnpm --filter api dev         # http://localhost:8787 and the Mac's LAN IP (for phones)
curl localhost:8787/health
```

### App with Expo Go (iPhone, iOS simulator)

```sh
pnpm --filter mobile start    # Metro on 8081; scan the QR code with the phone's camera
pnpm --filter mobile ios      # or open it in the iOS simulator
```

The app finds the API at the Metro host's IP on port 8787, or at `EXPO_PUBLIC_API_URL` when set.
The phone and the Mac must be on the same network.

### Android development build

Expo Go's Google Maps key doesn't work on the Android emulator, so Android uses a development
build (package `dev.pawmall.app`) with Paw Mall's own key:

1. Put the key in `apps/mobile/.env.local` ([GOOGLE-PLACES.md](GOOGLE-PLACES.md) has the
   package + SHA-1 restriction).
2. Use **JDK 17**: Android Studio's bundled JDK 25 fails in the native build. Gradle downloads
   one; point `JAVA_HOME` at it, e.g.
   `export JAVA_HOME=~/.gradle/jdks/eclipse_adoptium-17-aarch64-os_x.2/jdk-17.0.20.1+1/Contents/Home`.
3. `pnpm --filter mobile android:dev` builds, installs and starts it with Metro.
4. `pnpm --filter mobile emulator:location` sets the emulator's GPS to this Mac's location
   (CoreLocationCLI, or approximate from the IP); `… emulator:location 19.4326 -99.1332` for a
   given spot.

`android/` is generated (`expo prebuild`) and git-ignored; after changing `app.config.ts` run
`npx expo prebuild --platform android --clean`.

## Checks

```sh
pnpm lint && pnpm typecheck && pnpm test
pnpm i18n:check               # every Spanish string has an English one
pnpm format:check
```

The API tests use their own database (`paw_mall_test`), created and migrated by the test setup;
they never touch the dev data. End-to-end flows: [TESTING-E2E.md](TESTING-E2E.md).

### Load test

`apps/api/load/places.js` (k6) sends what people browsing do (nearby list and map, search,
suggestions, detail, Urgencias) from six busy cities, ramping to 50 users at once for 1 m 45 s,
plus one burst of 25 writes that must hit the rate limit after 20. It fails when 95% of reads
take 500 ms or more, or more than 1% fail.

```sh
pnpm --filter api dev:load    # API on :8789 with the dev data and no Google key
pnpm load                     # PEAK_USERS=10 pnpm load for a lighter run
```

Local only: never point it at a deployed API. It never calls "Ver horario" (a billed Google
request), and `dev:load` runs without the Google key anyway. The writes fail validation, so
nothing is stored. It measures the queries and the database, not Cloudflare or a production
database. Results on 2026-10-14 (M-series Mac, Docker with 4 CPUs, 813k places): p95 229 ms at
77 requests/s.

### Search benchmark

`packages/importers/data/search-benchmark.json` holds 51 labeled Spanish and English searches
from nine cities: services, synonyms, accents, a typo, English words, business names, place names
and negative cases (puppy mills, cockfighting, unrelated words). Each is sent to the API as the
app sends it (typed text as names only; Pet-friendly with its default filter), and its top 10 are
judged against the label in SQL, never by the search code. QA strategy, section 5.

```sh
pnpm --filter api dev          # the API on :8787 with the dev data
pnpm search:bench              # scores and compares with data/search-baseline.json
pnpm search:bench --only vet-cdmx   # one query, with its results
pnpm search:bench --check      # exits 1 when a query regressed
pnpm search:bench --save       # records a new baseline (commit it)
```

Metrics: precision@10 (results that match the intent), recall@10 (relevant places in the judged
circle that made the top 10, out of at most 10), zero results (none, and no nearer match for the
app to widen to), known items found, negative cases passed, place intent (a place search moved to
the right place) and latency. A regression is precision or recall down by more than 0.1, a known
item lost, a new zero result, a negative case returning places, or a wrong place. Run it before
and after any change to search, and commit a new baseline with the change. It reads the dev data,
so CI can't run it; a re-import changes the data and the results (the report says so).

Labels are drafts until the owner reviews them (`review.status` in the file). Baseline after
Phase 18's fixes (2026-10-14, 813k visible places): precision@10 99%, recall@10 96%, zero
results 0%, known items, negative cases and place intent 100%, latency p50 29 ms and p95 48 ms.
Phase 17's first baseline was precision 93%, recall 72%, zero results 5%. Phase 19 added six
queries (a place with other words, in both orders; `exact` mode for "by that name"; `widened`
for Pet-friendly's unconfirmed venues): 47 queries, precision 99%, recall 97%, p95 43 ms. Phase 20
(full-text search) added two ("perritos": 60% → 100% recall; "tacos"): 51 queries, precision 99%,
recall 97%, p95 47 ms, no regression.

## Conventions (summary of CLAUDE.md)

- Code, identifiers, comments, commits and docs in English; every visible text through
  `t('namespace.key')` with Spanish and English values in the same change.
- Numbers, distances, dates and times with `Intl` and the active locale.
- Shared types and validation live in `packages/shared`; the app talks only to the API.
- Styling with NativeWind classes; the autocomplete list (`autocomplete-search.tsx`) uses
  StyleSheet and `Platform.select` by the owner's request.
- Credit every data source where its data appears.
- Ask the owner before adding a dependency that isn't in PLAN.md's Tech stack table.
- Reporter privacy: reports store only a reason and the app's random id.
- No animal cruelty: never list puppy mills, kill shelters, slaughterhouses or butchers.
- Development only: no deploys or cloud resources unless the owner asks.

## Git workflow

- One branch per piece of work from an up-to-date `main` (`phase-N/<name>` for plan phases); never
  commit to `main`.
- Open a PR; CI (lint, typecheck, tests) must pass. Add the `run-e2e` label to run the Maestro
  flows on GitHub.
- Record each PR in [DEPLOYMENT.md](DEPLOYMENT.md); squash-merge; delete the branch; the next
  branch's first commit records the merge commit.

## Adding a data source

1. A new adapter folder in `packages/importers/src/<source>/` with a `cli.ts` and a script in
   `packages/importers/package.json` (and a `places:<name>` alias in the root `package.json`).
2. A test with a small sample file in `packages/importers/test/fixtures/`.
3. Credit the source in the app (`settings.dataSources` and wherever its data shows).
4. Document the step in this guide and in CLAUDE.md's Local setup.

## Troubleshooting

| Symptom                                                                           | Fix                                                                                                  |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Metro errors "Failed to get the SHA-1" / "Unable to resolve" after `pnpm install` | Restart Metro with a cleared cache: `pnpm --filter mobile start --clear`                             |
| Gradle: "A restricted method in java.lang.System has been called"                 | Use JDK 17 (`JAVA_HOME`, above)                                                                      |
| Android map: "API key not found", or a "map unavailable" notice                   | Put `GOOGLE_MAPS_ANDROID_KEY` in `apps/mobile/.env.local` and rebuild                                |
| Release bundle: "Cannot find module '@babel/plugin-transform-react-jsx'"          | It's hoisted by `publicHoistPattern` in `pnpm-workspace.yaml`; run `pnpm install`                    |
| Android emulator freezes or its system UI crashes                                 | Cold boot with software graphics: `emulator -avd <name> -no-snapshot-load -gpu swiftshader_indirect` |
| The e2e API (port 8788) stops after editing API files                             | `wrangler dev` can crash on reload; restart `pnpm --filter api dev:e2e`                              |
| The iPhone app shows old code or stays blank                                      | Close Expo Go and reopen the project; restart Metro with `--clear`                                   |
| No location on the emulator                                                       | `pnpm --filter mobile emulator:location`                                                             |
