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

| Phase | Name                  | Branch                       | PR  | Status    | Started    | Merged     |
| ----- | --------------------- | ---------------------------- | --- | --------- | ---------- | ---------- |
| 1     | Foundation            | `phase-1/foundation`         | #2  | Done      | 2026-10-05 | 2026-10-05 |
| 2     | Pet businesses        | `phase-2/pet-businesses`     | #3  | Done      | 2026-10-05 | 2026-10-05 |
| 3     | Search and map        | `phase-3/search-and-map`     | #4  | Done      | 2026-10-05 | 2026-10-05 |
| 4     | Emergency vets        | `phase-4/emergency-vets`     | #5  | Done      | 2026-10-05 | 2026-10-05 |
| 5     | Trust                 | `phase-5/trust`              | #6  | Done      | 2026-10-05 | 2026-10-06 |
| 6     | Pet-friendly layer    | `phase-6/pet-friendly`       | #8  | Done      | 2026-10-10 | 2026-10-10 |
| 7     | Tourism and museums   | `phase-7/tourism-museums`    | #9  | Done      | 2026-10-10 | 2026-10-10 |
| 8     | Bug fixes             | `phase-8/bug-fixes`          | #11 | Done      | 2026-10-10 | 2026-10-11 |
| 9     | Pet-friendly at scale | `phase-9/pet-friendly-scale` | #12 | Done      | 2026-10-10 | 2026-10-11 |
| 10    | All of Mexico         | `phase-10/all-mexico`        | #14 | Done      | 2026-10-11 | 2026-10-12 |
| 11    | Hardening             | `phase-11/hardening`         | #18 | Done      | 2026-10-13 | 2026-10-13 |
| 12    | Failure coverage      | `phase-12/failure-coverage`  | #20 | Done      | 2026-10-13 | 2026-10-13 |
| 13    | Load test             | `phase-13/load-test`         | #24 | Done      | 2026-10-14 | 2026-10-14 |
| 14    | Data cleanup          | `phase-14/data-cleanup`      | #25 | Done      | 2026-10-14 | 2026-10-14 |
| 15    | OSM vet phones        | `phase-15/osm-vet-phones`    | #27 | Done      | 2026-10-14 | 2026-10-14 |
| 16    | Bug fixes 2           | `phase-16/bug-fixes`         | #28 | Done      | 2026-10-14 | 2026-10-14 |
| 17    | Search benchmark      | `phase-17/search-benchmark`  | #31 | Done      | 2026-10-14 | 2026-10-14 |
| 18    | Search gap fixes      | `phase-18/search-gaps`       | #33 | In review | 2026-10-14 | —          |
| 19    | Place with words      | `phase-19/service-in-place`  | #34 | In review | 2026-10-14 | —          |

## Pending owner reviews

Decisions and discussions the owner has left for later. Each one, once decided, becomes a rule or
a task (and a note in the phase that applies it).

