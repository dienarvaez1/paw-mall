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
| 2     | Pet businesses      | `phase-2/pet-businesses`  | #3  | Done        | 2026-10-05 | 2026-10-05 |
| 3     | Search and map      | `phase-3/search-and-map`  | #4  | Done        | 2026-10-05 | 2026-10-05 |
| 4     | Emergency vets      | `phase-4/emergency-vets`  | #5  | Done        | 2026-10-05 | 2026-10-05 |
| 5     | Trust               | `phase-5/trust`           | #6  | In progress | 2026-10-05 | —          |
| 6     | Pet-friendly layer  | `phase-6/pet-friendly`    | —   | Not started | —          | —          |
| 7     | Tourism and museums | `phase-7/tourism-museums` | —   | Not started | —          | —          |

## Pending owner reviews

Decisions and discussions the owner has left for later. Each one, once decided, becomes a rule or
a task (and a note in the phase that applies it).

| Opened     | Review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Status                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 2026-10-05 | **Which other businesses aren't suitable for Paw Mall.** The owner accepted Phase 2's data as is and will list unsuitable businesses once they can browse it in the app (Phase 3). Candidates raised so far: Petland (sells puppies), wholesale vet-medicine distributors in 434112, live-animal sellers, municipal control centers, the 29 pet businesses inside Mercado Sonora (known for live animal sales; reported in the press for illegal wildlife trade), and rooster names that may or may not be cockfighting: "Alimento para gallos", "Gallo giro", "Galleritos", "Forrajería El Jaripeo" (a rodeo), "La Espuela" / "Espuela de Oro" (a spur: horses or fighting cocks), all kept for now; and "Navajas y afilación" (excluded as cockfighting blades, possibly a knife sharpener). | Open: review in the app after Phase 3 |
| 2026-10-05 | **SAT check for owner claims (RFC + idCIF), deferred by the owner.** Phase 5 was planned with Ferre Mall's check of the owner's Constancia de Situación Fiscal through SAT's public QR validation page. The owner deferred it on 2026-10-05; decide whether and when to add it before claims are opened to real owners.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Open: deferred from Phase 5           |
| 2026-10-05 | **An admin page for Paw Mall.** Reviewing claims and reports is command-line only (`pnpm places:claims`, `pnpm places:reports`). The owner wants to discuss an admin page later, probably after all phases are completed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Open: after Phase 7                   |
| 2026-10-05 | **How to show "sin nombre" businesses and INEGI's dates.** 1,689 places (about 7%) are named "… Sin Nombre" in DENUE: real, still-listed businesses without a trade name, not a sign of closure. Options: hide them by default (Ajustes switch on), show "(sin nombre comercial)", or both. Also whether "Registrado por INEGI en 2010" should read "En el directorio del INEGI desde 2010" (July 2010 is DENUE's first edition, not an opening date).                                                                                                                                                                                                                                                                                                                                         | Open: owner to choose                 |
| 2026-10-05 | **More DENUE fields to use.** Market or plaza and stall number (1,938 places, e.g. Mercado Sonora), interior numbers missing from addresses (1,504), staff size for ranking Urgencias (960 with 6+ people), business email (2,883), semi-fixed stalls (187). Suggested: market/stall and interior numbers in addresses first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Open: owner to choose                 |
| 2026-10-05 | **Area search on the map, and more landmarks.** Area search works in the list; the map still shows the area around the user (search is off in map mode, as in Ferre Mall). Options: center the map on a searched area; add landmarks outside Mexico City (Puebla, Cuernavaca, Toluca, Querétaro…) to `data/landmarks.json`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Open: owner to choose                 |
| 2026-10-05 | **Import neighboring states for the 100-mile radius?** Guerrero, Michoacán and Querétaro are now imported (owner's decision, 2026-10-05).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Done in Phase 5 (#6)                  |

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
- **Status:** In progress (waiting for the owner's check on a phone)
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
  - [ ] Owner check on a phone: open a place, try "¿Eres el dueño?" and the two report buttons
        (taps can't be automated here)
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
| 2026-10-05 | Phase 2 merged (`97d6019`) | #3  |
| 2026-10-05 | Phase 3 started            | #4  |
| 2026-10-05 | Phase 3 merged (`df26ef2`) | #4  |
| 2026-10-05 | Phase 4 started            | #5  |
| 2026-10-05 | Phase 4 merged (`c30d151`) | #5  |
| 2026-10-05 | Phase 5 started            | #6  |
