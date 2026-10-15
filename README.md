# Paw Mall

Paw Mall (working name) is a mobile app for pet owners in Mexico. It answers two everyday
questions:

- **Where's the pet business I need?** Vets and vet hospitals, pet stores, boutiques, groomers,
  boarding, feed stores and more, on a map and a list, with a fast path to the nearest emergency
  vet.
- **Where can I go with my pet?** Restaurants, cafés, lodging, museums and parks with their pet
  policy (dogs or cats, size limits, terrace or indoors).

It covers all 32 states of Mexico with open data (INEGI DENUE, Overture Maps, OpenStreetMap,
Wikidata) plus hand-collected pet policies. Spanish first (`es-MX`), English alongside.

**Status:** development only. Nothing is deployed; everything runs on a developer machine. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for what's built so far.

## Screenshots

Taken on 2026-10-14 in Colonia Condesa, Mexico City, with the full development data. Android is
the release build on the emulator (Pixel 10, Google Maps); iOS is Expo Go on the simulator
(iPhone 17 Pro Max, Apple Maps). [docs/USER-GUIDE.md](docs/USER-GUIDE.md) describes each screen.

| Screen                                                                     | Android                                                             | iOS                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Explorar, map:** pet businesses within the radius, grouped into clusters | <img src="docs/screenshots/android-1-map.jpg" width="220">          | <img src="docs/screenshots/ios-1-map.jpg" width="220">          |
| **Explorar, list:** nearest first, with category, address and contact      | <img src="docs/screenshots/android-2-list.jpg" width="220">         | <img src="docs/screenshots/ios-2-list.jpg" width="220">         |
| **Place page:** verification, directions, website, hours and reports       | <img src="docs/screenshots/android-3-place.jpg" width="220">        | <img src="docs/screenshots/ios-3-place.jpg" width="220">        |
| **Pet-friendly:** parks, restaurants, cafés and lodging with their policy  | <img src="docs/screenshots/android-4-pet-friendly.jpg" width="220"> | <img src="docs/screenshots/ios-4-pet-friendly.jpg" width="220"> |
| **Urgencias:** vet hospitals nearest first, with call and share            | <img src="docs/screenshots/android-5-urgent.jpg" width="220">       | <img src="docs/screenshots/ios-5-urgent.jpg" width="220">       |
| **Ajustes:** language, distance units, pet and listing filters             | <img src="docs/screenshots/android-6-settings.jpg" width="220">     | <img src="docs/screenshots/ios-6-settings.jpg" width="220">     |

## Repository

A pnpm + Turborepo monorepo:

| Path                 | What it is                                                                    |
| -------------------- | ----------------------------------------------------------------------------- |
| `apps/mobile`        | The Expo (React Native) app for iOS and Android                               |
| `apps/api`           | The Hono API (Cloudflare Workers, run locally with `wrangler dev`) and the DB |
| `packages/shared`    | Zod schemas, types and constants used by the app, the API and the importers   |
| `packages/importers` | Scripts that load and enrich the place data                                   |
| `docker/postgres`    | PostgreSQL 17 + PostGIS image                                                 |
| `docs/`              | Plan, architecture, guides and the rollout log                                |

## Quick start

Needs Node 24, pnpm, Docker and, for the app, Expo Go on a phone or the iOS simulator / Android
emulator. The full setup, including Android development builds, is in
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

```sh
pnpm install
pnpm db:up && pnpm db:migrate          # Postgres + PostGIS in Docker, port 5434
pnpm places:import                     # pet businesses from INEGI DENUE (and the other loaders)
pnpm --filter api dev                  # API on http://localhost:8787
pnpm --filter mobile start             # Metro; scan the QR code with Expo Go
```

## Everyday commands

| Command                                  | Does                                                             |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `pnpm lint` / `pnpm typecheck`           | ESLint and TypeScript in every package                           |
| `pnpm test`                              | Vitest in every package (the API tests use `paw_mall_test`)      |
| `pnpm db:up` / `pnpm db:down`            | Start or stop the database                                       |
| `pnpm db:migrate`                        | Apply the API's migrations                                       |
| `pnpm places:*`                          | Data loaders (list in [DEVELOPMENT.md](docs/DEVELOPMENT.md))     |
| `pnpm --filter mobile e2e`               | Maestro end-to-end flows ([TESTING-E2E.md](docs/TESTING-E2E.md)) |
| `pnpm --filter mobile e2e:ios`           | The same flows on the iOS simulator in Expo Go                   |
| `pnpm --filter mobile android:dev`       | Build and run the Android development build                      |
| `pnpm --filter mobile emulator:location` | Set the Android emulator's GPS to this Mac's location            |

## Documentation

| Document                                       | For                                                          |
| ---------------------------------------------- | ------------------------------------------------------------ |
| [docs/USER-GUIDE.md](docs/USER-GUIDE.md)       | How the app works, screen by screen                          |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)   | How the pieces fit: app, API, database, data pipeline        |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)     | Setting up, running, conventions and troubleshooting         |
| [docs/TESTING-E2E.md](docs/TESTING-E2E.md)     | End-to-end flows, test data and the GitHub Actions workflows |
| [docs/GOOGLE-PLACES.md](docs/GOOGLE-PLACES.md) | Google "Ver horario" and the Android Maps key                |
| [docs/PLAN.md](docs/PLAN.md)                   | The build plan, phase by phase, and open decisions           |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)       | The rollout log: what each phase and PR delivered            |
| [CLAUDE.md](CLAUDE.md)                         | Standing rules for working in this repo                      |

## Data sources

Business data: INEGI, Directorio Estadístico Nacional de Unidades Económicas (DENUE). Phones,
websites and social media: Overture Maps Foundation. Landmarks: Wikidata. Dog parks, venues,
hours and some vets' phones: © OpenStreetMap contributors (ODbL). Pet policies: hotel chains' and businesses' own
websites, the press and Paw Mall users. Hours on request: Google Maps. Each source is credited
in the app wherever its data appears.