| Opened     | Review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Status                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 2026-10-05 | **Which other businesses aren't suitable for Paw Mall.** The owner accepted Phase 2's data as is and will list unsuitable businesses once they can browse it in the app (Phase 3). Candidates raised so far: Petland (sells puppies), wholesale vet-medicine distributors in 434112, live-animal sellers, municipal control centers, the 29 pet businesses inside Mercado Sonora (known for live animal sales; reported in the press for illegal wildlife trade), and rooster names that may or may not be cockfighting: "Alimento para gallos", "Gallo giro", "Galleritos", "Forrajería El Jaripeo" (a rodeo), "La Espuela" / "Espuela de Oro" (a spur: horses or fighting cocks), all kept for now; and "Navajas y afilación" (excluded as cockfighting blades, possibly a knife sharpener). | Open: review in the app after Phase 3                                                  |
| 2026-10-05 | **SAT check for owner claims (RFC + idCIF), deferred by the owner.** Phase 5 was planned with Ferre Mall's check of the owner's Constancia de Situación Fiscal through SAT's public QR validation page. The owner deferred it on 2026-10-05; decide whether and when to add it before claims are opened to real owners.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Open: deferred from Phase 5                                                            |
| 2026-10-05 | **An admin page for Paw Mall.** Reviewing claims and reports is command-line only (`pnpm places:claims`, `pnpm places:reports`). The owner wants to discuss an admin page later, probably after all phases are completed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Open: after Phase 7                                                                    |
| 2026-10-05 | **How to show "sin nombre" businesses and INEGI's dates.** 1,689 places (about 7%) are named "… Sin Nombre" in DENUE: real, still-listed businesses without a trade name, not a sign of closure. Options: hide them by default (Ajustes switch on), show "(sin nombre comercial)", or both. Also whether "Registrado por INEGI en 2010" should read "En el directorio del INEGI desde 2010" (July 2010 is DENUE's first edition, not an opening date).                                                                                                                                                                                                                                                                                                                                         | Open: owner to choose                                                                  |
| 2026-10-05 | **More DENUE fields to use.** Market or plaza and stall number (1,938 places, e.g. Mercado Sonora), interior numbers missing from addresses (1,504), staff size for ranking Urgencias (960 with 6+ people), business email (2,883), semi-fixed stalls (187). Suggested: market/stall and interior numbers in addresses first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Open: owner to choose                                                                  |
| 2026-10-05 | **Area search on the map, and more landmarks.** Area search works in the list; the map still shows the area around the user (search is off in map mode, as in Ferre Mall). Options: center the map on a searched area; add landmarks outside Mexico City (Puebla, Cuernavaca, Toluca, Querétaro…) to `data/landmarks.json`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Open: owner to choose                                                                  |
| 2026-10-05 | **Dog walkers and pet sitters.** No category: DENUE has 4. Options: import Overture's dog walkers and pet sitters as listings (about 105 in CDMX; many are individuals, so review privacy first), or a "register your business" flow so walkers can add themselves.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Open: owner to choose                                                                  |
| 2026-10-10 | **Press sources for pet-friendly restaurants.** Restaurants and cafés rarely publish a pet policy, so Phase 6's 11 come from Time Out México, Chilango and Ciudad de México Secreta (credited, with links); hotels come from their own sites. Keep press sources, replace them as venues confirm, or show only venue and owner statements?                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Decided 2026-10-10: keep press sources (credited); replace as venues or owners confirm |
| 2026-10-05 | **Import neighboring states for the 100-mile radius?** Guerrero, Michoacán and Querétaro are now imported (owner's decision, 2026-10-05).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Done in Phase 5 (#6)                                                                   |

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
- **Status:** Done. Squash-merged into `main` as `97d6019` on 2026-10-05; branch deleted.
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
- **Owner review (2026-10-05):** accepted as is. The owner will review the data in the app and
  say which other businesses aren't suitable; see "Pending owner reviews" above.
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
- **Branch / PR:** `phase-3/search-and-map` / #4
- **Status:** Done. Squash-merged into `main` as `df26ef2` on 2026-10-05; branch deleted.
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm i18n:check`
  - [x] `pnpm test`: 103 tests (shared 10, api 17, importers 39, mobile 37)
  - [x] Migrations build a fresh database from scratch (14 categories, search index)
  - [x] API for "Veterinarias" within 5 km of the Zócalo: the list returns 386 places, all vets;
        the map returns vet-only clusters (360 in view of 386 in the radius)
  - [x] iOS simulator (Expo Go, Spanish): Explorar lists "1,236 lugares a menos de 5 km" nearest
        first, with category chips (Todos, Veterinarias, Hospitales, Tiendas, …) and colored
        category dots; `expo export` bundles for Android
  - [x] Done-when check on a phone: tap "Veterinarias" (list and map), open a place, "Cómo
        llegar" opens Apple Maps, Google Maps or Waze. Taps can't be automated here (macOS blocks
        scripted clicks), so this was handed to the owner, who approved the merge on 2026-10-05
        without reporting problems.
- **Notes:**
  - Adopted from Ferre Mall (owner's request): the map and list screen (radius circle, clusters
    that zoom in when tapped, "N de M lugares a menos de X" legend, location and compass
    buttons), search box, list rows, place page, directions chooser, Settings (language, radius
    and units, contact filters), location with the Zócalo fallback, offline banner, and the API's
    search (word by word over name, city and state, typo-tolerant) and map clustering.
  - New for Paw Mall: category chips (Todos, Veterinarias, Hospitales, Tiendas, Estéticas,
    Pensiones, Forrajerías, Servicios públicos) filtering both list and map; pins and dots
    colored by category; the "24 horas" name hint shown as unconfirmed; attribution for INEGI
    (with the edition date) and Overture Maps Foundation in the list, place page and Settings.
  - API: `GET /v1/places` gains `q`, `withPhone`, `withWebsite`, `withSocial`, `named`;
    new `GET /v1/places/map` (up to 200 pins, else clusters) and `GET /v1/places/:id`;
    migrations 0003–0004 add `place_search_text()` and its index.
  - Defaults: radius 5 km (choices 5, 10, 15, 25, 50, 80 km or 3–50 mi), Spanish first.
  - New app dependencies (Expo SDK 57 versions, as in Ferre Mall): `react-native-maps` and
    `expo-location` (in the Tech stack table), `expo-image` (SVG icons) and `expo-network`
    (offline banner).
  - Tabs: Explorar and Ajustes. Urgencias comes in Phase 4; Favoritos isn't scheduled yet.
  - After this phase the owner reviews the data in the app and lists unsuitable businesses
    (see "Pending owner reviews").
- **Follow-ups:**
  - No app icon yet: Expo logs "Asset not found: assets/icon.png" (harmless in Expo Go); add
    icons with the app store readiness work.
  - Favoritos tab: not in any phase of PLAN.md; schedule it with the owner.
  - The simulator had English saved as Paw Mall's language (from Phase 1's language switch), so
    it opens in English there; Settings switches it.

### Phase 4 — Emergency vets

- **Scope:** hours model, "open now" filter, 24-hour flag, Urgencias tab, Google "Ver horario"
  on demand within the free-tier cap.
- **Done when:** Urgencias shows the nearest open vet with call and directions in one tap, and
  says clearly when hours are unconfirmed.
- **Branch / PR:** `phase-4/emergency-vets` / #5
- **Status:** Done. Squash-merged into `main` as `c30d151` on 2026-10-05; branch deleted.
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm i18n:check`
  - [x] `pnpm test`: 122 tests (shared 15, api 31, importers 39, mobile 37), including Ferre
        Mall's Google tests (free ids-only search, match check, monthly and daily limits, no key)
        and a check that the SQL and TypeScript "open now" rules agree
  - [x] Migrations build a fresh database; schema and migrations in sync
  - [x] Google usage stays under the monthly cap (950): enforced in code and tested; no real
        Google requests made yet (no key configured)
  - [x] iOS simulator (Spanish), real data: Urgencias lists the nearest vet hospitals with
        "Llamar" and "Cómo llegar" on each card and "Horario sin confirmar" on every one (no
        place has confirmed hours yet)
  - [x] iOS simulator, with 24-hour hours set on one vet temporarily (then removed): it moves to
        the top with "Abierto ahora", and its page lists "Abierto 24 horas" each day
  - [x] Done-when check on a phone: open Urgencias, tap "Llamar" and "Cómo llegar" on the first
        card. Taps can't be automated here, so this was handed to the owner, who approved the
        merge on 2026-10-05 without reporting problems.
- **Notes:**
  - **Owner decision (2026-10-05):** "Ver horario" uses a **new Google Cloud project for Paw
    Mall**, not Ferre Mall's, since Ferre Mall may not resume soon. Setup steps are in
    `docs/GOOGLE-PLACES.md`; the key goes in `apps/api/.dev.vars` (gitignored), never in chat
    or a commit. Until then "Ver horario" says hours aren't available.
  - **No place has confirmed hours yet:** DENUE and Overture don't publish hours. Confirmed hours
    come from owners in Phase 5. Google's hours are shown on demand and never stored, so they
    never count for "Abierto ahora". Urgencias therefore says "Horario sin confirmar" on every
    card for now and the disclaimer asks users to call first.
  - Hours model: Ferre Mall's (one interval per weekday, Mexico City time) extended with
    overnight shifts (20:00–02:00) and 24-hour days (00:00–24:00); `isOpenAt()` in
    `packages/shared` and its SQL twin `place_open_now()` (migration 0006).
  - Urgencias: vet hospitals, 24-hour vets (confirmed or hinted by name) and vets that accept
    emergencies, within 25 km; open now first, then unknown hours, then closed; nearest first in
    each group; up to 20; refreshed every minute.
  - Explorar gains an "Abierto ahora" chip (confirmed hours only, with an empty state that
    explains why few places qualify); list rows and place pages show the open/closed/unconfirmed
    badge.
  - Fixed: the place page's back button read "(tabs)" (since Phase 3); it's now just the arrow.
  - API: `GET /v1/places/urgent`, `POST /v1/places/:id/google`, `openNow` filter; migrations
    0005 (Google columns, `google_usage`, `google_lookups`, `hours_source`) and 0006.
- **Follow-ups:**
  - Owner: create the Google Cloud project and key (`docs/GOOGLE-PLACES.md`), then try "Ver
    horario" on a place page. Not done at merge time: "Ver horario" says hours are unavailable
    until the key is set.
  - Phase 5: owner-verified hours and 24-hour answers are what make "Abierto ahora" useful.
  - Locally every request shares one daily "Ver horario" allowance (5), because `wrangler dev`
    has no client IP; deployed Workers get it from Cloudflare.

### Phase 5 — Trust

- **Scope:** owner claims (SAT check deferred by the owner), closed-business and animal-cruelty
  reports, owner-verified badges; optional cédula profesional check only after confirming the
  registry's terms.
- **Done when:** an approved claim shows "Verificado por el dueño" and its hours drive "open now".
- **Branch / PR:** `phase-5/trust` / #6
- **Status:** Done, merged 2026-10-06 (`80118ac`)
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm i18n:check`
  - [x] `pnpm test`: 141 tests (shared 18, api 37, importers 44, mobile 42), including report
        thresholds, the privacy rule (reports with location or personal fields are rejected;
        `place_reports` holds only id, place, reason, random id and date), and claim
        approval/rejection against the database
  - [x] Migrations build a fresh database; schema and migrations in sync
  - [x] Done-when check, end to end on real data then reverted: a claim for Hospital Veterinaria
        Rampu sent through the API (as the app does), listed by `pnpm places:claims`, approved
        with `--approve`. The API and the iOS simulator showed "Verificado por el dueño el 5 de
        octubre de 2026", the owner's hours, "Abierto ahora" (Mon 16:53, hours 09:00–21:00), and
        Rampu first in Urgencias; the contact was deleted. Rampu was then restored exactly (0
        verified places, 0 claims left).
  - [x] Owner check on a phone: open a place, try "¿Eres el dueño?" and the two report buttons.
        The owner tested many of this phase's changes on an iPhone and Android while asking for
        them, and asked to merge on 2026-10-06 without reporting open problems; these two flows
        weren't reported on specifically.
- **Notes:**
  - **Deferred by the owner (2026-10-05):** the SAT check of owner claims (RFC and idCIF from the
    Constancia de Situación Fiscal, validated on SAT's public QR page as in Ferre Mall). Tracked
    in "Pending owner reviews" so it isn't forgotten. Claims are reviewed by hand meanwhile.
  - **Owner decisions (2026-10-05):** users can report "Maltrato animal" as well as "¿Cerró?".
    Reports are stored only in an internal table of the app and reviewed with
    `pnpm places:reports`; nothing is emailed or sent to third parties. **Privacy rule:** never
    record location or personal information from the reporting phone (no coordinates, IP, name or
    contact), only a random id the app generates to count each phone once (now in CLAUDE.md). An
    admin page is to be discussed after all phases (see "Pending owner reviews").
  - Vet details owners can send: open 24 hours and takes emergencies (the default proposed;
    species treated can come later).
  - Adopted from Ferre Mall: the claim form (without the SAT section), claim review command,
    closed reports with the 3-phones-in-90-days rule, report review command, verified badge.
  - New for Paw Mall: "Reportar maltrato animal" (hides after 2 phones, pending review); vet
    answers in claims (open 24 hours replaces the name hint with an owner answer; takes
    emergencies), shown only for vets; overnight hours in the claim form; a privacy line on every
    report confirm ("no enviamos tu ubicación ni tus datos"); API rejects any extra field on a
    report.
  - Review commands: `pnpm places:claims [--approve N | --reject N]` and
    `pnpm places:reports [--restore N | --confirm N --reason closed|cruelty]`. Confirmed reports
    keep a place hidden across re-imports.
  - Cédula profesional check: off, as planned (registry terms not confirmed).
  - **Owner decision (2026-10-05): pet crematoriums and funeral homes** are a new category
    (`pet_funeral`, "Crematorio y funeraria para mascotas", chip "Funerarias"). The importer picks
    them by name (a funeral word plus an animal word) from 812990 and 812310 (servicios
    funerarios), so the 4,295 funeral homes for people stay out: 20 places, e.g. "Crematorio de
    Mascotas Memorial Pets", "Mictlan Crematorio para Mascotas", "Pets In The Sky". Migration 0008.
  - DENUE findings while reviewing the data with the owner: "sin nombre" businesses (1,689) come
    from DENUE itself and look active (74.6% registered 2019 or later vs 67.2% of named ones);
    the oldest registration date is July 2010, shared by 4,555 places (DENUE's first edition);
    unused DENUE fields with value are listed in "Pending owner reviews".
  - **Owner decision (2026-10-05): search radius up to 100 miles (160 km)** "for more coverage
    on data". Ajustes adds 160 km and 100 mi; the API accepts up to 161 km (was 100). From the
    Zócalo, 100 mi covers 20,225 places (95% of those imported) vs 15,386 at 50 mi; list, map and
    search requests at that radius take under 0.15 s locally. The circle's edge reaches states
    that aren't imported. Urgencias keeps its own 25 km radius.
  - **Owner decision (2026-10-05): import Guerrero, Michoacán and Querétaro** (DENUE
    `denue_12`, `denue_16`, `denue_22`; 15.6, 26.9 and 10.4 MB). The plan's region is now nine
    states (PLAN.md and CLAUDE.md updated). Import: 25,443 places (+4,205); Guerrero 1,058,
    Michoacán 2,182, Querétaro 982. Within 100 mi of the Zócalo: 20,902 places (was 20,225).
    Overture's download box now covers the nine states: 16,398 pet-type places, 3,347 matched
    (1,410 phones, 650 websites filled). Website checks: 1,279 sites, 568 working, 662 dead.
  - **Cockfighting rule widened** after reviewing the new states' rooster names (57 in the three
    states): gear and breeders are now excluded too (navajas, cages/accessories/products for
    roosters, galleros, rooster fincas). Exclusions went from 8 to 39, including 17 places in the
    original six states that the old patterns missed (removed on re-import). Rooster or bull names
    alone stay ("Veterinaria El Gallo de Oro", "Veterinaria El Toro"); ambiguous names are listed
    for the owner in "Pending owner reviews".
  - **Owner rule (2026-10-05): "cock" in pet store names** (DENUE 465911, whole word) is excluded,
    after the owner found "Black Cock", a store selling feed for fighting cocks. It removed 2:
    "Tienda de alimentos para animales Black Cock" and "Implementos para mascotas Cock House".
    "Cocker"/"Cockers" (the dog breed, in a vet and a groomer) stay. Exclusions: 41; places:
    25,441.
  - **Owner request (2026-10-05): "Abierto ahora" moved to Ajustes.** The chip added to
    Explorar in Phase 4 is now a saved switch, "Solo lugares abiertos ahora", after the other
    switches in Ajustes → Lugares. It filters the list and the map like the other place filters;
    Urgencias is unchanged (it already puts open places first).
  - **Owner request (2026-10-05): search by colonia, landmark and city.** Typing an area in
    Explorar's search box ("Zócalo", "Roma Norte", "Coyoacán", "Toluca") moves the search there:
    places within **5 km (3 mi for users who chose miles)** of the area, nearest to it first,
    with distances from it. The radius in Ajustes is left alone. "Veterinaria en Coyoacán" (or
    "cerca de") searches business words near the area; a link under the header searches the same
    text in business names instead. Names shared by several areas ("Centro") resolve to the one
    nearest the user; one-letter typos are tolerated (trigram similarity 0.65, chosen so everyday
    pet words such as "animalia" stay business searches).
  - Where the areas come from (`pnpm places:areas`, new `search_areas` table, migration 0009):
    municipalities (754), towns (1,635) and colonias (23,332) are centered on the median position
    of **all** 2.65 million DENUE businesses in the nine states (not only pet ones; colonias need
    5+ businesses, towns 20+). Landmarks (15, plus aliases: 33 names) are a curated list in
    `packages/importers/data/landmarks.json`; each was checked against Overture Maps (matching
    listings within 60 m). Overture's own landmark points were too scattered to use directly
    (e.g. "Zócalo" entries 2–11 km off). Rebuild the areas after each DENUE import.
  - Tested: API (area resolution, 5 km vs 3 mi, "X en Y", nearest of duplicate names, names-only,
    typo threshold), importer (median centers, minimum counts, landmark list). Checked with curl
    from Polanco: "Zocalo" → 1,237 places within 5 km of the Zócalo; "Roma Norte", "col. condesa",
    "Toluca", "Bellas Artes" resolve as expected; "huellitas" stays a name search. Typing can't be
    automated in the simulator; the owner checks it on a phone.
  - **Owner request (2026-10-05): "Mi ubicación" toggle**, a chip left of "Todos", off by
    default. Off: the search text names an area (landmark, colonia, city) and the search
    centers there within 5 km (3 mi); text that names no area still searches business names
    around the user. On: the text searches business names only, around the user, within the
    Ajustes radius. The placeholder follows the toggle ("Busca una colonia, ciudad o lugar (ej.
    Zócalo)" / "Busca un negocio cerca de ti"). It replaces the "Buscar en nombres" link added
    with area search; the area header now points to the toggle instead.
  - **Owner change (2026-10-05): "Mi ubicación" on always searches 3 mi (5 km) around the
    user**, the same distance as area searches, ignoring the Ajustes radius (first built with the
    Ajustes radius). The Ajustes radius still applies to plain browsing (toggle off, empty search)
    and to the map. Example: "huellitas" near the Zócalo finds 7 places within 3 mi vs 216 within
    100 mi.
  - **Owner request (2026-10-05): a radius button on the map**, above the compass and location
    buttons, showing the current radius ("5 km"). Each tap picks the next choice in the user's
    unit (5 → 10 → 15 → 25 → 50 → 80 → 160 km, or 3 → … → 100 mi, then back), saved to the same
    setting as Ajustes, so both always agree; the map then refits the circle around the user, as
    the location button does. The "Mi ubicación" chip keeps its fixed 3 mi (5 km) for name
    searches. Not seen on the simulator (switching to the map needs a tap); cycling is unit
    tested.
  - **Owner request (2026-10-05): distance wording in the list.** When a search names an area
    ("Zócalo", "Mi ubicación" off), distances are from that area and read just "0.3 mi" /
    "0.3 km". When they're from the user ("Mi ubicación" on, plain browsing, or a name that isn't
    an area), they read "0.3 mi away" / "a 0.3 km". Urgencias and the map are always from the
    user and unchanged.
  - **Owner request (2026-10-05): one radius for the list, the map and "Mi ubicación".** The
    map's radius button also appears in list view, next to Lista/Mapa (on the map it stays over
    the map); both change the same saved radius as Ajustes. "Mi ubicación" searches use that
    radius again instead of the fixed 3 mi (5 km) set earlier. Area searches ("Zócalo") keep
    5 km (3 mi) around the area. Seen on the simulator in list view.
  - **Owner rule (2026-10-05), replacing the earlier distance wording: tied to "Mi ubicación".**
    Off: list distances read just "0.3 mi" / "0.3 km", whatever the search. On: "0.3 mi away" /
    "a 0.3 km". Seen on the simulator (off).
  - **A place name at the end of a search** now counts as an area search when "Mi ubicación" is
    off: "Veterinario Tlaxcala" searches "veterinario" within 5 km (3 mi) of Tlaxcala (69 places,
    nearest "Centro Veterinario Tlaxcala"; before, it searched names around the user and found 1
    unrelated place). Only an exact area name counts at the end. Consequence: "veterinaria la paz"
    searches vets near La Paz (Edomex) rather than a business called "Veterinaria La Paz"; with
    "Mi ubicación" on, text is always a business-name search.
  - **Owner request (2026-10-05): a fixed results summary.** The line "69 lugares a menos de
    5 km de Tlaxcala" / "1,237 lugares a menos de 5 km" now stays above the list while it scrolls
    (it used to scroll away with the first rows). It's a single line; the hint under area results
    ("activa «Mi ubicación»…") was dropped, since the placeholder and the chip explain the toggle.
    The category chips also keep their own height now (the list used to squeeze them).
  - **Owner request (2026-10-05):** the summary line is bold, in the darkest text color.
  - **Owner request (2026-10-05): Explorar's top rows reordered.** 1) search box; 2) Lista,
    Mapa, "Mi ubicación" and the radius button ("5 km"; on the map it stays over the map); 3)
    category chips; then the bold summary. Seen on the simulator: row 2 fits on an iPhone 17 Pro
    Max in Spanish.
  - **Owner request (2026-10-05): a steady second row.** "Mi ubicación" is icon-only (location
    icon; screen readers still say "Mi ubicación" and on/off). The radius button stays in the
    row on the map too, so Lista and Mapa no longer resize when switching; the radius button that
    floated over the map was removed as a duplicate (the compass and location buttons remain).
  - **Owner request (2026-10-05): search on the map.** The search box is no longer grayed out in
    map view, and it works there as in the list: with "Mi ubicación" off, a place ("Zócalo",
    "Veterinario Tlaxcala") flies the map to it, draws its 5 km (3 mi) circle, and the legend
    reads "N de M lugares a menos de 5 km de Tlaxcala"; other text, or "Mi ubicación" on, keeps
    the circle around the user and shows only matching names. Clearing the search flies back to
    the user. API: `GET /v1/places/map` takes `q`, `areaRadiusKm`, `namesOnly` and returns `area`
    (tested). Not seen on the simulator (the map needs a tap); the owner checks it on a phone.
  - **Owner request (2026-10-05): place and keyword in any order.** The search finds a place
    name anywhere in the text (longest exact match wins; keywords and fillers are never taken for
    places) and turns business keywords into a category (`detectCategory` in packages/shared:
    vet/veterinario → Veterinarias, hospital/urgencias → Hospitales, tienda/pet shop → Tiendas,
    estética/groomer → Estéticas, pensión → Pensiones, forrajería → Forrajerías,
    crematorio/funeraria → Funerarias, antirrábico → Servicios públicos). "tlaxcala vet",
    "vet tlaxcala", "Veterinario Tlaxcala" and "veterinario en tlaxcala" all list the 54 vets
    within 3 mi of Tlaxcala, including vets whose names don't say "veterinario". Remaining words
    search names ("roma norte huellitas"). A selected chip wins over a keyword. Keywords also
    work around the user ("vet" → vets near me). The list summary names the detected category:
    "Veterinarias: 54 lugares a menos de 5 km de Tlaxcala". List and map share one search
    interpretation in the API. Order of matching: "X en Y"; the whole text as an exact place; a
    place inside the text; the whole text as a place with a small typo ("zocallo").
  - Fixed along the way: with `fetch_types` off (needed on Workers), postgres.js can't send text
    arrays, so candidate place names go in an `IN (…)` list.
  - **Owner rule (2026-10-05): every word must match.** A name search requires all of its words
    (in the name, city or state, each tolerating a small typo), except the vague ones: en, la, el,
    de, los, y, para. The looser fallback (the whole text as one fuzzy name when nothing matched
    every word) was removed, and "veterinaria", "tienda" and "mascotas" are no longer skipped
    (they're category keywords now). Within 100 mi of the Zócalo: "huellitas" 216, "huellitas
    felices" 2, "huellitas zzzz" 0, "la huellita" 212, "huelitas" (typo) 204. The owner then
    added "del" and "las" to the ignored words.
  - **Owner request (2026-10-05): the map's zoom sets the radius.** When the user zooms the map
    by hand, the radius becomes the largest circle that fits the view, in true scale (e.g.
    "3.4 km"), around the user or the searched place; pins, counts, the list and "Mi ubicación"
    searches all use it. Only the user's gestures count (the map's own moves, such as fitting a
    circle or opening a cluster, don't), and a pan that keeps the scale changes nothing. The
    radius button shows a custom radius in amber; tapping it is the only way back to the presets
    (to the saved Ajustes radius first, then cycling as before). A custom radius is never saved to
    Ajustes. Area searches accept radii up to 161 km now (was 10). Tested: `radiusForRegion` (the
    reverse of `regionForRadius`), schema limits. Not seen on the simulator (zooming needs a
    gesture); the owner checks it on a phone.
  - **Owner rule (2026-10-05): words match letter for letter.** "tlaxcala" (with "Mi ubicación"
    on, near Tlalnepantla) listed "Veterinaria Ixtacala" and "Hospital para Mascotas Ixtacala",
    because each word was allowed to match approximately (trigram word similarity). Now business
    words and place names must match every letter, ignoring only case and accents ("queretaro"
    still finds Querétaro). The fuzzy matching for place names (similarity 0.65, and 0.6 in "X en
    Y") is gone too, so typos no longer match: "huelitas" and "zocallo" find nothing. Earlier notes
    about typo tolerance in this phase no longer apply.
  - **Dog walkers: no category yet.** DENUE has only 4 (walking is mostly informal work); Overture
    lists about 105 dog walkers and pet sitters in CDMX, but importing Overture places as listings
    would be a new kind of source, and many are individuals (privacy). Added to "Pending owner
    reviews".
  - **Owner decision (2026-10-05): dog training** is a new category (`dog_trainer`,
    "Adiestramiento canino", chip "Adiestramiento"; migration 0010). Picked by name in **any**
    DENUE class (trainers appear under sports, social work, associations…): a training word
    (adiestramiento, entrenamiento, cinotecnia, escuela canina, dog training…) plus an animal word;
    "K9" alone and training without animals ("adiestramiento táctico") don't count, and gyms
    (713943, e.g. "Black Dog Cross Training") are excluded. 54 trainers, 33 of them new places
    (25,474 places in total); e.g. "Escuela para Entrenamiento de Perros Guía para Ciegos IAP".
    Search keywords: adiestramiento, adiestrador, entrenador/entrenamiento canino, escuela canina,
    dog trainer/training ("adiestramiento" within 25 km of the Zócalo: 22).
  - **Owner request (2026-10-05): "Mi ubicación" on recenters the map.** In map view, turning it
    on reads the device's position again and flies the map back to it, with the radius circle
    (preset or zoomed) fitted around it. Turning it off leaves the map where it is. Not seen on
    the simulator (needs a tap); the owner checks it on a phone.
  - **Owner request (2026-10-05): "Mi ubicación" turns itself off when the map's center moves off
    the user.** Any hand move that takes the center more than 5% of the view off the user's
    position switches it off (first built with "outside the middle half"; the owner asked for the
    center). Searches then go back to reading places. A pinch that isn't centered on the user
    also moves the center, so it switches off too; the map's own moves never do. Helper
    `isAwayFrom` (tested). Not seen on the simulator (needs gestures).
  - **Fixed (2026-10-05): hand moves weren't detected on iPhone.** The owner reported "Mi
    ubicación" didn't turn off on an iPhone. Cause: both the zoom-sets-the-radius feature and the
    auto-off relied on react-native-maps' `isGesture`, which Apple Maps (the iOS map) never sends
    in 1.27.2 (`AIRMapManager.m` builds the event without it; only Google Maps sets it), so on
    iPhone every move looked automatic and neither feature worked there. Now the app tells moves
    apart itself: every automatic move (fitting a circle, opening a cluster, the location and
    compass buttons, "Mi ubicación") goes through one `moveMap` helper that marks it, and a move
    counts as the user's while a finger is on the map or within 2.5 s after it lifts (a flick
    glides). Works the same on iOS and Android. Gestures can't be driven on the simulator, so
    the owner verifies on the iPhone.
  - **Owner request (2026-10-05): lime-green clusters.** Map clusters are lime green (lime-500
    with dark lime numbers; were light amber), then made a hair bigger (bubbles 4 pt wider,
    numbers 10 pt) and a shade darker (lime-400 → lime-500). No category may be green, so Forrajerías moved from
    lime green to yellow-gold (#ca8a04) and Pensiones from teal (blue-green) to indigo (#4f46e5),
    colors no other category uses.
  - **Owner request (2026-10-05): Explorar's controls in the cluster greens.** The selected
    Lista/Mapa button, "Mi ubicación" when on (dark green icon), the radius button and the
    selected category chip use the clusters' palette: lime-500 (#84cc16) with lime-950 (#1a2e05)
    text, replacing the brand teal there. A radius set by zooming stays amber so it stands out.
    The radius circle on the map and other screens keep the brand teal. Seen on the simulator.
  - **Fixed (2026-10-06): Google Maps directions went to the wrong business.** The owner searched
    "Metepec Peluditos", opened "Estética Canina Peluditos Spa" (Metepec, coordinates correct) and
    "Cómo llegar" → Google Maps routed to a different place in another city; Apple Maps and Waze
    were right. Cause: the Google link (copied from Ferre Mall) sent only the name and address as
    text, and Google's text search has no location bias there; the address also ended "Metepec,
    México, México" (DENUE's name for the Estado de México reads as the country). Fix: Google Maps
    now gets the exact coordinates (like Waze), and directions spell out "Estado de México".
    Trade-off: Google shows a pin at the point instead of opening the business's Google listing.
    Ferre Mall has the same Google link (it's hibernating; noted for if it resumes).
  - **Owner request (2026-10-06): a full landmark list.** Source: **Wikidata** (CC0, so no
    conditions; credited in Ajustes anyway). Landmark types: museums, metro and train stations,
    churches, cathedrals, convents, universities, archaeological sites, monuments, sculptures,
    parks, plazas, stadiums, airports, theaters, hospitals, shopping centers, libraries, cultural
    centers, palaces, skyscrapers, zoos, markets and more, only items with a Spanish Wikipedia
    article (a notability filter) and located in the nine states (via their P131 "located in"
    chain, so e.g. a Colima cathedral inside the box is dropped). Result: **1,102 landmarks**
    (CDMX 615, Edomex 110, Puebla 101, Hidalgo 98, Querétaro 45, Michoacán 42, Guerrero 37,
    Tlaxcala 28, Morelos 26), 1,989 searchable names with aliases ("La Latino", "Perisur",
    "MNA"). Coordinates checked against the curated ones (within ~50 m). Rules: stations answer
    only to "Metro X" / "Estación X" (so "Hidalgo" and "Insurgentes" stay a municipality and a
    colonia); generic one-word names and category keywords are skipped; items without a Spanish
    name are skipped; the 15 curated landmarks win on the same name (Wikidata lacks the Zócalo,
    the Ángel and the Monumento a la Revolución under these types). `pnpm places:landmarks`
    refreshes the committed snapshot (`data/landmarks-wikidata.json`, 290 KB, ~30 s; two queries,
    because following "located in" to any depth for every item timed out on Wikidata).
    Checked: "Teotihuacan" (53 places within 5 km), "perisur vet", "Metro Insurgentes",
    "Torre Latino"/"La Latino", "Acueducto de Queretaro", "Catedral de Puebla estetica".
    Note: a bare "Hidalgo" resolves to the municipality of Hidalgo (Michoacán), as before; states
    aren't search areas.
  - API: `POST /v1/places/:id/reports`, `POST /v1/places/:id/claims`, `ownerVerifiedOn` on
    places; migration 0007 (`place_reports`, `place_claims`).
- **Follow-ups:**
  - SAT check for claims: deferred (see "Pending owner reviews").
  - No notifications: the owner sees new claims and reports only by running the review commands;
    an admin page is to be discussed after Phase 7.
  - Reports have no rate limit beyond one per phone and reason; a deployed API would add Ferre
    Mall's per-IP rate limit (without storing IPs).

### Phase 6 — Pet-friendly layer

- **Scope:** pet policies (owner-declared, shopper-confirmed), curated CDMX restaurants and
  lodging, pet-friendly toggle and policy filters, pet profile in Settings.
- **Done when:** with a "perro grande" profile, the map shows only places whose policy allows
  large dogs, each with its policy source and last confirmation.
- **Branch / PR:** `phase-6/pet-friendly` / #8
- **Status:** Done, merged 2026-10-10 (`cb7b3b6`)
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm i18n:check`
  - [x] `pnpm test`: 216 tests (shared 27, api 59, importers 73, mobile 57), including the
        pet-friendly filter by species and dog size, confirm/dispute answers (one per phone, review
        after 3 disputes outnumbering confirmations, extra fields rejected), curated import (owner
        policies kept, answers cleared when a curated policy changes) and the claim's pet policy
  - [x] Migration 0011 applies on the local database; schema and migrations in sync
  - [x] API check on real data: `petFriendly=true` within 30 km of the Zócalo returns the 26
        curated places; with `petSpecies=dog&dogSize=large`, only Four Seasons Hotel Mexico City
        (any size) and Courtyard by Marriott Mexico City Airport (up to 35 kg), each with source
        and last confirmation
  - [x] Done-when check on a phone: Ajustes → Mi mascota → Perro → Grande; Explorar →
        Pet-friendly → Mapa. Verified by the owner on 2026-10-10: only Four Seasons and Courtyard Airport, each with source and date
- **Notes:**
  - **Owner decisions (2026-10-10):** Claude researches the curated list from the venues' public
    statements (source URL and check date per entry); dog sizes are pequeño up to 10 kg, mediano
    10–25 kg, grande over 25 kg.
  - **Curated data** (`packages/importers/data/pet-friendly-cdmx.json`, `pnpm places:curated`):
    26 places in CDMX: 16 lodging, 8 restaurants, 3 cafés (Greenway counts as both). Hotel
    policies come from each hotel's own site (Four Seasons, Hyatt, Marriott, IHG), read through
    the search index because those sites block automated fetches; restaurants and cafés rarely
    publish a policy, so theirs come from the food press (Time Out México, Chilango, Ciudad de
    México Secreta, 2024 article), credited on the card. Locations and phones from Overture Maps
    (release 2026-09-23.1, credited). Left out: places whose Overture location was ambiguous
    (Hyatt Regency Mexico City, Sheraton María Isabel, City Express Plus Santa Fe, Guau Tap,
    Q' Pedro Pablo Juárez), hotels that don't take pets (Camino Real Polanco, Marriott Reforma),
    and press lists older than 2024.
  - Weight limits map to the largest size they let in (15 kg → mediano, 35 kg → grande); the
    card shows the exact limit. Unknown sizes never match a size filter.
  - The Pet-friendly toggle (and the Restaurantes, Cafés and Hospedaje chips) show only places
    with a policy that takes pets and isn't under review, narrowed by the pet profile.
  - Shoppers: "¿Sigue siendo así?" (Sí, sigue igual / Cambió). A confirmation moves "Última
    confirmación" to today; 3 phones saying it changed, more than confirm it in 90 days, put it
    under review (hidden from the filters, warning on the card). Same privacy rule as reports:
    only the answer, the date and the app's random id. Review with `pnpm places:policies
[--keep N | --remove N]`.
  - Owners: the claim form of restaurants, cafés and lodging has a pet policy section; approving
    it publishes "Declarada por el dueño" and replaces any curated policy (owner wins on
    re-import).
  - API: `petPolicy` on places; `petFriendly`, `petSpecies`, `dogSize` filters;
    `POST /v1/places/:id/policy-answers`; migration 0011 (`pet_policies`, `policy_answers`,
    `place_claims.pet_policy`). `zod` added to the importers (already in the stack).
- **Follow-ups:**
  - Press sources for restaurants: accepted by the owner on 2026-10-10. Widening the curated
    set (more colonias, other cities) is still open.
  - Fees: restaurants' fees are left unknown; hotels' fees are as published.

### Phase 7 — Tourism and museums

- **Scope:** pet-friendly attributes on museums, parks and tourist sites from official sources
  once licensing is verified, plus curated entries.
- **Done when:** museums and parks appear with their pet policy, and each source is credited.
- **Branch / PR:** `phase-7/tourism-museums` / #9
- **Status:** Done, merged 2026-10-10 (`146991b`)
- **Checks:**
  - [x] Licensing of each source verified and recorded below
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm i18n:check`
  - [x] `pnpm test`: 217 tests (shared 27, api 59, importers 73, mobile 58)
  - [x] API check on real data: `category=park` lists the 8 parks with their policy and source
        (Chapultepec 1ª Sección and Parque Frida Kahlo as "No acepta perros"); a "perro grande"
        profile adds the 6 parks that take dogs to Four Seasons and Courtyard Airport
  - [x] Done-when check on a phone: Explorar → Museos and Parques; open a place and see its
        policy card and source. Verified by the owner on 2026-10-10
- **Notes:**
  - **Sources and licensing:**
    - Sistema de Información Cultural (Secretaría de Cultura): its open data may be copied,
      published, adapted and used commercially, with credit to the source. It has no pet
      policies, so it isn't imported yet (see follow-ups).
    - Pet rules are facts quoted with a link and check date, as in Phase 6: Chilango (Anahuacalli,
      Los Pinos, Parque México, Parque España), Time Out México reporting Sedema's Programa de
      Manejo del Bosque de Chapultepec, Mexico News Daily (Parque Lincoln, Parque Frida Kahlo),
      Ciudad de México Secreta (Parque Hundido). Credited on each card and in Ajustes.
    - Locations from Overture Maps (release 2026-09-23.1); Parque México and Parque España use
      their well-known coordinates because Overture's points for them are wrong.
  - **Curated data:** 10 new entries in `data/pet-friendly-cdmx.json` (36 in all): 2 museums
    (Anahuacalli, Complejo Cultural Los Pinos) and 8 parks (Chapultepec 1ª, 2ª and 3ª Secciones,
    México, España, Lincoln, Hundido, Frida Kahlo). Places that say no to pets are listed too, so
    shoppers know before they go; they never match the Pet-friendly filter. Public parks have no
    published size limit, so they match every dog size.
  - **App:** Museos and Parques chips (violet and brown pins). Unlike Restaurantes, Cafés and
    Hospedaje, they list every museum and park, each row showing its policy; the summary says
    "No acepta perros" when the policy says no.
  - Left out: Museo Tamayo's #ArteYPerros (a temporary exhibition), Teotihuacan and INAH museums
    (no source with a page to link yet), Viveros de Coyoacán and Bosque de Tlalpan (no source).
- **Follow-ups:**
  - Import the SIC museum directory (license allows it, with credit) once there is a way to fill
    pet policies for it; museums without a policy add little.
  - Add INAH sites ("no mascotas, salvo perros de asistencia") with official pages as sources.
  - Tourist sites chip: no entries yet.

### Phase 8 — Bug fixes

- **Scope:** fix the bugs the owner reports, plus two known issues: flaky Google "Ver horario"
  tests, and curated places with a wrong map location.
- **Done when:** each reported bug is fixed and checked on a phone, and the full test run passes
  while a `pnpm places:*` command runs at the same time.
- **Branch / PR:** `phase-8/bug-fixes` / #11
- **Status:** Done, squash-merged 2026-10-11 (`3673c52`) on the owner's request ("merge all code
  up to this point"). The owner tried each fix on a phone while asking for the next one; there
  was no separate done-when run.
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`
  - [x] `pnpm test`: 218 tests, also while `pnpm places:curated` runs alongside
  - [ ] Owner's bugs: fixed and checked on a phone
    - [ ] Map: remove the "my location" button (removed; also Android's built-in one)
    - [ ] Pet-friendly as its own tab between Explorar and Urgencias, with the restaurant, café,
          lodging, museum and park chips; Explorar keeps only pet businesses (new `group` filter on
          `/v1/places` and `/v1/places/map`)
- **Notes:**
  - **Flaky Google tests (fixed):** API and importer tests shared the dev database, and their
    test places use source `curated`. `pnpm places:curated` removes every curated place not in its
    file, so running it during a test run deleted the test place and the Google tests found
    nothing (`expected null`). Tests also wrote to and deleted real rows (the Google usage
    counters, old lookups). Tests now use their own database, `paw_mall_test` on the same Docker
    server, created and migrated by the test setup (`apps/api/test/test-db.ts`, shared by the
    API and importer runs, with a lock so parallel runs don't migrate at once). Override with
    `TEST_DATABASE_URL`.
  - **Curated locations (checked, no change):** each curated place is within 900 m of its
    stated colonia's center (colonias from `search_areas`); the Chapultepec sections and Los
    Pinos have no colonia in their address and were checked by hand. Parque México and Parque
    España were already corrected in Phase 7.
- **Follow-ups:** —

### Phase 9 — Pet-friendly at scale

- **Scope:** OpenStreetMap dog parks, parks and venues with a dog rule; DENUE restaurants and
  cafés in Ciudad de México with users' "¿Acepta mascotas?" answers making their policy.
- **Done when:** a name search in Pet-friendly finds an unanswered restaurant, two phones
  answering yes make it appear under Restaurantes with "Según usuarios de Paw Mall", and
  OpenStreetMap is credited on its places.
- **Branch / PR:** `phase-9/pet-friendly-scale` / #12, stacked on Phase 8 (#11); rebased onto
  `main` after #11 merged.
- **Status:** Done, squash-merged 2026-10-11 (`faaaf68`) on the owner's request, right after Phase 8. The
  done-when check wasn't run as a separate step; the owner used the app on a phone throughout.
- **Also on this branch (owner's UI requests, 2026-10-11):** radius only on the maps (gone from
  Ajustes) and shared by Explorar, Pet-friendly and Urgencias; every launch starts at 3 mi (5 km
  in km) with Mi ubicación on; both maps always show the same view (pans, zooms, cluster taps,
  searches); category icons on pins, rows and chips; clusters only past 100 places; Urgencias
  closest first, following a searched place or a moved map, with the same summary wording; a
  dialog asks whether a place-like search ("Tlaxcala") means the place or a business name; a
  searched area's circle follows the radius button, and a busy city opens at the preset closest
  to 3 mi.
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm i18n:check`
  - [x] `pnpm test`: 249 tests (shared 30, api 64, importers 95, mobile 60)
  - [x] API check on dev data: two "yes, up to mediano" answers on a DENUE taquería publish a
        users' policy (source `community`, mediano); test answers removed after
  - [ ] Done-when check on a phone
- **Notes:**
  - **Owner decisions (2026-10-10):** 2 phones agreeing, more than disagree, within 365 days.
    Searches in Pet-friendly show places that take pets, with "Buscar también en lugares sin
    confirmar" under the count to widen them to unanswered venues; when no confirmed place matches
    (e.g. "taco"), the search widens by itself, with a notice. Unanswered venues' pages ask
    "¿Acepta mascotas?".
  - **Ajustes → Mi mascota → "Solo lugares confirmados"** (on by default): off, Pet-friendly also
    lists venues without a policy yet, never those that say no (API `withUnconfirmed=true` with
    `petFriendly=true`; a widened search uses the same filter).
  - **DENUE:** SCIAN 7225xx in Ciudad de México only: 45,879 restaurants and 9,862 cafés
    (722515), no policy until users answer. Names that match the cruelty rule (e.g. "Taquería y
    Carnicería") are left out, as everywhere. Explorar never shows them (`group` filter).
  - **Users' answers:** `POST /v1/places/:id/pet-answers` (`takesDogs`, optional `maxDogSize`,
    `clientId`), table `pet_answers` (migration 0012), one row per phone. Same privacy rule as
    reports. The policy (source `community`) is published, updated or withdrawn on each answer;
    its size is the lower median of the sizes given. Venues with an owner, curated or OSM policy
    answer "¿Sigue siendo así?" instead (409 `POLICY_EXISTS`); non-venues get 409
    `NOT_A_PET_VENUE`.
  - **OpenStreetMap:** snapshot `data/osm-dogs-cdmx.json` (54 elements, 2026-10-11; `pnpm
places:osm`), 51 places saved: 32 dog parks (unnamed ones named "Parque canino, Col. …" from
    the nearest colonia), 17 parks and 2 venues; 4 say no to dogs; 2 skipped next to a curated
    park. ODbL 1.0: credited on each card ("© colaboradores de OpenStreetMap") and in Ajustes, and
    kept in their own rows (source `osm`). Footpaths tagged dog=* are ignored.
  - **Duplicates:** DENUE restaurants and cafés within 100 m of a curated or OSM venue of the same
    kind with a similar name (pg_trgm > 0.4) are hidden (`duplicate_of_curated` / `_osm`),
    re-checked on every run: 4 hidden (Cardinal ×2, Juana Juana, Q' Pedro Pablo).
  - Pet-friendly places within 160 km: 34 → 81 before any user answer.
  - **Fixed after the first phone try:** the Pet-friendly tab showed "Algo salió mal": the
    place `source` enum in `packages/shared` lacked `osm`, so every list with an OpenStreetMap
    place failed validation in the app. Added it, an OSM credit line on the place page and list,
    and an API test that lists an OSM place.
  - **Test fix (belongs to Phase 8):** `places.test.ts` cleaned up with `external_id LIKE
'test-%'`, deleting other files' test places when files ran in parallel (a second cause of the
    flaky Google tests); it now uses `test-places-`.
  - **Free sources instead of Google (owner, 2026-10-11):** Google's dog and hours fields cost
    $25 per 1,000 requests and can't be stored, so:
    - **OpenStreetMap hours** (`pnpm places:osm-hours`, snapshot `data/osm-hours.json`): restaurants
      and cafés in CDMX, vets and pet stores in the region. 1,120 elements, 978 readable (one range
      per day; split shifts, holidays and the like are skipped), 375 matched to listed places
      (same kind, within 100 m, similar name).
    - **Business homepages**, on the website check's single visit: schema.org hours and "pet
      friendly" wording (never next to a no). Only when the site speaks for that one place: its
      host belongs to no other place, it isn't a hotel group's homepage, and it names the place.
      The first run without that rule picked up chain sites ("sucursales pet friendly",
      wyndhamhotels.com); with it: hours for 44 places, 12 venues say pets are welcome (source
      `website`, credited to the site).
    - **Chain-wide policies** (`pnpm places:chains`, `data/pet-friendly-chains.json`): no
      restaurant or café chain in Mexico states one policy for all branches; City Express by
      Marriott does (1 pet up to 15 kg). DENUE hotels in CDMX (721111, 721112, 721190; 794) are
      imported so chains and users can fill them; City Express adds 2 branches beyond the 5
      curated ones.
    - Hours priority: owner > website > OpenStreetMap; the place page says where they came from.
    - Pet-friendly places within 160 km: 81 → 95.
  - **Ajustes has the last word (owner, 2026-10-11):** the radius and language chosen in Ajustes
    hold across launches (a first launch: Spanish, 3 mi / 5 km); a zoom by hand or a tapped cluster
    saves its radius to Ajustes as the closest choice (no separate "custom" radius any more);
    Urgencias follows the Ajustes radius and place switches. Launch and wake still reset the
    location, the map view and Mi ubicación.
  - **Backfill to every supported state (owner, 2026-10-11):** DENUE restaurants, cafés and hotels
    in all 9 states (about 311,000 venues; 336,588 places in all), OpenStreetMap dog places and
    opening hours across the region (snapshot `data/osm-dogs.json`, renamed from
    `osm-dogs-cdmx.json`: 187 elements, 173 places saved, 101 dog parks; hours: 2,874 elements,
    687 matched), City Express policy on 7 branches. Pet-friendly places within 160 km of CDMX:
    95 → 154 (177 after the website check). Curated places stay CDMX-only (hand research).
    Website check over 6,934 sites: hours for 70 places, 54 venues say pets are welcome (mostly
    hotels with their own site; one restaurant inside a hotel takes the hotel's wording).
  - **List duplicates (fixed):** pages fetched at different times could repeat a place when
    policies changed in between (React "two children with the same key"); the list keeps each
    place once.
- **Follow-ups:**
  - Pet-friendly with "Solo lugares confirmados" off takes 0.6–1.1 s in dense areas (sorting
    about 13,000 places); worth an index or a cheaper count.
  - `pnpm places:enrich-overture` and `pnpm places:check-websites` now also cover 55,741
    restaurants and cafés; consider limiting website checks to pet businesses before running them.
  - Answers from abusive phones: no rate limit beyond one answer per place and phone.

### Phase 10 — All of Mexico

- **Scope:** every data source extended from the nine states to all 32 (owner's request,
  2026-10-11: "backfill data to cover all mexico").
- **Done when:** a search for a place in a newly covered state (e.g. "Guadalajara",
  "Monterrey", "Mérida") moves the map there with its pet businesses and pet-friendly places, and
  this log records the data volumes and import times.
- **Branch / PR:** `phase-10/all-mexico` / #14
- **Status:** Done, squash-merged 2026-10-12 (`d7384e2`) on the owner's request ("merge all code up to this
  point"). The done-when check wasn't run as a separate step; the owner merged after the import.
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`: 257 tests
  - [x] Imports run on all states (volumes and times below)
  - [ ] Done-when check on a phone
- **Notes:**
  - **DENUE:** `STATE_FILES` lists all 32 states (INEGI files `denue_NN_csv.zip`; only Estado de
    México is split, `denue_15_1/2`). The other 23 states' zips add about 400 MB to the cache.
  - **OpenStreetMap:** both Overpass queries use Mexico's boundary
    (`area["ISO3166-1"="MX"][admin_level=2]`) instead of a box, so no US or Guatemalan elements.
    Dog places snapshot: 187 → 295 elements; opening hours snapshot: 5,378 elements, 4,561 with
    readable hours (2026-10-12).
  - **Wikidata landmarks:** 12 boxes over Mexico (one box times out); `STATE_IDS` has all 32
    states with DENUE's state names. Snapshot: 1,102 → 2,065 landmarks.
  - **Overture:** the download box covers all of Mexico (it also takes in some of the US and
    Guatemala, harmless: Overture only adds phones and websites to our own places).
  - **Import run on dev data (2026-10-11), in order:**
    | Step                                           | Result                                                                                                                                          | Time                      |
    | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
    | `places:import`                                | 813,254 places (was 336,588); 573 cruelty-linked names left out                                                                                 | 128 s                     |
    | `places:areas`                                 | 80,922 search areas (71,111 colonias, 3,646 towns, 2,476 municipalities, 3,689 landmarks) from 6.1 M DENUE rows                                 | 60 s                      |
    | `places:enrich-overture`                       | 44,018 pet-type Overture places; 8,284 matched; 3,292 phones, 1,553 websites saved                                                              | 407 s (download included) |
    | `places:curated`                               | 36 places; 9 DENUE copies hidden                                                                                                                | 38 s                      |
    | `places:osm`                                   | 275 places (137 dog parks, 125 parks, 15 venues; 11 say no); 10 DENUE copies hidden                                                             | 47 s                      |
    | `places:osm-hours`                             | 1,747 places with OpenStreetMap hours (was 687)                                                                                                 | 6 s                       |
    | `places:chains`                                | City Express on 63 branches (was 7)                                                                                                             | <1 s                      |
    | `places:check-websites`                        | 16,933 sites: 6,965 working, 256 blocking checks, 1,138 unreachable, 8,574 dead (hidden); hours for 171 places; 125 venues say pets are welcome | 4,389 s (73 min)          |
    | Database: 813,565 places, 697 MB (was 281 MB). |
  - **Query speed:** after the import, Pet-friendly with "sin confirmar" around Guadalajara (16 km)
    took 2.2 s; `ANALYZE` brought it to 0.14 s (CDMX 0.63 s). `places:import` now runs `ANALYZE
places` at the end. Place searches ("Guadalajara", "Monterrey", "Mérida", "Tijuana") resolve
    to their municipality; the map query answers in 0.1 s.
- **Follow-ups:** —

### UI refresh, end-to-end tests and CI (not a phase)

- **Scope:** the owner's UI requests of 2026-10-12 and 2026-10-13, Android development build,
  Maestro end-to-end tests and GitHub Actions, on one branch (not a numbered phase).
- **Branch / PR:** `fix/ui-bugs` / #16
- **Status:** Done, squash-merged 2026-10-13 (`ed5c432`) on the owner's request ("add the
  DEPLOYMENT.md entry and merge").
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`: 297 tests (shared 35, mobile 82, API 85,
        importers 95); GitHub Actions `CI` green on the PR
  - [x] Maestro, 21 flows covering the 25 journeys in [TESTING-E2E.md](TESTING-E2E.md): 21/21 on
        the Android release build (emulator, fixed test data)
  - [x] iOS simulator and the owner's iPhone (Expo Go) for the map and search changes
  - [ ] GitHub Actions `E2E` workflow run (needs the `GOOGLE_MAPS_ANDROID_KEY` secret and the
        `run-e2e` label)
- **Notes:**
  - **App:** compact place page (icon links, copy and share the address, favorite heart), place
    cards with contact icons, a Favoritos tab, cream backgrounds, centered logo; map controls
    floating over the map, satellite toggle, lime radius circle, cluster bubbles sized to their
    count, a tapped cluster centered on its places.
  - **One page for Explore and Pet-friendly:** drawn once by the tabs layout over both tabs
    (`explore-frame.tsx`), one map; only the places, chips and title change.
  - **Search box:** order-invariant, tokenized autocomplete (place names from the API, nearby
    businesses filtered on the phone; shared stop words and CDMX/DF aliases in
    `packages/shared/src/search-tokens.ts`). A picked place searches there; the place-or-business
    question only for a typed place name sent with the search key.
  - **"Mi ubicación":** the button returns to the user at the smallest preset; off after a place
    pick, "as a place", moving, zooming or a cluster tap; on after "as a business name".
  - **Android:** development build with Paw Mall's own Maps key (`dev.pawmall.app`,
    `apps/mobile/.env.local`); `pnpm --filter mobile emulator:location`.
  - **Testing and CI:** Maestro flows in `apps/mobile/.maestro/`, test data `pnpm e2e:seed`;
    `.github/workflows/ci.yml` (every PR) and `e2e.yml` (nightly, manual or `run-e2e` label);
    `run-e2e` label created.
  - **Fixed along the way:** iPhone map asked for the old area (no pins); Android map opened on
    the whole world; suggestions untappable on Android (outside their parent); release bundle
    needed `@babel/plugin-transform-react-jsx` hoisted; release builds drop `android.config`
    (`extra.mapsKeyConfigured`).
  - **Dependencies added (approved):** `expo-clipboard`, `expo-dev-client`.
- **Follow-ups:**
  - Add the `GOOGLE_MAPS_ANDROID_KEY` repository secret and run the `E2E` workflow once.
  - The Android emulator's hardware graphics crashed twice during runs; local runs use
    `-gpu swiftshader_indirect` (as CI does).
  - The business-name search matches inside words ("net" in "Veterinaria"); suggestions match
    word starts. Align if the owner wants.

### Phase 11 — Hardening

- **Scope:** recommendations 1–4 of an external review (`Paw_Mall_Project_Review.pdf`, 2026-10-13):
  rate limits on writes, CORS, a data-integrity report, a verification status per place.
- **Branch / PR:** `phase-11/hardening` / #18
- **Status:** Done. Squash-merged into `main` as `bf1d4e7` on 2026-10-13; branch deleted.
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm i18n:check`
  - [x] `pnpm test`: 313 tests (shared 35, mobile 82, api 95, importers 101)
  - [x] `wrangler dev` (simulated limiter): 20 bad-input POSTs answer 400, the 21st to 23rd 429
  - [x] CORS: `Origin: http://localhost:8081` gets `Access-Control-Allow-Origin`; another origin
        gets none; requests without Origin (the phone app) work as before
  - [x] Verification on dev data: place 18501 `website_verified` (checked 2026-10-11), DENUE-only
        places `listed` (edition 2026-05-20); list of 200 places near the Zócalo ~75 ms (main ~70)
  - [x] `pnpm places:integrity` on the full data: 22 s
  - [x] iOS simulator (iPhone 17 Pro Max, iOS 26.5, Expo Go, app in English), dev data: after one
        "closed" report, place 18501 shows "Under review: users reported this place or its pet
        policy" in amber under the address; Urgencias (5 km, Cuauhtémoc) cards say "Call before
        going: details aren't confirmed by the owner." Test report removed with
        `pnpm places:reports --restore 18501` (back to `website_verified`).
- **Notes:**
  - Rate limit: Cloudflare's Workers rate-limit binding (`WRITE_LIMITER`, 20 POSTs per minute per
    user), simulated by `wrangler dev`, no cost when deployed. The key is the IP hashed with the
    day, as for Google; only the limiter counts it, in memory, and the API stores nothing (reporter
    privacy holds). Off for end-to-end runs (`dev:e2e` sets `WRITE_RATE_LIMIT=off`).
  - Claims: at most 3 pending per place (429 `RATE_LIMITED`) until reviewed, since they hold
    contacts.
  - CORS: `CORS_ORIGINS` in `wrangler.toml` (Expo web on 8081 and 19006).
  - Verification statuses, first match wins: `needs_review` (any report or a disputed policy),
    `owner_verified`, `community_confirmed`, `website_verified` (check within 365 days), `listed`.
    Places that leave DENUE are already deleted on import, so a missing edition isn't a status.
  - First integrity report (dev data, 813k places): 0 outside Mexico, **5,782 probable duplicates**
    (same name within 50 m, mostly DENUE twins a few metres apart), 0 invalid hours, **165
    Urgencias places without a phone**, **5 "24 horas" vets known only from the name**, 0 stale
    sources, websites or policies, 0 places without a category, empty review queue.
  - `@paw-mall/shared/hours` subpath export: Node runs the importer CLIs' TypeScript directly and
    can't load the package index.
- **Follow-ups:**
  - Decide what to do with the 5,782 probable duplicates (merge rule, or hide the newer twin).
  - `pnpm format:check` already fails on `main` for `.maestro/claim.yaml`, `.maestro/config.yaml`
    and `data/osm-hours.json`; left as is.
  - Review items 5–7 (E2E gaps, failure tests, load test) are the next candidate phase.
- **CI fix:** the first CI run failed in `pet-policies.test.ts`: the importer and API tests share
  `paw_mall_test` in parallel, and `osm/hours.test.ts` puts places with partial hours within the
  pet-policy test's 1 km around (2, −131) (also behind a `main` failure earlier on 2026-10-13).
  The pet-policy test now uses its own spot at −137.

### Phase 12 — Failure coverage

- **Scope:** review items 5–6: E2E gaps (animal-cruelty report, API down while online, iOS) and
  failure tests (database outage, interrupted import, slow API).
- **Branch / PR:** `phase-12/failure-coverage` / #20
- **Status:** Done. Squash-merged into `main` as `677ff30` on 2026-10-13; branch deleted.
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm i18n:check`
  - [x] `pnpm test`: 320 tests (shared 35, mobile 84, api 98, importers 103)
  - [x] Android emulator (release build of this branch, `BUNDLED=true`): 22 flows; first full run
        21/22 (`settings-units` tapped "Millas" before Ajustes drew; a wait added, then it passed
        3 times alone); `pet-friendly-widen` fixed (below); `api-down` passed with the e2e API
        stopped
  - [x] iOS simulator (iPhone 17 Pro Max, iOS 26.5, Expo Go): 21/21 flows (`offline` is
        Android-only) in 10 m 45 s; `api-down` passed
- **Notes:**
  - New flows: `report-cruelty`, `api-down/api-down` (kept out of the main run; CI runs it after
    stopping the API, results in `report-api-down.xml`, picked up by the "Maestro flows" check).
  - iOS runs in Expo Go (`e2e:metro-ios` on 8085, `e2e:ios`): CocoaPods isn't installed, so no iOS
    development build; local only (macOS runners cost 10× the minutes). Flows made cross-platform:
    `APP_ID`/`IOS` variables, `common/back.yaml`, `common/hide-keyboard.yaml`, name matches as
    `Name.*` (iOS reads a row as one accessibility label), `offline` tagged `android-only`.
  - **Phase 11 regression found:** the new verification line pushed "No sé" below the screen in
    `pet-friendly-widen`, whose optional tap then skipped it; the flow now scrolls to it. (The
    nightly E2E would have failed.)
  - App: requests give up after 15 s (`src/api/fetch-timeout.ts`) and show "couldn't reach the
    server" with a retry, instead of an endless spinner.
  - API with the database down: `/health` answers 200 with `database: unavailable`; every route
    answers 500 `INTERNAL_ERROR` with no details (`database-down.test.ts`).
  - DENUE import: the save step moved to `denue/save.ts`; a failure part way leaves the previous
    places and no `import_runs` row (`save.test.ts`). The other importers write per run or per
    place and are safe to re-run.
  - Release APK built with JDK 17 (`~/.gradle/jdks/...17...`); the default JDK 26 fails.
- **Follow-ups:**
  - Run the `E2E` workflow on this PR (label `run-e2e`) to confirm the CI path with `api-down`.
  - Review item 7 (load test) needs k6, a new dependency.

### Phase 13 — Load test

- **Scope:** review item 7: a load test of the API (k6, approved by the owner 2026-10-14; no
  cost: local only, no cloud service), and fixes for what it finds.
- **Branch / PR:** `phase-13/load-test` / #24
- **Status:** Done. Squash-merged into `main` as `e3c564f` on 2026-10-14; branch deleted.
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm i18n:check`
  - [x] `pnpm test`: 334 tests (shared 36, mobile 93, api 102, importers 103)
  - [x] `pnpm load` (50 users, dev data, 813k places): passes, p95 229 ms
  - [x] Fresh database migrates; `pnpm e2e:seed`; `pnpm places:import` keeps `pet_business` exact
- **Notes:**
  - `apps/api/load/places.js`, `pnpm --filter api dev:load` (port 8789, no Google key) and
    `pnpm load`; see DEVELOPMENT.md, "Load test". Never calls "Ver horario"; writes fail
    validation, so nothing is stored. The write burst confirms 429 after 20 per minute.
  - **First run failed:** p95 2.18 s at 38 requests/s; one user alone was fine (p95 241 ms).
    Postgres used all 4 Docker CPUs; the API barely any. Plans captured with `auto_explain`
    (turned on in the dev database for the run, then reset):
    - Pages sorted every place in the radius (105k for 25 km around Mexico City, on disk) to
      keep 20. Now read nearest-first from the location index: 370 ms → 23 ms.
    - JIT compiled each query (~60 ms) for queries that run in less. Off per connection.
    - Explorar filtered 813k places for 51k pet businesses one by one. New
      `places.pet_business`, kept by triggers on `place_categories` (migration 0013), with a
      location index on pet businesses only.
    - Urgencias walked pet businesses by distance to find hospitals; it now starts from the few
      hundred candidates.
  - **After:** p95 229 ms at 77 requests/s (list 191 ms, map 197 ms, search 347 ms, Urgencias
    356 ms).
  - Order change: places at the same distance (to 0.1 km) were ordered by id; now by exact
    distance, then id.
  - DENUE import: 143 s → 154 s with the triggers (they update only flags that change).
- **Follow-ups:**
  - E2E flows weren't rerun on this branch (the order change can only reorder places within
    0.1 km); the nightly run or the `run-e2e` label covers it.

