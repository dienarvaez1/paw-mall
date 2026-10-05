# Paw Mall — Rollout Log

Tracks the actual rollout of [PLAN.md](PLAN.md), phase by phase: what was built, on which branch
and pull request, how it was checked, and what's left.

**Environment:** development only. Nothing is deployed and no cloud resources are created until
the owner decides (see PLAN.md, "Conventions for Claude Code"). "Rolled out" here means merged
into `main` and passing its "Done when" check locally (Docker Postgres, `wrangler dev`, Expo Go).

## Workflow

Every phase follows the same steps:

1. Branch from an up-to-date `main`: `phase-N/<short-name>` (e.g. `phase-1/foundation`).
2. Open a draft pull request early, titled `Phase N: <name>`, and link it in the table below.
3. Build the phase; commit in small, clear steps.
4. Before marking ready: `pnpm lint`, `pnpm typecheck` and `pnpm test` pass, and the phase's
   "Done when" check passes on a phone or simulator.
5. Update this file on the same branch: status, dates, checks, notes and follow-ups.
6. Merge the PR into `main` (squash) and delete the branch, locally and on GitHub.
7. Start the next phase's branch. Nothing is committed straight to `main`, so the first commit on
   the new branch records the merge here: the finished phase becomes **Done** with its merge date
   and merge commit, and the new phase becomes **In progress**.

Statuses: **Not started** · **In progress** · **In review** (PR ready) · **Done** (merged and
checked) · **Blocked**.

## Status at a glance

| Phase | Name                | Branch                    | PR  | Status      | Started    | Merged     |
| ----- | ------------------- | ------------------------- | --- | ----------- | ---------- | ---------- |
| 1     | Foundation          | `phase-1/foundation`      | #2  | Done        | 2026-10-05 | 2026-10-05 |
| 2     | Pet businesses      | `phase-2/pet-businesses`  | #3  | In progress | 2026-10-05 | —          |
| 3     | Search and map      | `phase-3/search-and-map`  | —   | Not started | —          | —          |
| 4     | Emergency vets      | `phase-4/emergency-vets`  | —   | Not started | —          | —          |
| 5     | Trust               | `phase-5/trust`           | —   | Not started | —          | —          |
| 6     | Pet-friendly layer  | `phase-6/pet-friendly`    | —   | Not started | —          | —          |
| 7     | Tourism and museums | `phase-7/tourism-museums` | —   | Not started | —          | —          |

## Phase details

### Phase 1 — Foundation

- **Scope:** monorepo (pnpm, Turborepo), TypeScript, ESLint, Prettier, Vitest, `CLAUDE.md`; Expo
  app boots; Hono API answers `/health` locally; Postgres + PostGIS in Docker; i18next with `es`
  and `en`.
- **Done when:** the app opens on a phone or simulator via Expo Go with a Spanish welcome screen
  and reaches the local API.
- **Branch / PR:** `phase-1/foundation` / #2
- **Status:** Done. Squash-merged into `main` as `a0199db` on 2026-10-05; branch deleted.
- **Checks:**
  - [x] `pnpm lint` (includes the `i18next/no-literal-string` rule, confirmed to reject JSX text)
  - [x] `pnpm typecheck`
  - [x] `pnpm test`: 18 tests (shared 5, api 3, mobile 10)
  - [x] `pnpm i18n:check` and `pnpm format:check`
  - [x] `curl localhost:8787/health` →
        `{"status":"ok","version":"0.1.0","database":{"status":"ok","postgis":"3.6.4"}}`, also
        from the LAN IP
  - [x] `expo export` bundles for iOS and Android
  - [x] Done-when check: Expo Go on the iPhone 17 Pro Max simulator (iOS 26.5) shows
        "¡Bienvenido a Paw Mall!", "Conectado al servidor (versión 0.1.0)" and "Base de datos
        lista (PostGIS 3.6.4)"; the API logged `GET /health 200`
  - [x] Verified by the owner in Expo Go on a physical iPhone and a physical Android phone
- **Notes:**
  - Postgres 17 + PostGIS 3.6.4, pg_trgm and unaccent, from migration `0000_extensions`.
  - Docker publishes Postgres on port **5434** (Ferre Mall uses 5433).
  - The API reads `DATABASE_URL` from `wrangler.toml` `[vars]`; no Hyperdrive or other cloud
    resources. `workers_dev = false`, and there is no deploy script.
  - `/health` still answers when Postgres is down (`database.status: "unavailable"`), so the app
    can tell "no server" from "no database".
  - Tooling dependencies beyond the Tech stack table, all as in Ferre Mall: `postgres`
    (postgres.js driver for Drizzle), `wrangler`, `drizzle-kit`, `@cloudflare/workers-types`,
    `typescript-eslint`, `eslint-config-expo`, `eslint-plugin-i18next` and `tailwindcss` 3
    (NativeWind).
