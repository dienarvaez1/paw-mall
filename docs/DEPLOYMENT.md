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
6. Merge the PR into `main` (squash), delete the branch, then start the next phase.

Statuses: **Not started** · **In progress** · **In review** (PR ready) · **Done** (merged and
checked) · **Blocked**.

## Status at a glance

| Phase | Name                 | Branch                     | PR  | Status      | Started | Merged |
| ----- | -------------------- | -------------------------- | --- | ----------- | ------- | ------ |
| 1     | Foundation           | `phase-1/foundation`       | —   | Not started | —       | —      |
| 2     | Pet businesses       | `phase-2/pet-businesses`   | —   | Not started | —       | —      |
| 3     | Search and map       | `phase-3/search-and-map`   | —   | Not started | —       | —      |
| 4     | Emergency vets       | `phase-4/emergency-vets`   | —   | Not started | —       | —      |
| 5     | Trust                | `phase-5/trust`            | —   | Not started | —       | —      |
| 6     | Pet-friendly layer   | `phase-6/pet-friendly`     | —   | Not started | —       | —      |
| 7     | Tourism and museums  | `phase-7/tourism-museums`  | —   | Not started | —       | —      |

## Phase details

### Phase 1 — Foundation

- **Scope:** monorepo (pnpm, Turborepo), TypeScript, ESLint, Prettier, Vitest, `CLAUDE.md`; Expo
  app boots; Hono API answers `/health` locally; Postgres + PostGIS in Docker; i18next with `es`
  and `en`.
- **Done when:** the app opens on a phone or simulator via Expo Go with a Spanish welcome screen
  and reaches the local API.
- **Branch / PR:** `phase-1/foundation` / —
- **Status:** Not started
- **Checks:**
  - [ ] `pnpm lint`
  - [ ] `pnpm typecheck`
  - [ ] `pnpm test`
  - [ ] Done-when check on device
- **Notes:** —
- **Follow-ups:** —

### Phase 2 — Pet businesses

- **Scope:** data model; DENUE importer for 465911, 541941, 541942 and name-based picks from
  812990; categories; Overture enrichment; website checks.
- **Done when:** `curl` lists real vets and pet stores near the Zócalo by category, with the
  PLAN.md counts (±1%), and grooming entries come only from matching names.
- **Branch / PR:** `phase-2/pet-businesses` / —
- **Status:** Not started
- **Checks:**
  - [ ] `pnpm lint`
  - [ ] `pnpm typecheck`
  - [ ] `pnpm test`
  - [ ] Import counts recorded below (465911 ≈ 8,709; 541941 ≈ 6,546; 541942 ≈ 70)
  - [ ] Done-when check
- **Notes:** —
- **Follow-ups:** —

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

| Date       | Change                          | PR  |
| ---------- | ------------------------------- | --- |
| 2026-10-05 | Rollout log created             | —   |