### Phase 14 — Data cleanup

- **Scope:** act on the first `pnpm places:integrity` report (Phase 11): 5,782 probable
  duplicates, 165 Urgencias places without a phone, 5 name-only "24 horas" vets.
- **Branch / PR:** `phase-14/data-cleanup` / #25
- **Status:** Done. Squash-merged into `main` as `472c7cc` on 2026-10-14; branch deleted.
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`
  - [x] `pnpm test`: 336 tests with Phase 13 (shared 36, mobile 93, api 102, importers 105)
  - [x] `pnpm places:import` on the dev data, then `pnpm places:integrity`
- **Notes:**
  - **Duplicates:** almost all the 5,782 pairs are different businesses with one name at one
    spot: market and food-court stalls ("Cocina Económica" 363 pairs, "Antojitos Mexicanos" 187),
    school co-ops, Herbalife clubs. DENUE gives each stall the market's address and point. Only
    468 pairs also share the phone (762 places, 86 pet businesses, none with reports, claims,
    policies or answers).
  - The DENUE import now merges those (`dedupeSameBusiness`, next to the chain-branch merge):
    same name and phone digits within 50 m, no chain. It keeps the better entry (contact data,
    newest registration) with every twin's category (a feed store that is also a pet store).
    377 merged on the dev data; the import removed the extra rows (no linked data).
  - The integrity report splits the check: `duplicates` (same name and phone; 21 left, all with
    the phone from Overture, which the import can't see) and `same_name_nearby` (5,212; phones
    differ or missing; check by hand, not merged).
  - **Urgencias without a phone (165):** 164 are DENUE vet hospitals (of 616) with no phone,
    and 133 have no website or social page either. No source in the pipeline has their phones.
    "Ver horario" (Google, on demand) can show a phone. Left as is.
  - **"24 horas" by name only (5):** the app already shows "Says “24 horas” · not confirmed";
    nothing to clean.
- **Follow-ups (owner):**
  - Vet hospitals without a phone: import OpenStreetMap vets' phones (free, ODbL credit), ask
    owners to claim them, or leave them to Google on demand.
  - The 21 Overture-phone twins: merge by hand or teach `places:enrich-overture` to hide one.

### Phase 15 — OpenStreetMap vet phones

- **Scope:** the owner's pick from Phase 14's follow-ups: fill phones of vets (and vet hospitals,
  for Urgencias) that have none, from OpenStreetMap.
- **Branch / PR:** `phase-15/osm-vet-phones` / #27
- **Status:** Done. Squash-merged into `main` as `1e95d14` on 2026-10-14; branch deleted.
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm i18n:check`
  - [x] `pnpm test`: 339 tests (shared 36, mobile 93, api 102, importers 108)
  - [x] `pnpm places:osm-phones --refresh` on the dev data, then `pnpm places:integrity`