- **Follow-ups:**
  - The app follows the device language (Spanish when it's unsupported), so an English
    device shows English first; the screen's link switches language and remembers it.
  - No app icon or splash yet (Expo defaults); add them with the app store readiness work.
  - `pnpm peers check` lists two transitive peer warnings (`react-dom` 19.3 wants React 19.3;
    `@react-native/metro-config` 0.87). `expo install --check` reports everything aligned.

### Phase 2 — Pet businesses

- **Scope:** data model; DENUE importer for 465911, 541941, 541942, 434112 (feed stores) and
  name-based picks from 812990; categories; Overture enrichment; website checks; cruelty-linked
  names excluded.
- **Done when:** `curl` lists real vets and pet stores near the Zócalo by category, with the
  PLAN.md counts (±1%), and grooming entries come only from matching names.
- **Branch / PR:** `phase-2/pet-businesses` / #3
- **Status:** In review
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm i18n:check`
  - [x] `pnpm test`: 67 tests (shared 8, api 10, importers 39, mobile 10)
  - [x] Import counts per DENUE class vs PLAN.md: 465911 = 8,705 (8,709, −0.05%); 541941 =
        6,544 (6,546, −0.03%); 541942 = 70 (70); 434112 = 4,444 (4,447, −0.07%). The small gaps
        are cruelty exclusions, one Petland office and one merged Petco duplicate.
  - [x] Grooming comes only from names: all 1,991 `groomer` rows have source `name`; 812990
        contributes 1,410 groomers and 47 boarding places (the plan's "~1,200" was a rough count
        with narrower words).
  - [x] Re-running the import changes nothing and keeps Overture data and website checks.
  - [x] Done-when check, `curl "localhost:8787/v1/places?lat=19.4326&lng=-99.1332&radiusKm=3&category=…"`:
        veterinarian 103 (nearest Fundación Antonio Haghenbeck, 0.7 km), vet_hospital 3, pet_store
        340, groomer 27, public_vet_service 2, feed_store 1, boarding 0.
- **Notes:**
  - Counts measured on 2026-10-05 from the DENUE edition of 2026-05-20 (the six states' zips
    already downloaded by Ferre Mall, copied to `packages/importers/.cache/`).
  - **Owner decisions (2026-10-05):** no animal cruelty: puppy mills, kill shelters,
    slaughterhouses and butchers are never listed (now in PLAN.md principles and CLAUDE.md).
    Live pet sales and farm-animal vets and feed stores are listed. Municipal animal control
    centers (Centros de Control Canino, antirrábicos, zoonosis; about 30) are listed as public
    services. Feed stores (434112) are imported as forrajerías, beyond the plan's original scope.
  - **Excluded for cruelty (8):** fighting-cock suppliers ("gallos de pelea/combate", "La
    Gallera"), a "rastro" (slaughterhouse) feed store, and two breeding operations (a "crianza"
    groomer, a "crianza de gallos" vet). Breeding words count only with dogs, cats, pets or
    roosters, so farm-animal raising ("Forrajera La Crianza") stays; "El Rastro" and "Palenque"
    as place names stay.
  - Data: 21,218 places, 22,143 category rows. Categories: pet_store 8,705, veterinarian 6,558,
    feed_store 4,444, groomer 1,991, vet_hospital 232, boarding 73, public_vet_service 70,
    boutique 69. Chains: Petco, +Kota, Maskota, Petland, Banfield. Two vets have a "24 horas"
    name hint (unconfirmed).
  - Overture Maps release 2026-09-23.1: 11,541 pet-type places in the region; 2,764 matched;
    filled 1,212 phones, 489 websites and 2,750 social pages. Breeder and butcher categories are
    not used for matching.
  - Website checks (1,052 sites): 440 working, 24 blocking checks, 86 unreachable, 502 dead
    (hidden in the API, data kept). Took 2.5 minutes.
  - API: `GET /v1/categories?lang=` (names and place counts) and
    `GET /v1/places?lat&lng&radiusKm&category&page&pageSize&lang` (nearest first, max 50 km).
  - New dependency: `@duckdb/node-api` (DuckDB is in the Tech stack table).
- **Follow-ups:**
  - About 300 businesses in 812990 have pet words but no grooming or boarding word (dog
    trainers, vets misfiled there, "pet salon" variants). Vets misfiled in 812990 could be
    picked by name in a later phase.
  - Petland sells puppies; its sourcing is a known controversy elsewhere. Listed under the
    "live pet sales are fine" decision; flagged for the owner.
  - Name patterns can't catch a puppy mill with a neutral name; Phase 5 reports should include
    a cruelty reason.
  - Credit INEGI and Overture Maps Foundation in the app where this data appears (Phase 3).

### Phase 3 — Search and map

- **Scope:** search (name, city, state; within radius; nearest first), map (circle, clusters,
  legend, location and compass buttons), directions chooser, place pages, category chips and
  filters.
- **Done when:** on a phone, filtering "Veterinarias" shows only vets on the map and list, and
  "Cómo llegar" opens the chosen maps app.
- **Branch / PR:** `phase-3/search-and-map` / —
- **Status:** Not started
- **Checks:**
  - [ ] `pnpm lint`
  - [ ] `pnpm typecheck`
  - [ ] `pnpm test`
  - [ ] Done-when check on device
- **Notes:** —
- **Follow-ups:** —

### Phase 4 — Emergency vets

- **Scope:** hours model, "open now" filter, 24-hour flag, Urgencias tab, Google "Ver horario"
  on demand within the free-tier cap.
- **Done when:** Urgencias shows the nearest open vet with call and directions in one tap, and
  says clearly when hours are unconfirmed.
- **Branch / PR:** `phase-4/emergency-vets` / —
- **Status:** Not started
- **Checks:**
  - [ ] `pnpm lint`
  - [ ] `pnpm typecheck`
  - [ ] `pnpm test`
  - [ ] Google usage stays under the monthly cap (950)
  - [ ] Done-when check on device
- **Notes:** —
- **Follow-ups:** —

### Phase 5 — Trust

- **Scope:** owner claims with the SAT check, closed-business reports, owner-verified badges;
  optional cédula profesional check only after confirming the registry's terms.
- **Done when:** an approved claim shows "Verificado por el dueño" and its hours drive "open now".
- **Branch / PR:** `phase-5/trust` / —
- **Status:** Not started
- **Checks:**
  - [ ] `pnpm lint`
  - [ ] `pnpm typecheck`
  - [ ] `pnpm test`
  - [ ] Done-when check on device
- **Notes:** —
- **Follow-ups:** —

### Phase 6 — Pet-friendly layer

- **Scope:** pet policies (owner-declared, shopper-confirmed), curated CDMX restaurants and
  lodging, pet-friendly toggle and policy filters, pet profile in Settings.
- **Done when:** with a "perro grande" profile, the map shows only places whose policy allows
  large dogs, each with its policy source and last confirmation.
- **Branch / PR:** `phase-6/pet-friendly` / —
- **Status:** Not started
- **Checks:**
  - [ ] `pnpm lint`
  - [ ] `pnpm typecheck`
  - [ ] `pnpm test`
  - [ ] Done-when check on device
- **Notes:** —
- **Follow-ups:** —

### Phase 7 — Tourism and museums

- **Scope:** pet-friendly attributes on museums, parks and tourist sites from official sources
  once licensing is verified, plus curated entries.
- **Done when:** museums and parks appear with their pet policy, and each source is credited.
- **Branch / PR:** `phase-7/tourism-museums` / —
- **Status:** Not started
- **Checks:**
  - [ ] Licensing of each source verified and recorded below
  - [ ] `pnpm lint`
  - [ ] `pnpm typecheck`
  - [ ] `pnpm test`
  - [ ] Done-when check on device
- **Notes:** —
- **Follow-ups:** —

## Production deployment

Not planned. When the owner decides to deploy, add a section here covering environments, cloud
resources, secrets, migrations, rollback and costs (see PLAN.md, "Later" and "App Store and Google
Play readiness").

## Change log

| Date       | Change                     | PR  |
| ---------- | -------------------------- | --- |
| 2026-10-05 | Rollout log created        | #1  |
| 2026-10-05 | Phase 1 started            | #2  |
| 2026-10-05 | Phase 1 merged (`a0199db`) | #2  |
| 2026-10-05 | Phase 2 started            | #3  |
