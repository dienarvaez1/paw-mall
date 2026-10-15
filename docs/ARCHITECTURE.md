# Paw Mall — Architecture

How the pieces fit together. For setup and commands see [DEVELOPMENT.md](DEVELOPMENT.md); for
the reasons behind each phase see [PLAN.md](PLAN.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

## Overview

```
 ┌────────────────────┐   HTTPS/JSON (/v1)   ┌──────────────────┐   SQL    ┌──────────────────────┐
 │ apps/mobile        │ ───────────────────▶ │ apps/api         │ ───────▶ │ PostgreSQL 17        │
 │ Expo / React Native│                      │ Hono on Workers  │          │ PostGIS, pg_trgm,    │
 │ iOS and Android    │ ◀─────────────────── │ (wrangler dev)   │ ◀─────── │ unaccent (Docker)    │
 └────────────────────┘                      └──────────────────┘          └──────────────────────┘
          │  types and validation                    │                                ▲
          └────────────── packages/shared ───────────┘                                │
                                                       packages/importers ─────────────┘
                                                       (DENUE, Overture, OSM, Wikidata, …)
```

- The **app talks only to the API**; it never reads data files or the database.
- **`packages/shared`** holds the Zod schemas and types for every request and response, plus
  constants (categories, radius limits, search words). The app, the API and the importers import
  them, so a contract changes in one place.
- **`packages/importers`** loads the data into the same database the API reads. They run on a
  developer machine; nothing is scheduled.
- Everything runs locally: the database in Docker (port 5434), the API with `wrangler dev` (port
  8787), the app through Metro (Expo Go or a development build).

## Database

Drizzle schema in `apps/api/src/db/schema.ts`, SQL migrations in `apps/api/src/db/migrations`.

| Table                                 | Holds                                                                                                                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `places`                              | Every business and venue: source and id in it, name, chain, address, city, state, location (PostGIS geography), phone/website/social and where they came from, hours, hidden and owner-verified state, Overture and Google ids |
| `categories`, `category_translations` | The 16 categories (10 pet businesses, 6 pet-friendly venue kinds) and their names per language                                                                                                                                 |
| `place_categories`                    | Which categories a place has, and why (DENUE activity, name keywords, curated)                                                                                                                                                 |
| `vet_details`                         | Vet-specific facts: emergencies, 24 hours                                                                                                                                                                                      |
| `pet_policies`                        | A venue's pet policy (species, size, where, fee) with its source and confirmation date                                                                                                                                         |
| `policy_answers`, `pet_answers`       | Users' "is this policy right?" and "does it take dogs?" answers, one per phone (random app id)                                                                                                                                 |
| `place_reports`                       | "Closed" and "animal cruelty" reports, one per phone; a report hides the place until reviewed                                                                                                                                  |
| `place_claims`                        | Owners' claims, reviewed by hand (`pnpm places:claims`); the SAT certificate check is deferred by the owner                                                                                                                    |
| `search_areas`                        | Colonias, towns, municipalities and landmarks with a normalized `name_key` (trigram index), for searching "around a place" and the search box's suggestions                                                                    |
| `google_usage`, `google_lookups`      | The Google Places free-tier counters and per-phone daily limits                                                                                                                                                                |
| `import_runs`                         | One row per importer run: counts and timing                                                                                                                                                                                    |

**Reporter privacy:** reports and answers store only the reason and a random id the app generates;
never the phone's location, IP, name or contact.

**Verification:** every place in the API carries `verification` (`packages/shared/src/verification.ts`),
worked out in SQL from the data above, first match wins: `needs_review` (a report, or a disputed
pet policy), `owner_verified`, `community_confirmed` (users' pet policy), `website_verified` (its
website answered a check within a year), `listed` (only a directory says so), with the date of
the evidence.

**Pet businesses:** `places.pet_business` is true for places with a pet-business category, kept
by triggers on `place_categories` (migration 0013); a location index on those places only lets
Explorar skip the restaurants, cafés and hotels (94% of the places).

**Visibility:** queries only return places where `hidden_at IS NULL`. Reports and confirmed
closures hide a place; the owner-review commands (`pnpm places:reports`, `places:claims`) decide.

## API (`apps/api`)

Hono app (`src/index.ts`) with CORS for the browser origins in `CORS_ORIGINS` only (Expo web; the
phone app sends no Origin), a write rate limit (`middleware/rate-limit.ts`: Cloudflare's rate
limiter, 20 writes per minute per user keyed by a hashed IP that's never stored; at most 3 pending
claims per place), `/health` and `/v1`. Routes parse their input with the shared
Zod schemas (`lib/http.ts` → `parseInput`) and return typed JSON; errors use a shared error shape.
Responses are localized by `Accept-Language` (`es` default, `en`).

| Endpoint                             | Purpose                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /health`                        | API and database status (PostGIS version)                                                                                                              |
| `GET /v1/categories`                 | Categories with names and counts                                                                                                                       |
| `GET /v1/places`                     | The list: places within a radius, nearest first, paged; text search, category, filters                                                                 |
| `GET /v1/places/map`                 | The map: places in the visible box and the radius — one by one up to `limit` (the app's pin button: 50–300, default 200), otherwise a grid of clusters |
| `GET /v1/places/area`                | Whether a text is exactly a place's name (for the place-or-business question)                                                                          |
| `GET /v1/places/area-suggestions`    | Place names for the search box's autocomplete (order-invariant word starts)                                                                            |
| `GET /v1/places/urgent`              | Emergency vets: hospitals and 24-hour vets, nearest and open first                                                                                     |
| `GET /v1/places/:id`                 | One place, with its policy, hours and sources                                                                                                          |
| `POST /v1/places/:id/reports`        | "Closed" / "animal cruelty" report                                                                                                                     |
| `POST /v1/places/:id/claims`         | Owner claim                                                                                                                                            |
| `POST /v1/places/:id/policy-answers` | Confirm or dispute a pet policy                                                                                                                        |
| `POST /v1/places/:id/pet-answers`    | "Does it take dogs?" for a venue without a policy                                                                                                      |
| `POST /v1/places/:id/google`         | "Ver horario": Google's hours on request, within the free tier ([GOOGLE-PLACES.md](GOOGLE-PLACES.md))                                                  |

### Queries (`src/queries`)

- **`places.ts`** — list, map and detail queries. The text search (`interpretSearch`) reads the
  search box in this order: a category keyword ("vet", "estética") picks a category, where it fits
  the selected chip and the tab (otherwise a chip wins, or, when the keyword is the whole search,
  it's searched in names: "vet" with Restaurantes); a place name
  ("Coyoacán", "Zócalo", or "vet en Coyoacán") moves the circle there; the remaining words must
  each appear in the name, city or state (`searchWords`; "CDMX"/"DF" read as Ciudad de México).
  The app can force "business names only" (`namesOnly`) or "around this place".
- **Nearest first:** pages are read from the location index in distance order
  (`p.location <-> point`), so a page stops after its places; the total comes from a separate
  count. Connections run with JIT off: compiling these short queries cost more than running
  them (found with `pnpm load`).
- **Map clusters:** above `limit` places in view (the map's pin button, `MAP_PIN_LIMITS` 50–300, default 200; owner's rules, 2026-10-14), the API groups places with `ST_SnapToGrid` on a grid
  of 6 columns across the visible width (anchored at 0,0 so cells don't move when panning); each
  cluster has its count, average position and bounding box.
- **`areas.ts`** — place names. `resolveArea` matches an exact name (accents and case aside);
  `suggestAreas` matches every typed word at the start of a word of the name, in any order, and
  ranks exact name, then "as typed", then cities/towns/landmarks before colonias, then the busiest.
- **`trust.ts`** — reports, claims and answers. **`google.ts`** — Google Places lookups with the
  monthly and per-phone limits.

## Data pipeline (`packages/importers`)

Each loader is a command (`pnpm places:*`), safe to re-run, writing to the same database:

| Order | Command                                               | Loads                                                                                                                                                                     |
| ----- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `places:import`                                       | INEGI DENUE for all 32 states: pet businesses by activity class and name, restaurants, cafés and hotels; twins merged (a chain branch, or one name and phone within 50 m) |
| 2     | `places:enrich-overture`                              | Overture Maps (DuckDB over the Parquet release): phones, websites, social pages                                                                                           |
| 3     | `places:check-websites`                               | Visits each website once: dead sites hidden; hours and "pet friendly" wording read from the homepage                                                                      |
| 4     | `places:areas`                                        | Colonias, towns, municipalities and landmarks for the search box (`search_areas`)                                                                                         |
| 5     | `places:curated`                                      | Hand-collected pet-friendly places (`data/pet-friendly-cdmx.json`)                                                                                                        |
| 6     | `places:osm`, `places:osm-hours`, `places:osm-phones` | OpenStreetMap dog parks and venues, opening hours, and phones for vets without one (committed snapshots)                                                                  |
| 7     | `places:chains`                                       | Chain-wide pet policies (`data/pet-friendly-chains.json`)                                                                                                                 |
| —     | `places:landmarks`                                    | Refreshes the Wikidata landmarks snapshot                                                                                                                                 |
| —     | `places:claims`, `places:reports`, `places:policies`  | Owner review of claims, reports and policy answers                                                                                                                        |
| —     | `places:integrity`                                    | Read-only data-integrity report: duplicates, bad coordinates or hours, Urgencias gaps, stale data                                                                         |
| —     | `e2e:seed`                                            | The fixed test data for end-to-end tests (`paw_mall_e2e`)                                                                                                                 |

The importers exclude cruelty-linked businesses (puppy mills, slaughterhouses, butchers) by
activity and name, and merge duplicates across sources by name and distance.

## Mobile app (`apps/mobile`)

Expo SDK 57, Expo Router, NativeWind (Tailwind classes), TanStack Query, react-native-maps,
i18next.

### Routes (`app/`)

| Route                 | Screen                                                         |
| --------------------- | -------------------------------------------------------------- |
| `(tabs)/explore`      | Explorar — pet businesses (map or list)                        |
| `(tabs)/pet-friendly` | Pet-friendly — venues with their pet policy (map or list)      |
| `(tabs)/urgent`       | Urgencias — emergency vets, nearest open first                 |
| `(tabs)/favorites`    | Favoritos — saved places, newest first                         |
| `(tabs)/settings`     | Ajustes — language, units, pet profile, place filters          |
| `place/[id]`          | A place's page: map, contact links, hours, pet policy, reports |
| `claim/[placeId]`     | Owner claim form                                               |

### One page for Explorar and Pet-friendly

The two tabs are **one page**: the same controls and the same map, only the places, chips and
title differ. The tabs layout (`app/(tabs)/_layout.tsx`) draws a single `ExploreScreen` over
whichever of the two tabs is open; the two tab routes are empty frames that report the room it
has (`src/features/explore/explore-frame.tsx`). On other tabs the page stays mounted but hidden
(see-through and untouchable), so it comes back exactly as it was. The page waits for its size
before drawing: a map laid out at zero height opens on the whole world on Android.

### State

- **`features/explore/explore-view.tsx`** — the shared search state: Map/List mode, "Mi
  ubicación", the search text, the circle's center (a tapped cluster or a pan) and a searched
  place's radius, satellite view, the location-button requests, the user's place-or-business
  answer, and the circle's name (`circleName`, written by whichever of the list or map is on
  screen) so Urgencias names the same circle. A hand pan off a searched place lets go of it
  (`leaveArea`): the box empties and the search follows the map.
- **`features/explore/search-fit.ts`** — fits the radius once per confirmed search, for both
  tabs, so switching tabs keeps the same circle.
- **`features/settings/settings-context.tsx`** — device settings in AsyncStorage: language,
  units, radius, pet profile, place filters, the map's pin limit (`mapPinLimit`).
- **`features/favorites`**, **`features/location`** (device location with a Mexico City
  fallback), **`features/network`** (offline notice).
- Server data goes through TanStack Query hooks in **`src/api/hooks.ts`**; every key includes the
  locale, so switching language refetches. `src/api/client.ts` gives up on a request after 15 s
  (`fetch-timeout.ts`), so a server that never answers shows "couldn't reach the server" with a
  retry instead of an endless spinner.

### Search box and autocomplete

- **Words:** `packages/shared/src/search-tokens.ts` turns text into words: lower case, no
  accents, stop words (in, at, near, por, en, para) left out, CDMX/DF as Ciudad de México.
- **Candidates:** place names from `/v1/places/area-suggestions` and businesses near the user from
  `/v1/places` (`useAreaSuggestions`, `useBusinessSuggestions`).
- **Filter:** `features/explore/search-filter.ts` keeps candidates where every typed word starts a
  word of the name, category, neighborhood or state (`.every()`, any order), and ranks them.
- **List:** `features/explore/autocomplete-search.tsx` — `useAutocomplete` and
  `AutocompleteList`, a FlatList in a KeyboardAvoidingView drawn at page level (Android ignores
  touches on views hanging outside their parent).
- **Rules:** typed text searches business names; a picked place searches around it; a typed place
  name sent with the search key asks "place or business?".

### Map

`ExploreScreen` → `PlacesMap`: Apple Maps on iOS (`mutedStandard`), Google Maps on Android (Paw
Mall's own key in development builds; `MAPS_AVAILABLE` shows a notice instead of crashing without
one). The map asks for places in the area actually on screen (it re-reads its boundaries after
its own moves, since iOS doesn't always report them), draws the radius circle, pins and clusters
(`cluster-size.ts`), and tells the user's hand moves from its own (`movedByHand`) to save a
zoomed radius or turn "Mi ubicación" off.

### i18n

Every visible string goes through `t('namespace.key')` (`src/i18n/locales/{es,en}`);
`pnpm i18n:check` verifies every Spanish key has an English value. Numbers, distances and dates
use `Intl` with the active locale.

## Testing

- **Unit and API tests:** Vitest in every package. The API tests run against their own database,
  `paw_mall_test`, created and migrated by the test setup. Failure paths: the API with its
  database down (`database-down.test.ts`: `/health` reports it, every route answers a bare
  `INTERNAL_ERROR`), and a DENUE import that fails part way (`denue/save.test.ts`: one
  transaction, so nothing is left behind).
- **End to end:** Maestro flows in `apps/mobile/.maestro` (30 flows, 34 journeys) on fixed test
  data, on the Android build and on iOS in Expo Go — see [TESTING-E2E.md](TESTING-E2E.md).
- **CI:** `.github/workflows/ci.yml` (lint, typecheck, tests on every PR) and `e2e.yml` (Maestro on
  an Android emulator: nightly, manual or the `run-e2e` label).