- **Notes:**
  - `pnpm places:osm-phones` (`src/osm/phones.ts`), like `places:osm-hours`: one Overpass
    request for named `amenity=veterinary` with `phone` or `contact:phone`, committed snapshot
    `data/osm-vet-phones.json` (2026-10-14). A vet or vet hospital without a phone within 100 m
    with a similar name gets the first number, written as DENUE does (+52 and the old mobile 1
    removed; 10 digits only), `phone_source = 'osm'`. Re-runs clear earlier OSM phones first.
    DENUE, Overture and owner phones always win; the DENUE import keeps OSM phones.
  - The app credits it: "Teléfono: © colaboradores de OpenStreetMap (ODbL)" on the place page,
    and the OpenStreetMap line under the list.
  - **Result is small:** OpenStreetMap has 327 Mexican vets with a phone (300 readable); 19
    listed vets without a phone matched, 3 of them hospitals. Urgencias without a phone: 165 → 162. First Overpass request got 504 (busy); the retry worked.
- **Follow-ups (owner):**
  - The other 162: owner claims, or "Ver horario" (Google, on demand) for a phone.

### Phase 16 — Bug fixes 2

- **Scope:** bugs the owner found after Phase 15 (2026-10-14).
- **Branch / PR:** `phase-16/bug-fixes` / #28
- **Status:** Done. Squash-merged into `main` as `501415d` on 2026-10-14; branch deleted.
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm i18n:check`
  - [x] `pnpm test`: 345 tests (shared 36, mobile 96, api 105, importers 108)
  - [x] Android emulator (release build of this branch): new `search-pan` flow, plus
        `search-zoom`, `search-zoom-out`, `place-question`, `place-question-business`,
        `search-clear`, `near-me`, `search-section`, `search-typed-fit`, `map-buttons`,
        `emergencies`, `map-list`, `pet-friendly`, `empty`, `chips`, `pet-friendly-widen`,
        `radius`, `search-pan`, and new `urgent-sync` and `maps-sync`: all pass
- **Fixes:**
  1. **A hand pan lets go of a searched place.** After picking a place from the suggestions or
     answering "As a place", the map ignored pans. Now a pan away from the place empties the
     search box and the search follows the map. It keeps the place's radius, or the zoomed one,
     and "Mi ubicación" stays off (`leaveArea` in `explore-view.tsx`). A zoom alone still keeps
     the place and changes its radius. Business-name searches never fix the map on a place, so
     they already followed pans.
  2. **Urgencias agrees with the map.**
     - Its counter counts every urgent place in the circle; it used to count the cards, which
       stop at 20. The API now returns `total`.
     - Around a searched place it uses the place's radius from the map, not Ajustes'.
     - It names the circle exactly as the list or map on screen does (`circleName`). Both tabs
       keep a map mounted, and the hidden one's nearest place is of the other kind (a restaurant
       vs a vet), so only the tab on screen shares its name (`useScreenFocused`). This was the
       drift the owner still saw after the first fix. Flow `urgent-sync` compares the two names.
  3. **Pins up to 200:** the map shows places one by one up to 200 in view (was 100), then
     clusters (`MAP_MAX_PLACES`).
  4. **Urgencias with none found says where:** "We couldn't find veterinary hospitals within 5 km
     of Tlaxcala." The name is the same one as the summary uses: the searched area, or the list's
     or map's city. With an empty circle (no place to take a city from), the API returns the
     nearest municipality (`nearestMunicipality`; looked up only then). `search-pan` checks it.
  5. **Empty map and list say where:** with nothing in the circle (often after moving the map),
     the map reads "0 places within 5 km of Chiautempan" and the list's empty messages "No places
     within 5 km of Chiautempan." The name is the searched area, or the nearest municipality: the
     list response's `nearestMunicipality`, and the map's `nearestCity`, which falls back to it.
     `search-pan` checks the map, the list and Urgencias.
  6. **Pin button on the map:** a round button above the map-style button shows how many places
     in view the map draws as pins before it groups them into clusters. Each tap steps through 50,
     100, 150, 200 and 300 (`MAP_PIN_LIMITS`; default 200). It's saved with Ajustes (`mapPinLimit`)
     and both maps follow it. The app sends it as `limit`, and the API now accepts up to 300.
     `map-buttons` checks the steps.
  7. **Bigger compass icon:** 28 pt instead of 20, in the same 36 pt circle.
  8. **The two maps drifted again.** Reproduced on the emulator: pick Tlaxcala on Explorar (5 km),
     open Pet-friendly, and it refit to 160 km. The search fit ran once per tab, so each tab fit
     its own matches and the second fit moved the shared map. It now runs once per search
     (`search-fit.ts`). Also, a hand zoom saves the view's center along with the radius, so the
     other map shows exactly the same view; a pinch shifts the center up to 5%, which used to
     stay unsaved. New flow `maps-sync`.
  9. **Hide-keyboard button on the keyboard's edge:** it floated 8 pt above the keyboard; now it's
     a tab joined to the keyboard's top edge, in a keyboard gray (`keyboard-bar.tsx`). The system
     keyboard is its own window over the app, so nothing can be drawn inside it. `map-buttons`
     checks the tab closes the keyboard.
- **Notes:**
  - The first E2E attempt "failed" because `common/hide-keyboard.yaml` pressed Back after picking a
    suggestion had already closed the keyboard, which sent the app home; `search-pan` doesn't use
    it.

### Phase 17 — Search benchmark

- **Scope:** the QA strategy's section 5 (owner's request, 2026-10-14): a version-controlled
  benchmark of labeled searches, with precision and recall at 10, zero results, latency and
  regressions against a baseline.
- **Branch / PR:** `phase-17/search-benchmark` / #31
- **Status:** Done. Squash-merged into `main` as `998af42` on 2026-10-14; branch deleted.
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`
  - [x] `pnpm test`: 360 tests (shared 36, mobile 96, api 105, importers 123; 15 new)
  - [x] "Done when": `pnpm search:bench` runs the 41 queries on the full data (813,169 visible
        places) in under a minute; the baseline is committed; with two results changed in a copy of
        the baseline, `--check` reported both (`emergency-cdmx: recall@10 0.60 → 0.20`,
        `trainer-mty: no results`) and exited 1
