# End-to-end tests (Maestro)

Unit and API tests run with Vitest (`pnpm test`). The app's user journeys run end to end with
[Maestro](https://maestro.mobile.dev): YAML flows in `apps/mobile/.maestro/` that tap through the
real app on the Android emulator, on **fixed test data**, so they can check exact names and order.

## Fixed test data

`packages/importers/data/e2e-fixtures.json`: 10 fake places around the Zócalo (19.4326, -99.1332),
where every flow puts the user, plus "Tlaxcala" as a place's name.

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
5. `pnpm --filter mobile e2e` (21 flows, about 25 minutes) or
   `maestro test apps/mobile/.maestro/favorites.yaml` (one).

`common/launch.yaml` starts every flow the same way: GPS at the Zócalo, the app's data cleared,
location allowed, the e2e server opened, the development build's welcome menu closed. Flows find
controls by `testID` (`search-input`, `mode-map`, `mode-list`, `place-row`, `place-name`,
`favorite-button`, `language-toggle`, `tab-<name>`) and fixture names, so keep those when changing
the screens.

Results: `pnpm --filter mobile e2e` writes to `apps/mobile/e2e-results/` (git-ignored, replaced
each run): `report.xml` (JUnit, one entry per flow) and a folder per flow with its steps
(`commands.json`), logs (`maestro.log`, Android `device-logcat.txt`) and screenshots of failures.
A plain `maestro test` writes the same to `~/.maestro/tests/<date_time>/`.

The everyday dev server (port 8083, real data) and the e2e one (8084) can run side by side.

## Journey list (coverage)

The measure of UI coverage: each journey a user can take, and the flow that checks it.

| Area         | Journey                                                                    | Flow                      |
| ------------ | -------------------------------------------------------------------------- | ------------------------- |
| Language     | The globe switches ES ↔ EN (tab names)                                     | `language`                |
| Search       | Typing suggests places, never asks; a picked place searches there directly | `place-question`          |
| Search       | Picked place → the places there, not the namesake near the user            | `place-question`          |
| Search       | Search key on a place's name asks; as a business → only that name, nearby  | `place-question-business` |
| Search       | Typed text searches business names without asking                          | `search-clear`            |
| Search       | ✕ clears the text and the full list comes back                             | `search-clear`            |
| Explore      | Map and List count the same places                                         | `map-list`                |
| Explore      | A category chip narrows the list; Todos brings everything back             | `chips`                   |
| Explore      | Radius button steps up to 160 km; the vet 110 km away appears              | `radius`                  |
| Explore      | Moving the map turns "Mi ubicación" off; turning it on comes back          | `near-me`                 |
| Explore      | Satellite toggle on/off; compass                                           | `map-buttons`             |
| Explore      | No places in the radius → "No hay lugares…"                                | `empty`                   |
| Pet-friendly | Confirmed place listed; unconfirmed left out by default                    | `pet-friendly`            |
| Pet-friendly | No confirmed match → widens to unconfirmed venues, with a notice           | `pet-friendly-widen`      |
| Pet-friendly | On an unconfirmed venue's page, answer "¿Acepta perros?" → thanks          | `pet-friendly-widen`      |
| Urgencias    | Vet hospitals near the user; a card opens the place's page                 | `emergencies`             |
| Place page   | Contact links only for what the place has (phone, website, social)         | `place-page`              |
| Place page   | Tap the address → "Nombre y dirección copiados"                            | `place-page`              |
| Place page   | Report "closed" → confirm → thanks                                         | `report-closed`           |
| Place page   | Claim form: says what's missing, then sends                                | `claim`                   |
| Favoritos    | Heart saves; tapping again removes it (empty state)                        | `favorites`               |
| Favoritos    | Several saved places, newest first                                         | `favorites-order`         |
| Ajustes      | "Solo lugares con teléfono" hides the hospital without a phone (Urgencias) | `settings-phone`          |
| Ajustes      | Kilómetros → Millas: distances and radius in miles                         | `settings-units`          |
| States       | No connection → offline banner; back online → the app loads again          | `offline`                 |

All 25 journeys covered by 21 flows. Not covered: the API itself down while the phone is online
(only reachable by stopping the server; the offline flow covers the same error path), the
cruelty report (same form as "closed"), and anything on iOS.

iOS: not covered yet (the development build is Android only; iOS runs in Expo Go).

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
