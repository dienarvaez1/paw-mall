# CLAUDE.md

Standing rules for Claude Code in this repo. The full build plan is in `docs/PLAN.md`; work one
phase at a time. The rollout of each phase (branch, pull request, status, checks) is tracked in
`docs/DEPLOYMENT.md`.

## Conventions

- All code, identifiers, comments, commit messages, docs and test names in English.
- No user-facing string in code. Every visible text goes through `t('namespace.key')`; add the
  Spanish value to `es` and an English value to `en` in the same change.
- Format numbers, distances, dates and times with `Intl` and the active locale.
- Shared types and validation live in `packages/shared`; the app and API import them, never
  duplicate them.
- The app talks only to the API; it never reads data files directly.
- New data sources are new adapters in `packages/importers`, each with a test using a small sample
  file.
- Each phase ends with passing `pnpm lint`, `pnpm typecheck` and `pnpm test`, and a commit with a
  clear message.
- Ask before adding a dependency that isn't in the Tech stack table of `docs/PLAN.md`.
- **Development only:** never deploy, create cloud resources or run production scripts unless the
  owner asks.
- Credit every data source where its data appears (INEGI, Overture Maps Foundation, Google Maps,
  cultural sources).
- No scraping of sites whose terms forbid it; no CAPTCHA bypassing.
- **Reporter privacy:** user reports (closed, animal cruelty) are stored only in the app's own
  tables. Never record location or personal information from the reporting phone (no
  coordinates, IP, name or contact); only a random id the app generates, to count each phone once.
- **No animal cruelty:** never list puppy mills, kill shelters, slaughterhouses or butchers.
  Pet stores that sell animals, and vets and feed stores that serve farm animals, are fine.

## Rollout workflow

- One branch per phase, `phase-N/<short-name>`, from an up-to-date `main`, with one pull request
  titled `Phase N: <name>`.
- Update `docs/DEPLOYMENT.md` on the phase branch: status, PR link, checks, notes, follow-ups.
- Merge only after lint, typecheck, tests and the phase's "Done when" check pass. Never commit
  straight to `main`.

## Decisions in force

Defaults from "Open decisions" in `docs/PLAN.md`, until the owner says otherwise:

- Repo visibility: private.
- App name and bundle ID: "Paw Mall" is a working name; don't set a store bundle ID.
- Region: Ciudad de México, Estado de México, Morelos, Hidalgo, Puebla, Tlaxcala, plus Guerrero,
  Michoacán and Querétaro (added 2026-10-05 with the 100-mile radius); locale `es-MX`.
- Shared code with Ferre Mall: copy now, extract a package later.
- Audience: pet owners, no login.
- Pet-friendly coverage at launch: curated CDMX restaurants and lodging.
- Vet license check: off until the registry's terms are confirmed.
- Live animal sales: listed. Municipal animal control centers: listed as public services.
- Feed stores (DENUE 434112): imported as forrajerías.

## Local setup

- Database: `pnpm db:up` (Postgres 17 + PostGIS in Docker on port 5434), then `pnpm db:migrate`.
  Tests use their own database, `paw_mall_test` on the same server, which the test setup creates
  and migrates; they never touch the dev data.
- API: `pnpm --filter api dev` serves `http://localhost:8787` (and the LAN IP, for phones).
- App: `pnpm --filter mobile start`, then scan the QR code with Expo Go.
- Data: `pnpm places:import` (DENUE, about 15 s from the cached zips), then
  `pnpm places:enrich-overture` and `pnpm places:check-websites` (visits each business website
  once), then `pnpm places:areas` (colonias, cities and landmarks for the search box). Each is
  safe to re-run; `pnpm places:import --dry-run` reports without writing.
- Pet-friendly: `pnpm places:curated` (hand-collected places), then `pnpm places:osm`
  (OpenStreetMap snapshot `data/osm-dogs-cdmx.json`; `--refresh` fetches a new one). Run both after
  `pnpm places:import`: they hide DENUE copies of their venues.
- Landmarks: `pnpm places:landmarks` refreshes the committed Wikidata snapshot
  (`packages/importers/data/landmarks-wikidata.json`); run `pnpm places:areas` after it. The
  curated `data/landmarks.json` wins over Wikidata on the same name.
- Owner review: `pnpm places:claims` (owner claims) and `pnpm places:reports` (closed and
  animal-cruelty reports); see each command's header for options.
- Google "Ver horario": Paw Mall's own Google Cloud project; setup and limits in
  `docs/GOOGLE-PLACES.md`. The key lives only in `apps/api/.dev.vars`; never print or commit it.