- **What it adds:**
  - `packages/importers/data/search-benchmark.json`: 41 queries from nine cities, tagged by kind
    (service, synonym, accents, spelling, English, multi-token, geography, known item, chain,
    pet-friendly, negative). Labels describe the intent (categories, words in the name, city,
    takes pets), the circle to judge, known items that must be in the top 10, and negative cases
    where any result is wrong (puppy mills, cockfighting, "pizza", gibberish). The labels are drafts
    for the owner to review.
  - `packages/importers/src/bench/`: the runner sends each query as the app does (typed text as
    names only; Pet-friendly with its confirmed-only default), judges the top 10 in SQL against
    the label, never through the API's search code, and compares with
    `data/search-baseline.json`. `--check` exits 1 on a regression; `--save` writes a baseline.
  - Docs: DEVELOPMENT ("Search benchmark"), ARCHITECTURE, README (baseline, known gaps), the QA
    strategy's status table, PLAN (phase 17), CLAUDE.md (local setup).
- **Baseline (2026-10-14):** precision@10 93%, recall@10 72%, zero results 5% (2 of 37), known
  items 6 of 6, negative cases 4 of 4, place intent 5 of 5, latency p50 31 ms, p95 46 ms.
- **What it found** (for a later phase; nothing changed in search here):
  1. **No typo tolerance:** "veterinria" finds nothing (80 vets in the circle). The shared schema's
     comment said small typos were ignored; corrected.
  2. **Generic words left after a service word must be in the name:** "urgencias veterinarias"
     finds 2 of 29 hospitals ("veterinarias" must be in the name), "pensión para perros" 1 of 6,
     "dog grooming" 6 of 92, "parque para perros" 1 of 36, "adiestrador de perros" none.
  3. **Synonyms missing:** "hotel para perros" returns only a shelter (boarding not understood);
     "croquetas" only finds names with the word (5 of 777 stores).
  4. **Short words match inside words:** "vet me" lists vets with "me" inside the name (Gómez), so
     only 1 of 10 is the business.
  5. **Pet-friendly "restaurante"** also lists a hotel with a restaurant in its name (a label
     question for the owner).
