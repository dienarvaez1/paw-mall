# Paw Mall — Build Plan for Claude Code

October 5, 2026 · Diego Narvaez

## Overview and goals

Paw Mall (working name) is a mobile app (iOS and Android) for pet owners in and around Mexico City.
It answers two everyday questions:

1. **Where's the pet business I need?** Pet stores, boutiques, veterinarians, vet hospitals,
   groomers and boarding, on a map and a list, with "open now" and a fast path to the **nearest
   emergency vet open now**.
2. **Where can I go with my pet?** A pet-friendly layer over restaurants, lodging and later
   museums and tourist places, with clear policies (dogs or cats, size limits, fees, indoor or
   terrace).

Principles:

- **Spanish first** (`es-MX` default, English alongside), code and docs in English.
- **Owner-verified listings are the trust signal.** Official open data gets listings started;
  owners claim and verify them (SAT certificate check, as in Ferre Mall); shoppers report closures
  and confirm pet policies.
- **Real data from day one** where open data exists (INEGI DENUE, Overture Maps), instead of mock
  businesses.
- **Development only, $0.** No deploys until the owner decides; everything runs locally.
- **No animal cruelty.** Paw Mall never lists businesses tied to animal cruelty: puppy mills,
  kill shelters, slaughterhouses or butchers. Pet stores that sell animals, and vets and feed
  stores that serve farm animals, are fine. Importers exclude cruelty-linked names, and owners or
  shoppers can report a listing that slips through.

