# End-to-end tests (Maestro)

Unit and API tests run with Vitest (`pnpm test`). The app's user journeys run end to end with
[Maestro](https://maestro.mobile.dev): YAML flows in `apps/mobile/.maestro/` that tap through the
real app on the Android emulator, on **fixed test data**, so they can check exact names and order.

## Fixed test data

`packages/importers/data/e2e-fixtures.json`: 12 fake places around the Zócalo (19.4326, -99.1332),
where every flow puts the user, plus "Tlaxcala", "Guadalupe" and "Toluca" as places' names.

| Place                             | Why it's there                                                    |
| --------------------------------- | ----------------------------------------------------------------- |
| Veterinaria Paw Centro            | Vet with phone, website, social media and confirmed all-day hours |
| Hospital Veterinario Paw 24 Horas | Hospital confirmed 24 hours (owner): first in Urgencias, open now |
| Hospital Veterinario Sin Teléfono | Hospital with no phone and unknown hours                          |
| Estética Canina Paw               | Groomer (category chips)                                          |
| Tienda de Mascotas Paw            | Pet store 2 km away (radius)                                      |
| Mascotas Tlaxcala                 | Business named like a place, near the user ("as business")        |
| Veterinaria Paw Tlaxcala          | Vet in Tlaxcala, about 110 km away ("as a place")                 |
| Café Perruno Paw                  | Café with a confirmed pet policy (dogs, any size, terrace)        |
| Restaurante Sin Política Paw      | Restaurant with no answer yet; `pet-friendly-widen` answers "yes" |
| Hotel Sin Política Paw            | Hotel nobody answers for (stays unconfirmed)                      |
| Forrajería Guadalupe Paw          | Feed store 7 km away, named like a place ("Guadalupe", Zacatecas) |
| Café Toluca Paw                   | Café (no policy) named like a place: only Pet-friendly finds it   |

`pnpm e2e:seed` loads it into its own database, **`paw_mall_e2e`** (never the dev or the Vitest
one): creates it if missing, applies the API's migrations, empties the place tables and inserts the
fixtures. Safe to re-run; run it before each Maestro run, since flows report and save things. No
flow taps "Ver horario" (each Google answer uses part of the free monthly allowance).

## Running

1. Once: `brew tap mobile-dev-inc/tap && brew install mobile-dev-inc/tap/maestro`, and the Android
   development build installed on the emulator (`docs/GOOGLE-PLACES.md`, "Android map key").
2. `pnpm db:up`, then `pnpm e2e:seed`.
3. The API on the test data: `pnpm --filter api dev:e2e` (port **8788**).
4. A Metro server that points the app at it: `pnpm --filter mobile e2e:metro` (port **8084**,
   `EXPO_PUBLIC_API_URL=http://10.0.2.2:8788`; 10.0.2.2 is the Mac as the emulator sees it).
5. `pnpm --filter mobile e2e` (30 flows, about 12 minutes on the release build) or
   `maestro test apps/mobile/.maestro/favorites.yaml` (one).

`common/launch.yaml` starts every flow the same way: GPS at the Zócalo, the app's data cleared,
location allowed, the e2e server opened, the development build's welcome menu closed. Flows find
controls by `testID` (`search-input`, `mode-map`, `mode-list`, `place-row`, `place-name`,
`favorite-button`, `language-toggle`, `tab-<name>`, `map-count`, `urgent-count`, `map-pins`,
`keyboard-hide`) and fixture names, so keep those when changing
the screens.

Results: `pnpm --filter mobile e2e` writes to `apps/mobile/e2e-results/` (git-ignored, replaced
each run): `report.xml` (JUnit, one entry per flow) and a folder per flow with its steps
(`commands.json`), logs (`maestro.log`, Android `device-logcat.txt`) and screenshots of failures.
A plain `maestro test` writes the same to `~/.maestro/tests/<date_time>/`.

The everyday Metro (port 8081, real data) and the e2e one (8084) can run side by side.

### API down

`.maestro/api-down/` holds the flow for "online, but the API is down"; it's kept out of the main
run (which needs the API). Stop the e2e API (`dev:e2e`, port 8788), then
`pnpm --filter mobile e2e:api-down` (results in `e2e-results/report-api-down.xml`). CI runs it after
the other flows (`scripts/e2e-ci.sh` stops the API first).

### iOS (Expo Go on the simulator)

The same flows run on the iOS simulator in **Expo Go** (no iOS development build: it would need
CocoaPods and a native build). Local only: CI's macOS runners cost ten times the Linux minutes.

1. Expo Go installed on a booted simulator; `pnpm db:up`, `pnpm e2e:seed`, `pnpm --filter api dev:e2e`.
2. A Metro for Expo Go pointing at the e2e API: `pnpm --filter mobile e2e:metro-ios` (port **8085**,
   `EXPO_PUBLIC_API_URL=http://127.0.0.1:8788`; the simulator reaches the Mac at 127.0.0.1).
3. `pnpm --filter mobile e2e:ios` (`IOS=true`, `APP_ID=host.exp.Exponent`, flows tagged
   `android-only` skipped). With the Android emulator also running, add
   `--device <simulator id>` (`xcrun simctl list devices booted`).

How the flows stay cross-platform:

- `common/launch.yaml` opens `exp://127.0.0.1:8085` in Expo Go and closes its developer-menu
  introduction and sheet; location permission is `inuse` on iOS, `allow` on Android.
- `common/back.yaml`: the system back on Android, the edge swipe on iOS. `common/hide-keyboard.yaml`:
  `hideKeyboard` on Android, the Return key on iOS.
- iOS reads a button or list row as **one** accessibility label ("Veterinaria Paw Centro, a 0.3 km,
  …"; the call link as "Llamar a …"), so flows match place names as `Name.*` and button texts as
  `.*text.*` or `(Llamar|Call)( .*)?`.
- `offline` is tagged `android-only` (airplane mode can't be switched on the simulator).

## Journey list (coverage)

The measure of UI coverage: each journey a user can take, and the flow that checks it.

| Area         | Journey                                                                    | Flow                      |
| ------------ | -------------------------------------------------------------------------- | ------------------------- |
| Language     | The globe switches ES ↔ EN (tab names)                                     | `language`                |
| Search       | Typing suggests places, never asks; a picked place searches there directly | `place-question`          |
| Search       | Picked place → the places there, not the namesake near the user            | `place-question`          |
| Search       | Search key on a place's name asks; as a business → only that name, nearby  | `place-question-business` |
| Search       | Typed text searches business names without asking                          | `search-clear`            |
| Search       | A confirmed search closes the radius in to its matches (15 km → 5 km)      | `search-zoom`             |
| Search       | Nothing inside the radius → it opens out to the nearest match (5 → 10 km)  | `search-zoom-out`         |
| Search       | Only the other tab finds the name → it takes the focus                     | `search-section`          |
| Search       | Other text + search key fits too ("forrajeria": 5 → 10 km)                 | `search-typed-fit`        |
| Search       | A kind of business + a place, either order, goes there with no question    | `service-in-place`        |
| Search       | A place + any words ("Paw Tlaxcala") goes there, not a 160 km name search  | `service-in-place`        |
| Search       | Moving the map lets go of a picked place: box empties, "Mi ubicación" off  | `search-pan`              |
| Urgencias    | Names its circle as the map does, after a pan and a visit to the other tab | `urgent-sync`             |
| Search       | After a search, switching tabs keeps the same circle (no second fit)       | `maps-sync`               |
| Search       | ✕ clears the text and the full list comes back                             | `search-clear`            |
| Explore      | Map and List count the same places                                         | `map-list`                |
| Explore      | A category chip narrows the list; Todos brings everything back             | `chips`                   |
| Explore      | Radius button steps up to 160 km; the vet 110 km away appears              | `radius`                  |
| Explore      | Moving the map turns "Mi ubicación" off; turning it on comes back          | `near-me`                 |
| Explore      | Satellite toggle on/off; compass; pin button 200 → 300 → 50; keyboard tab  | `map-buttons`             |
| Explore      | No places in the radius → "No hay lugares…"                                | `empty`                   |
| Pet-friendly | Confirmed place listed; unconfirmed left out by default                    | `pet-friendly`            |
| Pet-friendly | No confirmed match → widens to unconfirmed venues, with a notice           | `pet-friendly-widen`      |
| Pet-friendly | On an unconfirmed venue's page, answer "¿Acepta perros?" → thanks          | `pet-friendly-widen`      |
| Urgencias    | Vet hospitals near the user; a card opens the place's page                 | `emergencies`             |
| Place page   | Contact links only for what the place has (phone, website, social)         | `place-page`              |
| Place page   | Tap the address → "Nombre y dirección copiados"                            | `place-page`              |
| Place page   | Report "closed" → confirm → thanks                                         | `report-closed`           |
| Place page   | Report animal cruelty → confirm (anonymous note) → thanks                  | `report-cruelty`          |
| Place page   | Claim form: says what's missing, then sends                                | `claim`                   |
| Favoritos    | Heart saves; tapping again removes it (empty state)                        | `favorites`               |
| Favoritos    | Several saved places, newest first                                         | `favorites-order`         |
| Ajustes      | "Solo lugares con teléfono" hides the hospital without a phone (Urgencias) | `settings-phone`          |
| Ajustes      | Kilómetros → Millas: distances and radius in miles                         | `settings-units`          |
| States       | No connection → offline banner; back online → the app loads again          | `offline`                 |
| States       | Online but the API down → "No pudimos conectar con el servidor" and retry  | `api-down/api-down`       |

All 36 journeys covered by 31 flows (30 in the main run, plus `api-down`), on Android; on iOS
(Expo Go) all but `offline`. Not covered: the development build on iOS (Expo Go stands in for it),
and a database outage behind a running API (covered by the API's tests, `database-down.test.ts`).

## GitHub Actions

- `.github/workflows/ci.yml`: `pnpm lint`, `pnpm typecheck`, `pnpm test` on every pull request
  and on main, with Postgres started by `pnpm db:up` (about 5 minutes).
- `.github/workflows/e2e.yml`: every flow on an Android emulator (API 34) — nightly, by hand
  (Actions > E2E > Run workflow), or on a pull request labeled `run-e2e`; about an hour. It seeds
  `paw_mall_e2e`, starts the API on 8788, builds a **release** APK with the code and
  `EXPO_PUBLIC_API_URL=http://10.0.2.2:8788` built in (no Metro, so no bundle-loading stalls), and
  runs `apps/mobile/scripts/e2e-ci.sh` (`maestro test -e BUNDLED=true`, which skips the development
  server steps in `common/launch.yaml`). The `e2e-results` artifact holds the per-flow logs and
  screenshots; the JUnit report shows as a "Maestro flows" check.
- Needs the repository secret `GOOGLE_MAPS_ANDROID_KEY` (Settings > Secrets and variables >
  Actions). The release build is signed with React Native's standard debug key, so the key's
  package + SHA-1 restriction already matches.
- Cost: a private repo's free plan has 2,000 Actions minutes a month.
- To try the CI path locally: build the release APK the same way (`EXPO_PUBLIC_API_URL=http://10.0.2.2:8788`,
  then `./gradlew assembleRelease` in `apps/mobile/android`), `pnpm e2e:seed`, the API with `dev:e2e`,
  then `bash apps/mobile/scripts/e2e-ci.sh` (21 flows in about 8 minutes on 2026-10-13). It replaces
  the development build on the emulator; `pnpm --filter mobile android:dev` puts it back.