- **Not covered:** comparison with other services (§5's last metric): Google results can't be
  collected without billed requests or scraping, so it needs the owner's decision.

### Phase 18 — Search gap fixes

- **Scope:** the gaps Phase 17's benchmark found (owner's request, 2026-10-14).
- **Branch / PR:** `phase-18/search-gaps` / #33
- **Status:** In review.
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`
  - [x] `pnpm test`: 362 tests (shared 40, mobile 96, api 106, importers 123)
  - [x] "Done when": `pnpm search:bench` against Phase 17's baseline: 0 of 41 queries regressed;
        precision@10 93% → 99%, recall@10 72% → 96%, zero results 5% → 0%; new baseline
        committed (`c6477a4`)
  - [x] Android emulator (release build; the app is unchanged, the e2e API runs this branch):
        `search-clear`, `pet-friendly-widen`, `pet-friendly`, `place-question`,
        `place-question-business`, `search-typed-fit`, `search-section`, `search-zoom`,
        `search-zoom-out`, `chips`, `emergencies`, `search-pan`: 12 of 12 pass
- **Fixes** (`detectCategory` in `packages/shared/src/search-keywords.ts`; `allWordsSql` in
  `apps/api/src/queries/places.ts`):
  1. **Typos:** a word of 7 or more letters one edit (or one swap) away from a keyword of a single
     category names that category: "veterinria" finds the 80 vets (was none).
  2. **Pet words and later keywords dropped:** once a keyword names the category, "perros",
     "mascotas", "dog" and similar, and further keywords, are no longer required in names.
     "urgencias veterinarias" 2 → 10 of 29 hospitals, "dog grooming" 6 → 10, "pensión para
     perros" 1 → 6 of 6, "adiestrador de perros" 0 → 1 of 1, "parque para perros" 1 → 10.
  3. **Synonyms:** pet food ("croquetas", "alimento/comida para perro…", "pet food") as pet
     stores (5 → 10); "hotel para perros", "hotel canino", "hospedaje para mascotas"… as boarding
     (the shelter it found is gone); Pet-friendly venue words ("café", "restaurante", "hotel",
     "parque", "museo") as their categories, so "restaurante" no longer lists a hotel with the
     word in its name.
  4. **Short words:** a word of 3 letters or fewer must start a word of the business's name;
     longer words still match anywhere ("kota" finds "Maskota"). "vet me" 1 → 7 of 10.
- **Notes:**
  - On Explorar, "hotel" alone is still a name search (lodging isn't a pet business), and on
    Pet-friendly "hotel para perros" is too (boarding isn't a venue).
  - Remaining weak queries: "veterinaria 24 horas" (the "horas" must be in the name; the one
    match in 10 km is "Veterinaria 24 Siete", so the label may need a review) and "vet me" (7 of
    10).
  - A town named like a pet word (Mascota, Jalisco) typed after a keyword ("veterinaria
    mascota") loses the town; picking it from the suggestions still works.

### Phase 19 — A place with other words

- **Scope:** the owner's examples (2026-10-14): "veterinaria mascota" and "mascota veterinaria"
  should find the vets in Mascota, Jalisco, and "puerto vallarta taco" found nothing.
- **Branch / PR:** `phase-19/service-in-place` / #34, stacked on Phase 18 (#33), which isn't
  merged yet.
- **Status:** In review.
- **Checks:**
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm i18n:check`
  - [x] `pnpm test`: 372 tests (shared 41, mobile 97, api 110, importers 124)
  - [x] `pnpm search:bench`: 47 queries, 0 of 41 regressed against Phase 18's baseline; the six new
        ones score 90–100% (both orders and "veterinaria en Mascota" find Mascota's 4 vets; "vet
        tlaxcala" from Puebla; "veterinaria mi mascota" by name; "puerto vallarta taco" 9 of 10);
        precision@10 99%, recall@10 97%; new baseline committed (`ac3cc90`)
  - [x] Android emulator (new release build): full run 29 of 30 passed; `search-typed-fit` failed
        on its example (below) and passes with the new one (twice); new flow `service-in-place`
        passes (three times)
- **What changed:**
  1. **API:** `GET /v1/places/area` also reads a place with other words in any order ("X Y", "Y
     X", "X en Y"), returning the place, the other words (`business`), the kind of business they
     name (`category`) and `ambiguous`: a business within 25 miles of the user has every word in
     its name, or the place's name is a pet word ("Mascota"). The list and map already read such
     texts when they aren't sent as names only.
  2. **App:** with the search key, a place with other words goes straight there; when ambiguous it
     asks "¿Qué buscas?": **En Mascota** or **Con ese nombre**. "By that name" sends `exactWords`:
     every word in names, no keyword read as a category.
  3. **Old rule changed:** typed text with a place in it ("Tlaxcala Casona", owner's example of
     2026-10-13) was a business-name search around the user; now it goes to the place, unless a
     business near the user has those words (then it asks).
  4. **Benchmark:** `exact` mode, a `widened` option (Pet-friendly's fallback to unconfirmed
     venues) and six queries.
  5. **Flows:** new `service-in-place` (both orders, and "Paw Tlaxcala"); `search-typed-fit` now
     types "forrajeria" (no place in it; 5 → 10 km).
- **Notes:**
  - "veterinaria mascota" always asks: "Mascota" is also a pet word, and 70 vets within 25 km of
    the Zócalo have both words in their names.
  - Puerto Vallarta has no confirmed pet-friendly taco place, so Pet-friendly shows unconfirmed
    ones with its usual notice, and the app switches to Pet-friendly (it finds more).
  - `search-typed-fit`'s first new example, "forrajeria paw", also matched "Café Perruno Paw", so
    the app rightly switched to Pet-friendly; "forrajeria" alone matches nothing nearby on either
    tab.
  - The Android keyboard can swap in its suggestion when Enter is pressed mid-word; the flows type
    a trailing space. The emulator crashed twice during builds; cold boots fixed it.

## Production deployment

Not planned. When the owner decides to deploy, add a section here covering environments, cloud
resources, secrets, migrations, rollback and costs (see PLAN.md, "Later" and "App Store and Google
Play readiness").

## Change log

| Date       | Change                                                       | PR  |
| ---------- | ------------------------------------------------------------ | --- |
| 2026-10-05 | Rollout log created                                          | #1  |
| 2026-10-05 | Phase 1 started                                              | #2  |
| 2026-10-05 | Phase 1 merged (`a0199db`)                                   | #2  |
| 2026-10-05 | Phase 2 started                                              | #3  |
| 2026-10-05 | Phase 2 merged (`97d6019`)                                   | #3  |
| 2026-10-05 | Phase 3 started                                              | #4  |
| 2026-10-05 | Phase 3 merged (`df26ef2`)                                   | #4  |
| 2026-10-05 | Phase 4 started                                              | #5  |
| 2026-10-05 | Phase 4 merged (`c30d151`)                                   | #5  |
| 2026-10-05 | Phase 5 started                                              | #6  |
| 2026-10-06 | Phase 5 merged (`80118ac`)                                   | #6  |
| 2026-10-10 | Diary files git-ignored                                      | #7  |
| 2026-10-10 | Phase 6 started                                              | #8  |
| 2026-10-10 | Phase 6 merged (`cb7b3b6`)                                   | #8  |
| 2026-10-10 | Phase 7 started                                              | #9  |
| 2026-10-10 | Phase 7 merged (`146991b`)                                   | #9  |
| 2026-10-10 | Phase 8 started                                              | #11 |
| 2026-10-10 | Phase 9 started                                              | #12 |
| 2026-10-11 | Phase 8 merged (`3673c52`)                                   | #11 |
| 2026-10-11 | Phase 9 merged (`faaaf68`)                                   | #12 |
| 2026-10-11 | Phase 10 started                                             | #14 |
| 2026-10-12 | Phase 10 merged (`d7384e2`)                                  | #14 |
| 2026-10-13 | UI refresh, end-to-end tests and CI merged (`ed5c432`)       | #16 |
| 2026-10-13 | Project documentation started (`docs/project-documentation`) | —   |
| 2026-10-13 | Phase 11 started                                             | #18 |
| 2026-10-13 | Phase 11 merged (`bf1d4e7`)                                  | #18 |
| 2026-10-13 | Phase 12 started                                             | #20 |
| 2026-10-13 | Phase 12 merged (`677ff30`)                                  | #20 |
| 2026-10-14 | "Mi ubicación" and the radius follow the search (`a47654e`)  | #21 |
| 2026-10-14 | A lone keyword no longer lists a chip's category (`009f4c5`) | #22 |
| 2026-10-14 | Phase 12 bookkeeping                                         | #23 |
| 2026-10-14 | Phase 13 started                                             | #24 |
| 2026-10-14 | Phase 13 merged (`e3c564f`)                                  | #24 |
| 2026-10-14 | Phase 14 started                                             | #25 |
| 2026-10-14 | Phase 14 merged (`472c7cc`)                                  | #25 |
| 2026-10-14 | Phase 15 started                                             | #27 |
| 2026-10-14 | Phase 15 merged (`1e95d14`)                                  | #27 |
| 2026-10-14 | Phase 16 started                                             | #28 |
| 2026-10-14 | Phase 16 merged (`501415d`)                                  | #28 |
| 2026-10-14 | README screenshots, docs brought up to date (`112bf1e`)      | #30 |
| 2026-10-14 | Phase 17 started                                             | #31 |
| 2026-10-14 | Phase 17 merged (`998af42`)                                  | #31 |
| 2026-10-14 | Phase 18 started                                             | #33 |
| 2026-10-14 | Phase 19 started                                             | #34 |