Region: the same six states as Ferre Mall (Ciudad de México, Estado de México, Morelos, Hidalgo,
Puebla, Tlaxcala), so the data work is known, plus Guerrero, Michoacán and Querétaro, added on
2026-10-05 when the owner extended the search radius to 100 miles (160 km). All of Mexico from
Phase 10 (owner's decision, 2026-10-11).

## Relationship to Ferre Mall

Paw Mall is a **separate project** (its own repo, folder and database). It starts by **copying the
proven pieces** of Ferre Mall instead of sharing a package across both repos. Once both apps show
what's really common, the shared parts can be extracted into a package later.

| Copy from Ferre Mall                                                     | Where it lives there                                      | Changes for Paw Mall                     |
| ------------------------------------------------------------------------ | --------------------------------------------------------- | ---------------------------------------- |
| Monorepo, tooling, conventions                                           | root config, `CLAUDE.md`                                  | Names; same rules                        |
| DENUE importer (streaming CSV, chains, merges)                           | `packages/importers/src/denue`                            | Pet classes and name-based picks (below) |
| Overture enrichment (DuckDB)                                             | `packages/importers/src/overture`                         | Pet categories                           |
| Website checker, closed reports, owner claims + SAT check                | `packages/importers/src/*`, `apps/api/src/lib/sat.ts`     | Business types                           |
| Search by name/city/state, within radius                                 | `apps/api/src/queries/stores.ts`, migration 0009          | Category filter                          |
| Map: radius circle, clusters, count legend, location and compass buttons | `apps/mobile/app/(tabs)/stores.tsx`, `/v1/stores/map`     | Category colors and filters              |
| Directions chooser (Apple Maps, Google Maps, Waze)                       | `apps/mobile/src/lib/links.ts`, `open-url.ts`             | None                                     |
| Google "Ver horario" within the free tier                                | `apps/api/src/queries/google.ts`, `docs/GOOGLE-PLACES.md` | Also feeds "open now" for vets           |
| Settings (radius by unit, filters), i18n, `Intl` formatting              | `apps/mobile/src/features/settings`, `src/i18n`           | New filters                              |

Not copied: products, prices, inventory, the Truper work, the image pipeline for products.

## Tech stack

The same stack as Ferre Mall, already proven together. See Ferre Mall's `docs/TECH-STACK.md` for
detail.

| Layer       | Choice                                                                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile app  | Expo (SDK 57) + React Native + TypeScript, Expo Router, NativeWind                                                                                                                                                              |
| Data        | TanStack Query; react-native-maps; expo-location; AsyncStorage for device settings; expo-clipboard (copy an address, added 2026-10-12); expo-dev-client (Android development builds with Paw Mall's Maps key, added 2026-10-12) |
| i18n        | i18next + react-i18next + expo-localization; `es` default, `en` alongside                                                                                                                                                       |
| API         | Hono on Cloudflare Workers, run locally with `wrangler dev` (no deploys for now)                                                                                                                                                |
| Database    | PostgreSQL + PostGIS + pg_trgm + unaccent, via Drizzle ORM; Docker locally                                                                                                                                                      |
| Shared code | `packages/shared`: Zod schemas, types, constants                                                                                                                                                                                |
| Importers   | Node.js scripts in `packages/importers`; DuckDB for Overture                                                                                                                                                                    |
| Tooling     | Node 24, pnpm workspaces, Turborepo, TypeScript, ESLint 9, Prettier, Vitest; Maestro for end-to-end flows (added 2026-10-13); k6 for load tests (installed apart, added 2026-10-14)                                             |

## Repository structure

```
paw-mall/
  apps/
    mobile/           Expo app: routes in app/, code in src/ (api, components, features, i18n, lib)
    api/              Hono API: routes, queries, lib, Drizzle schema and migrations
  packages/
    shared/           Zod schemas, types and constants used by app, API and importers
    importers/        DENUE, Overture, websites, reports, claims, curated places
  docker/postgres/    Postgres 17 + PostGIS image (Apple Silicon friendly)
  docs/
    PLAN.md           This plan
    DEPLOYMENT.md     Rollout log: status, branch and PR per phase
  CLAUDE.md           Conventions for Claude Code
```

## Internationalization (i18n)

As in Ferre Mall: every visible string goes through `t('namespace.key')` with Spanish and English
values added together; a lint rule blocks hardcoded UI text; numbers, distances, dates and times
use `Intl` with the active locale. Business names, addresses and policies come from the data, not
from i18n files. Category names and policy labels (e.g. "Acepta perros grandes") are i18n keys.

## Data model

| Table                                           | What it holds                                                                                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `places`                                        | Every business or venue: name, chain, address, city, state, location (PostGIS), phone, website, social page, hours, sources, owner verification, hidden/closed status |
| `place_categories`                              | One or more categories per place (a vet that also grooms)                                                                                                             |
| `categories` + translations                     | Pet businesses: pet store, boutique, veterinarian, vet hospital, groomer, boarding; pet-friendly venues: restaurant, café, lodging, museum, park, tourist site        |
| `pet_policies`                                  | Per place: dogs, cats, other pets, size limit, number of pets, fee, indoor/terrace/outdoor only, rules text, source (owner or shoppers), last confirmed               |
| `policy_confirmations`                          | Shopper confirmations or disputes of a policy (anonymous device id, date)                                                                                             |
| `place_reports`, `place_claims`                 | Closed reports and owner claims, as in Ferre Mall                                                                                                                     |
| `vet_details`                                   | 24-hour flag, emergencies accepted, species treated, optional cédula profesional check                                                                                |
| `google_usage`, `google_lookups`, `import_runs` | As in Ferre Mall                                                                                                                                                      |

Each field records its **source** (DENUE, Overture, owner, shoppers, curated), and owner-verified
values always win, as in Ferre Mall.

## Data sources

| Source                         | What it gives                                                                            | Notes                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| INEGI DENUE, SCIAN **465911**  | Pet stores ("Comercio al por menor de mascotas"): 8,709 in the six states                | Includes boutiques and pet food stores                                                        |
| INEGI DENUE, SCIAN **541941**  | Private vets ("Servicios veterinarios para mascotas"): 6,546                             | Hospitals and "24 horas" spotted by name (~180)                                               |
| INEGI DENUE, SCIAN **541942**  | Public vet services: 70 (e.g. Centros de Control Canino)                                 | Labeled as public services                                                                    |
| INEGI DENUE, SCIAN **812990**  | "Otros servicios personales": grooming (~1,200) and boarding, **by name only**           | A catch-all class; import only names like "estética canina", "pensión canina", "hotel canino" |
| INEGI DENUE, SCIAN **434112**  | Wholesale vet medicine and animal feed: some forrajeras sell retail                      | Imported as feed stores (forrajerías), farm animals included; cruelty-linked names excluded   |
| Overture Maps                  | Missing phones, websites, social pages; pet categories                                   | Category names to confirm in Overture's taxonomy                                              |
| Google Places (on demand)      | Hours and "open now" for one view                                                        | Free-tier cap (950 a month); nothing stored but place ids                                     |
| Owners                         | Verified details, hours, 24-hour flag, pet policies                                      | Claims reviewed by hand; the SAT certificate check is deferred by the owner (2026-10-05)      |
| Shoppers                       | Closed reports; confirming pet policies                                                  | Anonymous device ids                                                                          |
| Curated lists                  | Pet-friendly restaurants and lodging in CDMX to start                                    | Collected by the team from the businesses' own public statements                              |
| Official cultural/tourism data | Museums and tourist sites (e.g. Secretaría de Cultura's Sistema de Información Cultural) | **Licensing to verify** before use                                                            |

Counts are from the DENUE edition of May 2026, measured on October 5, 2026.

## Screens and UX

- **Tabs:** Explorar (map/list of pet businesses), Pet-friendly (the same map and list for venues
  that take pets), Urgencias (nearest emergency vet open now), Favoritos, Ajustes.
- **Explorar:** the Ferre Mall map and list (radius circle, clusters, count legend, location and
  compass buttons), with **category chips** (Tiendas, Veterinarias, Estéticas, Pensiones,
  Restaurantes, Hospedaje…); the **Pet-friendly** tab shares its map (built as a tab instead of
  the toggle first planned).
- **Place page:** category, open now, hours, call, website, social, "Cómo llegar" (Apple Maps,
  Google Maps or Waze), pet policy card with its source and last confirmation, "¿Cerró?", "¿Eres el
  dueño?".
- **Urgencias:** one tap to the nearest vet hospital **open now** or 24 hours, with call and
  directions buttons up front; works from the device's location without typing.
- **Settings:** language, radius and units, store filters (phone, website, hide "sin nombre"),
  pet profile (dog/cat, size) to pre-filter pet-friendly places.

## Phased roadmap

Seven phases were planned at the start; phases 8 to 17 were added as the work went on. Each ends
with a check you can run on your phone. Finish and commit one phase before starting the next. No deploys in any phase until the owner decides.

1. **Foundation (1–2 days).** Monorepo, TypeScript, lint, Prettier, Vitest, `CLAUDE.md`, Expo app
   boots, Hono API answers `/health` locally, Postgres + PostGIS in Docker, i18next with `es` and
   `en`.
   - Done when: the app opens on a phone or simulator via Expo Go with a Spanish welcome screen
     and reaches the local API.
2. **Pet businesses (3–5 days).** Data model; DENUE importer for 465911, 541941, 541942 and
   name-based picks from 812990 (grooming, boarding); categories (stores, boutiques, vets,
   hospitals, groomers, boarding); Overture enrichment; website checks.
   - Done when: `curl` lists real vets and pet stores near the Zócalo by category, with the counts
     above (±1%), and grooming entries come only from matching names.
3. **Search and map (1 week).** Reuse Ferre Mall's search (name, city, state; within radius;
   nearest first), map (circle, clusters inside the radius, legend, location and compass buttons),
   directions chooser and place pages; add category chips and filters.
   - Done when: on a phone, filtering "Veterinarias" shows only vets on the map and list, and
     "Cómo llegar" opens the chosen maps app.
4. **Emergency vets (3–5 days).** Hours model, "open now" filter, 24-hour flag (from owners, and
   from names like "24 horas" as an unconfirmed hint), the Urgencias tab with "nearest vet hospital
   open now", Google "Ver horario" on demand with the free-tier cap.
   - Done when: Urgencias shows the nearest open vet with call and directions in one tap, and says
     clearly when hours are unconfirmed.
5. **Trust (3–5 days).** Owner claims with the SAT check, closed-business reports, owner-verified
   badges; optionally checking a vet's cédula profesional, **only after confirming the public
   registry's terms** (no scraping).
   - Done when: an approved claim shows "Verificado por el dueño" and its hours drive "open now".
6. **Pet-friendly layer (1–2 weeks).** Pet policies (dogs/cats, size, number of pets, fees,
   indoor/terrace), owner-declared and shopper-confirmed; a curated starting set of pet-friendly
   restaurants and lodging in Mexico City; the pet-friendly toggle and policy filters; the pet
   profile in Settings.
   - Done when: with a "perro grande" profile, the map shows only places whose policy allows large
     dogs, each with its policy source and last confirmation.
7. **Tourism and museums (1 week).** Pet-friendly attributes on museums, parks and tourist sites,
   from official cultural and tourism sources once their licensing is verified, plus curated
   entries.
   - Done when: museums and parks appear with their pet policy, and each source is credited.
8. **Bug fixes.** Owner-reported bugs and known issues (flaky tests, map pins).
   - Done when: each bug is fixed and checked on a phone.
9. **Pet-friendly at scale (added 2026-10-10).** OpenStreetMap dog parks, parks and venues with a
   dog rule; DENUE restaurants, cafés and hotels in every supported state (CDMX first, all states
   from 2026-10-11), whose pet policy comes from users'
   "¿Acepta mascotas?" answers (2 phones agreeing, more than disagree, within a year). Free
   sources for hours and policies instead of Google: OpenStreetMap opening hours, businesses'
   homepages (schema.org hours, "pet friendly" wording) and chain-wide policies.
   - Done when: a name search in Pet-friendly finds an unanswered restaurant, two phones answering
     yes make it appear under Restaurantes with "Según usuarios de Paw Mall", and OpenStreetMap is
     credited on its places.
10. **All of Mexico (added 2026-10-11).** Every data source extended from the nine states to all
    32: DENUE pet businesses and restaurants, cafés and hotels; search areas (colonias, cities,
    Wikidata landmarks); OpenStreetMap dog places and opening hours; Overture phones and websites;
    the website check.
    - Done when: a search for a place in a newly covered state (e.g. "Guadalajara", "Monterrey",
      "Mérida") moves the map there with its pet businesses and pet-friendly places, and the
      rollout log records the data volumes and import times.

11. **Hardening (added 2026-10-13, from an external project review).** Write rate limits and a cap
    on pending claims, CORS limited to known browser origins, a data-integrity report
    (`pnpm places:integrity`), and a verification status on every place (shown on its page and on
    Urgencias cards).
    - Done when: the 21st write in a minute gets 429, another browser origin gets no CORS header,
      the integrity report runs on the full data, and a reported place shows "En revisión".

12. **Failure coverage (added 2026-10-13, review items 5–6).** End-to-end flows for the
    animal-cruelty report and for the API down while the phone is online; the flows on iOS (Expo
    Go on the simulator); tests for the API with its database down and for an interrupted import;
    a request timeout in the app.
    - Done when: the Maestro flows pass on the Android emulator and the iOS simulator, `api-down`
      passes with the API stopped, and the failure tests pass in CI.

13. **Load test (added 2026-10-14, review item 7).** A k6 load test of the API's read endpoints on
    the full data (`pnpm load`, local only), and the query fixes it calls for.
    - Done when: 50 users at once keep 95% of reads under 500 ms (229 ms after the fixes) and the
      write burst gets 429 after 20.

14. **Data cleanup (added 2026-10-14).** Act on the first integrity report: merge DENUE's
    same-business twins (one name and phone within 50 m) and split the report's duplicate checks.
    - Done when: the import merges the twins and the integrity report lists what's left.

15. **OpenStreetMap vet phones (added 2026-10-14).** Phones from OpenStreetMap for vets and vet
    hospitals that have none (`pnpm places:osm-phones`), credited on their pages.
    - Done when: matched vets show the phone with OpenStreetMap as its source.

16. **Bug fixes 2 (added 2026-10-14).** Owner-reported map, search and Urgencias bugs: a hand pan
    lets go of a searched place, Urgencias names the same circle as the map, empty results name
    the place, a pin-count button (50–300), both tabs' maps stay in sync.
    - Done when: each bug is fixed and checked on the emulator, with Maestro flows for the new
      behavior.

17. **Search quality benchmark (added 2026-10-14, QA strategy section 5).** A version-controlled
    set of labeled searches (services, synonyms, accents, typos, English, names, places, negative
    cases), judged in SQL against the labels, with precision and recall at 10, zero results,
    known items, latency and regressions against a committed baseline (`pnpm search:bench`).
    - Done when: the benchmark runs on the full data, the baseline is committed, and a changed
      result shows up as a regression.

**Later:** business model (featured listings, pet brands, pet-friendly hotels), app store readiness
(icons, EAS builds, TestFlight and Play testing, privacy policy), and a production deployment when
the owner decides.

## App Store and Google Play readiness (later)

As in Ferre Mall's plan: Apple Developer Program ($99/year), Google Play Console ($25 once), Expo
account and EAS project, bundle ID decided before release, Spanish store listing, privacy policy
(location, owner claims, reports), location permission text in Spanish ("Para mostrarte
veterinarias y lugares pet-friendly cercanos").

## Conventions for Claude Code

Copy these rules into `CLAUDE.md` at the repo root.

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
- Ask before adding a dependency that isn't in the Tech stack table.
- **Development only:** never deploy, create cloud resources or run production scripts unless the
  owner asks.
- Credit every data source where its data appears (INEGI, Overture Maps Foundation, Google Maps,
  cultural sources).
- No scraping of sites whose terms forbid it; no CAPTCHA bypassing.

## Open decisions

| Decision                        | Default assumed                                                                | Why it matters                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Repo visibility                 | Private                                                                        | Public exposes plans and data work                                                   |
| App name and bundle ID          | "Paw Mall" as a working name                                                   | Hard to change after store release                                                   |
| Region                          | All of Mexico (from Phase 10)                                                  | Data volume and the map center                                                       |
| Shared code with Ferre Mall     | Copy now, extract a package later                                              | Avoids coupling two young projects                                                   |
| Who uses it                     | Pet owners, no login                                                           | Owner claims and policy confirmations work without accounts; reviews would need them |
| Pet-friendly coverage at launch | Curated CDMX, plus DENUE venues and OSM dog places in every state (2026-10-11) | Breadth from open data; most policies come from users' answers                       |
| Vet license check               | Off until the registry's terms are confirmed                                   | Legal and technical feasibility                                                      |

## Risks, open questions and costs

**Risks**

- **Freshness:** DENUE is updated yearly and drops closed businesses mainly in the five-yearly
  census; closed reports, website checks and owner claims mitigate this.
- **Informal businesses:** many groomers, boarding and pet sellers aren't registered, so DENUE
  misses them; owner sign-ups and curated additions fill gaps.
- **Emergency information must be right:** a wrong "open now" for a vet hospital is worse than
  none. Show the source and confirmation date, prefer owner-verified hours, and say when hours are
  unknown.
- **Pet-friendly data is user-sourced:** policies change and venues vary by branch; show who said
  it and when, and let shoppers confirm or dispute.
- **Animal welfare:** the no-cruelty rule is enforced by name patterns, which miss businesses with
  neutral names (a puppy mill called "Mascotas Felices"); closed-business reports need a
  "cruelty" reason so shoppers can flag them.
- **Licensing:** cultural and tourism datasets, and the cédula registry, need their terms checked
  before use.

**Open questions**

- [x] Should live animal sales be listed? **Yes** (owner, 2026-10-05): pet stores that sell
      animals and farm-animal vets and feed stores are listed; cruelty-linked businesses never are.
      Municipal animal control centers (Centros de Control Canino, antirrábicos) are listed as
      public services.
- [ ] Which curated sources for pet-friendly places are acceptable (the venues' own statements,
      partnerships)?
- [ ] Is a vet license check worth the legal review?
- [ ] Business model: featured listings, pet brands, pet-friendly hotels, or partnerships?

**Costs:** $0 while in development. Everything runs locally (Docker Postgres, `wrangler dev`, Expo
Go); the only cloud service is the Google Places key for "Ver horario", capped under Google's free
monthly allowance. Production costs would mirror Ferre Mall's estimates (see its `docs/COSTS.md`)
once the owner decides to deploy.

## Kickoff prompt for Claude Code

Open Claude Code in this folder and paste:

```
Read docs/PLAN.md fully. It is the build plan for this project.

1. Create CLAUDE.md at the repo root from the "Conventions for Claude Code" section.
2. Use the defaults in "Open decisions" unless I say otherwise.
3. Start Phase 1 (Foundation) only. Before writing code, show me a short
   checklist of what you will create and the commands I will run to test it.
4. When Phase 1 meets its "Done when" check, stop, summarize what changed,
   and tell me exactly how to open the app with Expo Go.

Remember: development only, no deploys; code and comments in English; every
user-facing string in Spanish through i18next, with English values alongside.
```

For each later phase, ask: "Start Phase N from docs/PLAN.md, same rules."
